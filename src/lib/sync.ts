import type { AppSettings, ConflictState, Note, SyncStatus } from '../types'
import {
  contentScore,
  flattenNoteContentToHtml,
  isEffectivelyEmptyContent,
  isMaterialQaContent,
  parseNoteBody,
  restoreMaterialFromBackup,
} from './content'
import {
  deleteNoteFile,
  fetchRemoteForConflict,
  GitHubError,
  pullAllNotes,
  pushNote,
} from './github'
import { isConfigured, saveNotes } from './storage'

const DEBOUNCE_MS = 1200
const RETRY_MS = 20_000

export interface SyncControllerCallbacks {
  onStatus: (status: SyncStatus, message?: string) => void
  onNotes: (notes: Note[]) => void
  onConflict: (conflict: ConflictState | null) => void
}

function pendingCount(notes: Note[]): number {
  return notes.filter((n) => n.dirty || n.deleted).length
}

function isLikelyNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('internet')
  )
}

export class SyncController {
  private settings: AppSettings
  private notes: Note[]
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private pushing = new Set<string>()
  private callbacks: SyncControllerCallbacks
  private retryTimer: ReturnType<typeof setInterval> | null = null
  private onlineHandler: (() => void) | null = null
  private flushing = false

  constructor(
    settings: AppSettings,
    notes: Note[],
    callbacks: SyncControllerCallbacks,
  ) {
    this.settings = settings
    this.notes = notes
    this.callbacks = callbacks
    this.startBackgroundRetry()
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings
  }

  updateNotes(notes: Note[]) {
    this.notes = notes
  }

  getNotes() {
    return this.notes
  }

  /** Always persist current notes to local storage first. */
  async persistLocal(notes?: Note[]): Promise<void> {
    if (notes) this.notes = notes
    await saveNotes(this.notes)
  }

  private statusForLocal(extra?: string) {
    const n = pendingCount(this.notes)
    if (!isConfigured(this.settings)) {
      this.callbacks.onStatus('pending', extra || '已保存到本地（未配置 GitHub）')
      return
    }
    if (n > 0) {
      this.callbacks.onStatus('pending', extra || `已保存到本地，${n} 篇待推送`)
      return
    }
    this.callbacks.onStatus('synced', extra || '已保存到本地')
  }

  /**
   * Edit path: write local immediately, then debounce push to GitHub.
   * Push failure never loses local content.
   */
  async saveLocalThenPush(noteId: string, notes?: Note[]) {
    await this.persistLocal(notes)
    this.callbacks.onNotes(this.notes)
    this.statusForLocal('已保存到本地，稍后推送…')

    if (!isConfigured(this.settings)) return

    const existing = this.timers.get(noteId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.timers.delete(noteId)
      void this.pushOne(noteId)
    }, DEBOUNCE_MS)
    this.timers.set(noteId, timer)
  }

  /** @deprecated use saveLocalThenPush */
  schedulePush(noteId: string) {
    void this.saveLocalThenPush(noteId)
  }

  async pull(): Promise<Note[]> {
    if (!isConfigured(this.settings)) {
      await this.persistLocal()
      this.callbacks.onStatus('unconfigured', '请先在设置中配置 GitHub，本地笔记仍可用')
      return this.notes
    }

    this.callbacks.onStatus('syncing', '正在从 GitHub 拉取…')
    try {
      const remoteNotes = await pullAllNotes(this.settings)
      const localDirty = new Map(
        this.notes.filter((n) => n.dirty && !n.deleted).map((n) => [n.id, n]),
      )
      const localDeleted = new Map(
        this.notes.filter((n) => n.deleted && n.dirty).map((n) => [n.id, n]),
      )

      const merged: Note[] = remoteNotes.map((remote) => {
        const local = localDirty.get(remote.id)
        if (local) {
          const remoteHtml = flattenNoteContentToHtml(remote.content)
          const localHtml = flattenNoteContentToHtml(local.content)

          // 本地为空/明显更空时，绝不用空内容覆盖远程
          if (
            isEffectivelyEmptyContent(localHtml) &&
            contentScore(remoteHtml) > contentScore(localHtml)
          ) {
            return {
              ...remote,
              content: remoteHtml,
              dirty: remoteHtml !== remote.content,
            }
          }

          // 远程更丰富则采用远程；否则保留本地（并展平）
          if (contentScore(remoteHtml) > contentScore(localHtml) * 1.2) {
            return {
              ...remote,
              content: remoteHtml,
              dirty: remoteHtml !== remote.content,
            }
          }

          let content = localHtml
          if (
            !isMaterialQaContent(local.content) &&
            isMaterialQaContent(remote.content) &&
            contentScore(localHtml) < 50
          ) {
            const recovered = restoreMaterialFromBackup(
              local.content,
              parseNoteBody(remote.content),
            )
            if (recovered.restored) {
              content = flattenNoteContentToHtml(recovered.content)
            }
          }

          return {
            ...local,
            content,
            dirty: true,
            sha: remote.sha,
            path: remote.path,
          }
        }
        if (localDeleted.has(remote.id)) {
          return localDeleted.get(remote.id)!
        }
        const flat = flattenNoteContentToHtml(remote.content)
        return {
          ...remote,
          content: flat,
          dirty: flat !== remote.content,
        }
      })

      for (const local of localDirty.values()) {
        if (!merged.some((n) => n.id === local.id)) merged.push(local)
      }
      for (const local of localDeleted.values()) {
        if (!merged.some((n) => n.id === local.id)) merged.push(local)
      }

      this.notes = merged.sort((a, b) => b.updatedAt - a.updatedAt)
      await this.persistLocal()
      this.callbacks.onNotes(this.notes)

      const pending = pendingCount(this.notes)
      if (pending > 0) {
        this.callbacks.onStatus('pending', `已拉取并写入本地，${pending} 篇本地修改待推送`)
        void this.flushPending()
      } else {
        this.callbacks.onStatus('synced', '已拉取并同步到本地')
      }
      return this.notes
    } catch (error) {
      // Keep serving local cache
      await this.persistLocal()
      const message = error instanceof Error ? error.message : '拉取失败'
      const pending = pendingCount(this.notes)
      const suffix = pending ? `，${pending} 篇待推送` : ''
      if (isLikelyNetworkError(error)) {
        this.callbacks.onStatus('pending', `网络不可用，已使用本地笔记${suffix}`)
      } else {
        this.callbacks.onStatus('pending', `拉取失败（${message}），已使用本地笔记${suffix}`)
      }
      return this.notes
    }
  }

  async pushNow(noteId?: string) {
    await this.persistLocal()

    if (!isConfigured(this.settings)) {
      this.callbacks.onStatus('unconfigured', '已保存到本地，请先配置 GitHub 再推送')
      return
    }

    const targets = noteId
      ? this.notes.filter((n) => n.id === noteId && (n.dirty || n.deleted))
      : this.notes.filter((n) => n.dirty || n.deleted)

    if (targets.length === 0) {
      await this.pull()
      return
    }

    for (const note of targets) {
      const timer = this.timers.get(note.id)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(note.id)
      }
      await this.pushOne(note.id)
    }
  }

  async flushPending() {
    if (this.flushing) return
    if (!isConfigured(this.settings)) return
    const targets = this.notes.filter((n) => n.dirty || n.deleted)
    if (targets.length === 0) return

    this.flushing = true
    try {
      for (const note of targets) {
        if (this.timers.has(note.id)) continue
        await this.pushOne(note.id)
      }
    } finally {
      this.flushing = false
    }
  }

  async pushOne(noteId: string, options?: { force?: boolean }) {
    if (this.pushing.has(noteId)) return
    const note = this.notes.find((n) => n.id === noteId)
    if (!note || (!note.dirty && !note.deleted && !options?.force)) return

    // Ensure latest local snapshot is on disk before network call
    await this.persistLocal()

    if (!isConfigured(this.settings)) {
      this.statusForLocal('已保存到本地（未配置 GitHub）')
      return
    }

    this.pushing.add(noteId)
    this.callbacks.onStatus('syncing', '本地已保存，正在推送到 GitHub…')

    try {
      if (note.deleted) {
        await deleteNoteFile(this.settings, note)
        this.notes = this.notes.filter((n) => n.id !== noteId)
        await this.persistLocal()
        this.callbacks.onNotes(this.notes)
        this.statusAfterPushOk('已删除并推送')
        return
      }

      // 防止把空内容推上去覆盖 GitHub 上的原文
      if (isEffectivelyEmptyContent(note.content) && note.sha && !options?.force) {
        this.callbacks.onStatus(
          'pending',
          '已跳过推送：本地内容为空，避免覆盖云端原文。请先恢复或编辑后再同步。',
        )
        // 标为不 dirty 以免反复空推；保留本地，等用户修好
        this.notes = this.notes.map((n) =>
          n.id === noteId ? { ...n, dirty: false } : n,
        )
        await this.persistLocal()
        this.callbacks.onNotes(this.notes)
        return
      }

      const toPush = {
        ...note,
        content: flattenNoteContentToHtml(note.content),
      }
      const { sha } = await pushNote(this.settings, toPush, options)
      this.notes = this.notes.map((n) =>
        n.id === noteId
          ? { ...n, sha, dirty: false, updatedAt: Date.now(), path: n.path }
          : n,
      )
      await this.persistLocal()
      this.callbacks.onNotes(this.notes)
      this.callbacks.onConflict(null)
      this.statusAfterPushOk('已推送到 GitHub')
    } catch (error) {
      // Local content stays dirty and already persisted
      await this.persistLocal()

      if (error instanceof GitHubError && error.status === 409) {
        const enriched = error as GitHubError & {
          remoteContent?: string
          remoteSha?: string
        }
        let remoteContent = enriched.remoteContent
        let remoteSha = enriched.remoteSha
        if (!remoteContent || !remoteSha) {
          try {
            const remote = await fetchRemoteForConflict(this.settings, note)
            remoteContent = remote.content
            remoteSha = remote.sha
          } catch {
            this.callbacks.onStatus(
              'pending',
              '已保存到本地，推送冲突且无法读取远程，将稍后重试',
            )
            return
          }
        }
        this.callbacks.onConflict({
          noteId,
          localContent: note.content,
          remoteContent,
          remoteSha,
        })
        this.callbacks.onStatus('conflict', '已保存到本地，远程有冲突需处理')
        return
      }

      const message = error instanceof Error ? error.message : '推送失败'
      if (isLikelyNetworkError(error)) {
        this.callbacks.onStatus('pending', '已保存到本地，网络不可用，将自动重试推送')
      } else {
        this.callbacks.onStatus('pending', `已保存到本地，推送失败：${message}`)
      }
    } finally {
      this.pushing.delete(noteId)
    }
  }

  private statusAfterPushOk(okMessage: string) {
    const n = pendingCount(this.notes)
    if (n > 0) {
      this.callbacks.onStatus('pending', `${okMessage}，仍有 ${n} 篇待推送`)
    } else {
      this.callbacks.onStatus('synced', okMessage)
    }
  }

  async resolveConflictKeepLocal(conflict: ConflictState) {
    const note = this.notes.find((n) => n.id === conflict.noteId)
    if (!note) return
    note.sha = conflict.remoteSha
    note.dirty = true
    await this.persistLocal()
    await this.pushOne(conflict.noteId, { force: true })
  }

  async resolveConflictKeepRemote(conflict: ConflictState) {
    this.notes = this.notes.map((n) =>
      n.id === conflict.noteId
        ? {
            ...n,
            content: conflict.remoteContent,
            sha: conflict.remoteSha,
            dirty: false,
            updatedAt: Date.now(),
          }
        : n,
    )
    await this.persistLocal()
    this.callbacks.onNotes(this.notes)
    this.callbacks.onConflict(null)
    this.callbacks.onStatus('synced', '已用远程版本覆盖并写入本地')
  }

  private startBackgroundRetry() {
    this.retryTimer = setInterval(() => {
      if (pendingCount(this.notes) === 0) return
      if (!isConfigured(this.settings)) return
      void this.flushPending()
    }, RETRY_MS)

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.onlineHandler = () => {
        if (pendingCount(this.notes) > 0) void this.flushPending()
      }
      window.addEventListener('online', this.onlineHandler)
    }
  }

  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    if (this.retryTimer) clearInterval(this.retryTimer)
    this.retryTimer = null
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }
  }
}
