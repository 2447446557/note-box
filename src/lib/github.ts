import { Octokit } from '@octokit/rest'
import { decode as b64decode, encode as b64encode } from 'base-64'
import {
  extractMetaFromContent,
  extractTitleFromContent,
  flattenNoteContentToHtml,
  withNoteMeta,
} from './content'
import type { AppSettings, Note } from '../types'

export class GitHubError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

function decodeContent(content: string, encoding?: string): string {
  if (encoding === 'base64') {
    const binary = b64decode(content.replace(/\n/g, ''))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }
  return content
}

function encodeContent(content: string): string {
  const bytes = new TextEncoder().encode(content)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return b64encode(binary)
}

function titleFromFilename(name: string): string {
  return name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ')
}

export function notePath(settings: AppSettings, filename: string): string {
  const base = settings.notesPath.replace(/^\/+|\/+$/g, '')
  return `${base}/${filename}`
}

export function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || `note-${Date.now()}`
}

export async function listNoteFiles(
  settings: AppSettings,
): Promise<Array<{ name: string; path: string; sha: string }>> {
  const octokit = createOctokit(settings.token)
  const path = settings.notesPath.replace(/^\/+|\/+$/g, '')

  try {
    const { data } = await octokit.repos.getContent({
      owner: settings.owner,
      repo: settings.repo,
      path,
      ref: settings.branch,
    })

    if (!Array.isArray(data)) {
      throw new GitHubError('笔记目录不是文件夹，请检查 notesPath 配置')
    }

    return data
      .filter((item) => item.type === 'file' && item.name.toLowerCase().endsWith('.md'))
      .map((item) => ({ name: item.name, path: item.path, sha: item.sha }))
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 404) return []
    throw wrapError(error)
  }
}

export async function getNoteFile(
  settings: AppSettings,
  path: string,
): Promise<{ content: string; sha: string }> {
  const octokit = createOctokit(settings.token)
  try {
    const { data } = await octokit.repos.getContent({
      owner: settings.owner,
      repo: settings.repo,
      path,
      ref: settings.branch,
    })

    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
      throw new GitHubError(`无法读取文件: ${path}`)
    }

    return {
      content: decodeContent(data.content, data.encoding),
      sha: data.sha,
    }
  } catch (error) {
    throw wrapError(error)
  }
}

export async function pullAllNotes(settings: AppSettings): Promise<Note[]> {
  const files = await listNoteFiles(settings)
  const notes: Note[] = []

  for (const file of files) {
    const { content, sha } = await getNoteFile(settings, file.path)
    const fallback = titleFromFilename(file.name)
    const meta = extractMetaFromContent(content)
    const stored = flattenNoteContentToHtml(meta.body || content)
    notes.push({
      id: file.name,
      path: file.path,
      title: extractTitleFromContent(content, fallback),
      content: stored,
      sha,
      updatedAt: Date.now(),
      dirty: false,
      parentId: meta.parentId ?? null,
      sortOrder: meta.sortOrder,
    })
  }

  return notes.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function pushNote(
  settings: AppSettings,
  note: Note,
  options?: { force?: boolean },
): Promise<{ sha: string }> {
  const octokit = createOctokit(settings.token)
  const path = note.path || notePath(settings, note.id)

  try {
    let sha = options?.force ? undefined : note.sha

    if (options?.force || !sha) {
      try {
        const remote = await getNoteFile(settings, path)
        if (!options?.force && note.sha && remote.sha !== note.sha) {
          const conflict = new GitHubError('远程内容已变更', 409)
          ;(conflict as GitHubError & { remoteContent?: string; remoteSha?: string }).remoteContent =
            remote.content
          ;(conflict as GitHubError & { remoteContent?: string; remoteSha?: string }).remoteSha =
            remote.sha
          throw conflict
        }
        sha = remote.sha
      } catch (error) {
        if ((error as GitHubError).status === 409) throw error
        if ((error as { status?: number }).status !== 404 && !(error instanceof GitHubError)) {
          throw wrapError(error)
        }
        sha = undefined
      }
    }

    const message = note.sha || sha ? `Update ${note.id}` : `Create ${note.id}`
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: settings.owner,
      repo: settings.repo,
      path,
      message,
      content: encodeContent(withNoteMeta(note)),
      branch: settings.branch,
      sha,
    })

    const newSha = data.content?.sha
    if (!newSha) throw new GitHubError('推送成功但未返回文件 sha')
    return { sha: newSha }
  } catch (error) {
    if (error instanceof GitHubError) throw error
    const status = (error as { status?: number }).status
    if (status === 409) {
      throw new GitHubError('远程内容已变更，存在冲突', 409)
    }
    throw wrapError(error)
  }
}

export async function deleteNoteFile(settings: AppSettings, note: Note): Promise<void> {
  if (!note.sha) return
  const octokit = createOctokit(settings.token)
  const path = note.path || notePath(settings, note.id)

  try {
    await octokit.repos.deleteFile({
      owner: settings.owner,
      repo: settings.repo,
      path,
      message: `Delete ${note.id}`,
      sha: note.sha,
      branch: settings.branch,
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 404) return
    throw wrapError(error)
  }
}

export async function fetchRemoteForConflict(
  settings: AppSettings,
  note: Note,
): Promise<{ content: string; sha: string }> {
  return getNoteFile(settings, note.path || notePath(settings, note.id))
}

function wrapError(error: unknown): GitHubError {
  const err = error as { status?: number; message?: string }
  if (err.status === 401) return new GitHubError('Token 无效或已过期', 401)
  if (err.status === 403) return new GitHubError('没有仓库访问权限', 403)
  if (err.status === 404) return new GitHubError('仓库或路径不存在', 404)
  return new GitHubError(err.message || 'GitHub 请求失败', err.status)
}
