import type { MaterialUnit, Note, NoteBodyV2 } from '../types'

const TITLE_RE = /<!--\s*notebox-title:\s*([\s\S]*?)\s*-->/
const PARENT_RE = /<!--\s*notebox-parent:\s*([\s\S]*?)\s*-->/
const ORDER_RE = /<!--\s*notebox-order:\s*([-\d]+)\s*-->/
const JSON_RE = /<!--\s*notebox-json:([A-Za-z0-9+/=]+)\s*-->/

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createEmptyMaterial(): MaterialUnit {
  return {
    id: newId('m'),
    html: '<p><br></p>',
    questions: [{ id: newId('q'), html: '<p><br></p>' }],
  }
}

export function createEmptyBodyV2(): NoteBodyV2 {
  return { version: 2, materials: [createEmptyMaterial()] }
}

function encodeJsonPayload(data: NoteBodyV2): string {
  const json = JSON.stringify(data)
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
  }
  // RN fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { encode } = require('base-64') as typeof import('base-64')
  return encode(json)
}

function decodeJsonPayload(b64: string): NoteBodyV2 | null {
  try {
    let json: string
    if (typeof atob === 'function') {
      const binary = atob(b64)
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      json = new TextDecoder().decode(bytes)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { decode } = require('base-64') as typeof import('base-64')
      json = decode(b64)
    }
    const data = JSON.parse(json) as NoteBodyV2
    if (data?.version !== 2 || !Array.isArray(data.materials)) return null
    return {
      version: 2,
      collapsed: Boolean(data.collapsed),
      materials: data.materials.map((m) => ({
        id: m.id || newId('m'),
        html: m.html || '<p><br></p>',
        questions: Array.isArray(m.questions)
          ? m.questions.map((q) => ({
              id: q.id || newId('q'),
              html: q.html || '<p><br></p>',
            }))
          : [{ id: newId('q'), html: '<p><br></p>' }],
      })),
    }
  } catch {
    return null
  }
}

export function parseNoteBody(content: string): NoteBodyV2 | null {
  const match = content.match(JSON_RE)
  if (!match) return null
  return decodeJsonPayload(match[1])
}

/** 是否存有材料问答数据（含已折叠隐藏） */
export function isMaterialQaContent(content: string): boolean {
  const body = parseNoteBody(content)
  return Boolean(body?.materials?.length)
}

/** 是否应展示材料问答卡片 */
export function isMaterialQaVisible(content: string): boolean {
  const body = parseNoteBody(content)
  return Boolean(body?.materials?.length && !body.collapsed)
}

export function serializeNoteBody(body: NoteBodyV2): string {
  return `<!--notebox-json:${encodeJsonPayload(body)}-->`
}

/** 正文 HTML（不含材料问答 JSON） */
export function extractFreeformHtml(content: string): string {
  return normalizeToHtml(content)
}

function isBlankHtml(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return !text
}

/** 将材料问答转为可读 HTML，用于紧急恢复到正文 */
export function materialsToReadableHtml(body: NoteBodyV2): string {
  const parts: string[] = []
  body.materials.forEach((m, mi) => {
    const materialHtml = (m.html || '').trim()
    if (materialHtml && !isBlankHtml(materialHtml)) {
      if (body.materials.length > 1) {
        parts.push(`<h2>材料 ${mi + 1}</h2>`)
      }
      parts.push(materialHtml)
    }
    m.questions.forEach((q, qi) => {
      const qHtml = (q.html || '').trim()
      if (qHtml && !isBlankHtml(qHtml)) {
        parts.push(`<h3>问题 ${qi + 1}</h3>`)
        parts.push(qHtml)
      }
    })
  })
  return parts.join('') || '<p><br></p>'
}

/** 内容丰富度：用于防止空内容覆盖、以及挑选更完整的版本 */
export function contentScore(content: string): number {
  const html = content.replace(JSON_RE, '')
  let score = html.length
  score += (html.match(/<img\b/gi) || []).length * 5000
  score += (html.match(/[\u4e00-\u9fff]/g) || []).length * 3
  if (isBlankHtml(html) && !/<img\b/i.test(html)) return 0
  return score
}

export function isEffectivelyEmptyContent(content: string): boolean {
  return contentScore(content) < 20
}

/**
 * 把旧版「材料问答 JSON」展平为普通 HTML 正文，去掉 notebox-json。
 * 之后只使用单一文本框编辑。
 */
export function flattenNoteContentToHtml(content: string): string {
  const free = extractFreeformHtml(content)
  const body = parseNoteBody(content)
  if (!body?.materials?.length) return free || '<p><br></p>'

  const fromMaterials = materialsToReadableHtml(body)
  const freeScore = contentScore(free)
  const matScore = contentScore(fromMaterials)

  if (matScore === 0) return free || '<p><br></p>'
  if (freeScore === 0) return fromMaterials
  if (matScore >= freeScore) {
    // 材料更丰富：以材料为主；正文非空则放在前面
    if (freeScore > 20) return `${free}\n${fromMaterials}`
    return fromMaterials
  }
  // 正文更丰富，材料作为补充
  return `${free}\n${fromMaterials}`
}

/** 将自由文本与可选材料问答合并为 note.content */
export function joinContentParts(html: string, body: NoteBodyV2 | null): string {
  const clean = (html || '').replace(JSON_RE, '').trim() || '<p><br></p>'
  if (!body) return clean
  return `${clean}\n${serializeNoteBody(body)}`
}

/** 在保留原有文本的前提下附加 / 展开材料问答卡片 */
export function attachMaterialQa(content: string): string {
  const existing = parseNoteBody(content)
  if (existing?.materials.length) {
    // 仅展开，绝不丢弃已有材料内容
    return joinContentParts(extractFreeformHtml(content), {
      ...existing,
      collapsed: false,
    })
  }
  return joinContentParts(extractFreeformHtml(content), {
    ...createEmptyBodyV2(),
    collapsed: false,
  })
}

/**
 * 「切换回去」：只折叠隐藏材料问答 UI，保留全部材料/问题数据与正文。
 * 不再删除 JSON。
 */
export function detachMaterialQa(content: string): string {
  const existing = parseNoteBody(content)
  const html = extractFreeformHtml(content)
  if (!existing?.materials.length) return html
  return joinContentParts(html, { ...existing, collapsed: true })
}

/** 更新材料问答部分，不改动自由文本 */
export function updateMaterialBody(content: string, body: NoteBodyV2): string {
  const prev = parseNoteBody(content)
  return joinContentParts(extractFreeformHtml(content), {
    ...body,
    collapsed: body.collapsed ?? prev?.collapsed ?? false,
  })
}

/**
 * 若正文里材料问答已丢失，但备份里还有，则合并回 content。
 * 同时把可读内容补进空白正文，避免「切换后什么都没有」。
 */
export function restoreMaterialFromBackup(
  content: string,
  backup: NoteBodyV2 | null | undefined,
): { content: string; restored: boolean } {
  if (!backup?.materials?.length) return { content, restored: false }
  if (parseNoteBody(content)?.materials?.length) {
    return { content, restored: false }
  }
  let html = extractFreeformHtml(content)
  if (isBlankHtml(html)) {
    html = materialsToReadableHtml(backup)
  }
  return {
    content: joinContentParts(html, { ...backup, collapsed: false }),
    restored: true,
  }
}

/** @deprecated 请用 attachMaterialQa / parseNoteBody；不再把正文塞进材料 */
export function ensureMaterialBody(content: string): NoteBodyV2 {
  const parsed = parseNoteBody(content)
  if (parsed && parsed.materials.length) return parsed
  return createEmptyBodyV2()
}

/** Convert legacy Markdown / plain text into HTML for the rich editor. */
export function normalizeToHtml(content: string): string {
  const { body } = splitTitleMeta(content)
  const withoutJson = body.replace(JSON_RE, '').trim()
  const raw = withoutJson.trim()
  if (!raw) return '<p><br></p>'

  if (/<[a-z][\s\S]*>/i.test(raw)) return raw

  const lines = withoutJson.replace(/\r\n/g, '\n').split('\n')
  const parts: string[] = []
  let para: string[] = []

  const flushPara = () => {
    if (!para.length) return
    const text = para.join(' ').trim()
    if (text) parts.push(`<p>${escapeHtml(text)}</p>`)
    para = []
  }

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushPara()
      const level = heading[1].length
      parts.push(`<h${level}>${escapeHtml(heading[2].trim())}</h${level}>`)
      continue
    }
    if (!line.trim()) {
      flushPara()
      continue
    }
    para.push(inlineMd(line))
  }
  flushPara()

  return parts.join('') || '<p><br></p>'
}

export function splitTitleMeta(content: string): {
  title?: string
  parentId?: string | null
  sortOrder?: number
  body: string
} {
  let body = content
  let title: string | undefined
  let parentId: string | null | undefined
  let sortOrder: number | undefined

  const titleMatch = body.match(TITLE_RE)
  if (titleMatch) {
    title = titleMatch[1].trim()
    body = body.replace(TITLE_RE, '')
  }
  const parentMatch = body.match(PARENT_RE)
  if (parentMatch) {
    const p = parentMatch[1].trim()
    parentId = p || null
    body = body.replace(PARENT_RE, '')
  }
  const orderMatch = body.match(ORDER_RE)
  if (orderMatch) {
    sortOrder = Number(orderMatch[1])
    body = body.replace(ORDER_RE, '')
  }

  return { title, parentId, sortOrder, body: body.trimStart() }
}

export function withNoteMeta(note: Pick<Note, 'title' | 'content' | 'parentId' | 'sortOrder'>): string {
  const safeTitle = note.title.replace(/-->/g, '').trim() || '未命名'
  const lines = [`<!--notebox-title: ${safeTitle}-->`]
  if (note.parentId) {
    lines.push(`<!--notebox-parent: ${note.parentId.replace(/-->/g, '')}-->`)
  }
  if (typeof note.sortOrder === 'number') {
    lines.push(`<!--notebox-order: ${note.sortOrder}-->`)
  }

  const html = flattenNoteContentToHtml(note.content)
  lines.push(html)
  return lines.join('\n')
}

/** @deprecated use withNoteMeta */
export function withTitleMeta(title: string, htmlBody: string): string {
  return withNoteMeta({ title, content: htmlBody, parentId: null })
}

export function extractTitleFromContent(content: string, fallback: string): string {
  const { title, body } = splitTitleMeta(content)
  if (title) return title
  const h1 = body.match(/<h1[^>]*>(.*?)<\/h1>/i)
  if (h1) return stripTags(h1[1]).trim() || fallback
  const md = body.match(/^#\s+(.+)$/m)
  if (md) return md[1].trim() || fallback
  return fallback
}

export function extractMetaFromContent(content: string): {
  title?: string
  parentId?: string | null
  sortOrder?: number
  body: string
} {
  return splitTitleMeta(content)
}

function inlineMd(text: string): string {
  let s = escapeHtml(text)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return s
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}
