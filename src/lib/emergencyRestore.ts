import type { Note } from '../types'
import { contentScore, flattenNoteContentToHtml, parseNoteBody } from './content'
import emergencyData from './emergencyRestoreData.json'

interface EmergencyNote {
  id: string
  title?: string
  content: string
  parentId?: string | null
  sortOrder?: number
  path?: string
}

const EMERGENCY = emergencyData as EmergencyNote[]

/**
 * 从内置 GitHub 历史备份恢复正文，并统一展平为普通 HTML 文本框内容。
 */
export function applyEmergencyRestore(notes: Note[]): {
  notes: Note[]
  restored: number
} {
  const byId = new Map(EMERGENCY.map((n) => [n.id, n]))
  let restored = 0

  const next = notes.map((note) => {
    const snap = byId.get(note.id)
    const localHtml = flattenNoteContentToHtml(note.content)
    let nextHtml = localHtml

    if (snap) {
      const snapHtml = flattenNoteContentToHtml(snap.content)
      if (contentScore(snapHtml) > contentScore(localHtml)) {
        nextHtml = snapHtml
        restored += 1
      }
    }

    const hadJson = Boolean(parseNoteBody(note.content))
    if (!hadJson && nextHtml === note.content) return note

    return {
      ...note,
      content: nextHtml,
      dirty: true,
      updatedAt: Date.now(),
      title: note.title?.trim() ? note.title : snap?.title || note.title,
      parentId: note.parentId ?? snap?.parentId ?? null,
      sortOrder: note.sortOrder ?? snap?.sortOrder,
    }
  })

  for (const snap of EMERGENCY) {
    if (next.some((n) => n.id === snap.id && !n.deleted)) continue
    next.unshift({
      id: snap.id,
      path: snap.path || `notes/${snap.id}`,
      title: snap.title || '恢复的错题本',
      content: flattenNoteContentToHtml(snap.content),
      updatedAt: Date.now(),
      dirty: true,
      parentId: snap.parentId ?? null,
      sortOrder: snap.sortOrder,
    })
    restored += 1
  }

  return { notes: next, restored }
}
