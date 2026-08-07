import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppSettings, Note, NoteBodyV2 } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const SETTINGS_KEY = 'notebox.settings'
const NOTES_KEY = 'notebox.notes'
const SELECTED_KEY = 'notebox.selectedId'
const MATERIAL_BACKUP_KEY = 'notebox.materialBackups'

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export async function loadNotes(): Promise<Note[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Note[]
  } catch {
    return []
  }
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

export async function loadSelectedId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_KEY)
}

export async function saveSelectedId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(SELECTED_KEY, id)
  else await AsyncStorage.removeItem(SELECTED_KEY)
}

export function isConfigured(settings: AppSettings): boolean {
  return Boolean(
    settings.token.trim() &&
      settings.owner.trim() &&
      settings.repo.trim() &&
      settings.branch.trim() &&
      settings.notesPath.trim(),
  )
}

export type MaterialBackupMap = Record<
  string,
  { body: NoteBodyV2; updatedAt: number }
>

export async function loadMaterialBackups(): Promise<MaterialBackupMap> {
  try {
    const raw = await AsyncStorage.getItem(MATERIAL_BACKUP_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as MaterialBackupMap
  } catch {
    return {}
  }
}

export async function saveMaterialBackup(
  noteId: string,
  body: NoteBodyV2,
): Promise<void> {
  if (!body?.materials?.length) return
  const all = await loadMaterialBackups()
  all[noteId] = { body: { ...body, collapsed: false }, updatedAt: Date.now() }
  await AsyncStorage.setItem(MATERIAL_BACKUP_KEY, JSON.stringify(all))
}

/** 从当前笔记快照刷新材料备份（有材料才写入） */
export async function syncMaterialBackupsFromNotes(notes: Note[]): Promise<void> {
  const { parseNoteBody } = await import('./content')
  const all = await loadMaterialBackups()
  let changed = false
  for (const note of notes) {
    if (note.deleted) continue
    const body = parseNoteBody(note.content)
    if (!body?.materials?.length) continue
    const prev = all[note.id]
    if (!prev || prev.updatedAt <= note.updatedAt) {
      all[note.id] = {
        body: { ...body, collapsed: false },
        updatedAt: note.updatedAt || Date.now(),
      }
      changed = true
    }
  }
  if (changed) {
    await AsyncStorage.setItem(MATERIAL_BACKUP_KEY, JSON.stringify(all))
  }
}
