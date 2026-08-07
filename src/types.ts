export interface AppSettings {
  token: string
  owner: string
  repo: string
  branch: string
  notesPath: string
}

export interface Note {
  id: string
  path: string
  title: string
  content: string
  sha?: string
  updatedAt: number
  dirty: boolean
  deleted?: boolean
  /** 父选项卡 id；空表示顶级 */
  parentId?: string | null
  /** 同级排序，越小越靠前 */
  sortOrder?: number
}

export interface QuestionItem {
  id: string
  html: string
}

export interface MaterialUnit {
  id: string
  html: string
  questions: QuestionItem[]
}

/** 错题本结构化正文（材料 + 多问题） */
export interface NoteBodyV2 {
  version: 2
  materials: MaterialUnit[]
  /** true 时仅隐藏材料问答 UI，数据仍保留 */
  collapsed?: boolean
}

export type SyncStatus =
  | 'unconfigured'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'pending'
  | 'error'
  | 'conflict'

export interface ConflictState {
  noteId: string
  localContent: string
  remoteContent: string
  remoteSha: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  notesPath: 'notes',
}
