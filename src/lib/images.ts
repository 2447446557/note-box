import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'
import { encode as b64encode } from 'base-64'
import type { AppSettings } from '../types'
import { createOctokit, GitHubError } from './github'

function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return b64encode(binary)
}

function extensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

export async function pickImage(): Promise<{
  base64: string
  mime: string
  fileName: string
} | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted && Platform.OS !== 'web') {
    throw new Error('需要相册权限才能上传图片')
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    base64: true,
  })

  if (result.canceled || !result.assets?.[0]) return null
  const asset = result.assets[0]
  const mime = asset.mimeType || 'image/jpeg'
  const ext = extensionForMime(mime)
  const fileName = `img-${Date.now()}.${ext}`

  let base64 = asset.base64 ?? undefined
  if (!base64 && asset.uri) {
    const res = await fetch(asset.uri)
    const buf = await res.arrayBuffer()
    base64 = encodeBase64Bytes(new Uint8Array(buf))
  }

  if (!base64) throw new Error('无法读取图片数据')
  return { base64, mime, fileName }
}

export async function uploadImageToGitHub(
  settings: AppSettings,
  file: { base64: string; fileName: string },
): Promise<{ path: string; url: string }> {
  const octokit = createOctokit(settings.token)
  const imagesDir = `${settings.notesPath.replace(/^\/+|\/+$/g, '')}/images`
  const path = `${imagesDir}/${file.fileName}`

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: settings.owner,
      repo: settings.repo,
      path,
      message: `Upload image ${file.fileName}`,
      content: file.base64,
      branch: settings.branch,
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401) throw new GitHubError('Token 无效或已过期', 401)
    if (status === 403) throw new GitHubError('没有仓库访问权限', 403)
    throw new GitHubError(
      (error as { message?: string }).message || '图片上传失败',
      status,
    )
  }

  const url = `https://raw.githubusercontent.com/${settings.owner}/${settings.repo}/${settings.branch}/${path}`
  return { path, url }
}

export function imageHtml(url: string): string {
  return `<p><img src="${url}" alt="image" style="width:60%;max-width:100%;height:auto;border-radius:8px;" /></p>`
}
