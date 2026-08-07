import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { ConflictModal } from './src/components/ConflictModal'
import { DeleteConfirmModal } from './src/components/DeleteConfirmModal'
import { Editor } from './src/components/Editor'
import { NoteList } from './src/components/NoteList'
import { SettingsModal } from './src/components/SettingsModal'
import { SyncStatusBar } from './src/components/SyncStatusBar'
import { flattenNoteContentToHtml } from './src/lib/content'
import { applyEmergencyRestore } from './src/lib/emergencyRestore'
import { notePath, slugifyTitle } from './src/lib/github'
import {
  isConfigured,
  loadNotes,
  loadSelectedId,
  loadSettings,
  saveNotes,
  saveSelectedId,
  saveSettings,
} from './src/lib/storage'
import { SyncController } from './src/lib/sync'
import { colors } from './src/theme'
import type { AppSettings, ConflictState, Note, SyncStatus } from './src/types'
import { DEFAULT_SETTINGS } from './src/types'

function createBlankNote(
  settings: AppSettings,
  opts?: { parentId?: string | null; title?: string },
): Note {
  const stamp = new Date()
  const label = opts?.title ?? `错题本 ${stamp.toLocaleString('zh-CN')}`
  const id = `${slugifyTitle(label)}-${stamp.getTime()}.md`
  return {
    id,
    path: notePath(settings, id),
    title: label,
    content: '<p><br></p>',
    updatedAt: Date.now(),
    dirty: true,
    parentId: opts?.parentId ?? null,
    sortOrder: Date.now(),
  }
}

function collectSubtreeIds(rootId: string, notes: Note[]): string[] {
  const ids = [rootId]
  const walk = (id: string) => {
    for (const n of notes) {
      if (n.deleted) continue
      if (n.parentId === id) {
        ids.push(n.id)
        walk(n.id)
      }
    }
  }
  walk(rootId)
  return ids
}

export default function App() {
  const { width } = useWindowDimensions()
  const isWide = width >= 860

  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<SyncStatus>('unconfigured')
  const [statusMessage, setStatusMessage] = useState<string>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const syncRef = useRef<SyncController | null>(null)
  const selectedIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const [loadedSettings, loadedNotes, loadedSelected] = await Promise.all([
        loadSettings(),
        loadNotes(),
        loadSelectedId(),
      ])
      if (cancelled) return

      const emergency = applyEmergencyRestore(loadedNotes)
      let notes = emergency.notes.map((n) => {
        const flat = flattenNoteContentToHtml(n.content)
        if (flat === n.content) return n
        return { ...n, content: flat, dirty: true, updatedAt: Date.now() }
      })
      const restored = emergency.restored

      if (restored > 0 || notes.some((n) => n.dirty)) await saveNotes(notes)

      setSettings(loadedSettings)
      setNotes(notes)
      setSelectedId(loadedSelected)
      if (!isConfigured(loadedSettings)) {
        setStatus('unconfigured')
        setStatusMessage(
          restored > 0
            ? `已恢复 ${restored} 篇笔记内容到文本框`
            : '本地笔记可用，配置 GitHub 后可云端同步',
        )
      } else if (notes.some((n) => n.dirty || n.deleted)) {
        setStatus('pending')
        setStatusMessage(
          restored > 0
            ? `已恢复 ${restored} 篇内容，${notes.filter((n) => n.dirty || n.deleted).length} 篇待推送`
            : `已加载本地笔记，${notes.filter((n) => n.dirty || n.deleted).length} 篇待推送`,
        )
      } else {
        setStatus('idle')
        setStatusMessage(
          notes.length ? `已加载本地 ${notes.length} 篇笔记` : '本地暂无笔记',
        )
      }
      setSettingsOpen(!isConfigured(loadedSettings))
      setReady(true)

      const controller = new SyncController(loadedSettings, notes, {
        onStatus: (next, message) => {
          setStatus(next)
          setStatusMessage(message)
        },
        onNotes: (next) => setNotes(next),
        onConflict: (next) => setConflict(next),
      })
      syncRef.current = controller

      if (isConfigured(loadedSettings)) {
        const pulled = await controller.pull()
        // pull 后若仍空，再套一次紧急恢复
        const again = applyEmergencyRestore(pulled)
        if (again.restored > 0) {
          setNotes(again.notes)
          void saveNotes(again.notes)
          syncRef.current?.updateNotes(again.notes)
          setStatusMessage(`已从备份恢复 ${again.restored} 篇笔记内容`)
        }
        if (!selectedIdRef.current && again.notes.length > 0) {
          const prefer =
            again.notes.find((n) => n.id.includes('09-35-46')) ?? again.notes[0]
          setSelectedId(prefer.id)
          await saveSelectedId(prefer.id)
        }
        void controller.flushPending()
      }
    })()

    return () => {
      cancelled = true
      syncRef.current?.dispose()
      syncRef.current = null
    }
  }, [])

  useEffect(() => {
    syncRef.current?.updateSettings(settings)
  }, [settings])

  useEffect(() => {
    syncRef.current?.updateNotes(notes)
    if (ready) void saveNotes(notes)
  }, [notes, ready])

  useEffect(() => {
    if (ready) void saveSelectedId(selectedId)
  }, [selectedId, ready])

  const selected = notes.find((n) => n.id === selectedId && !n.deleted) ?? null
  const deleteTarget = notes.find((n) => n.id === deleteTargetId) ?? null
  const deleteChildCount = deleteTarget
    ? collectSubtreeIds(deleteTarget.id, notes).length - 1
    : 0

  function handleCreate() {
    const note = createBlankNote(settings)
    setNotes((prev) => {
      const next = [note, ...prev]
      void syncRef.current?.saveLocalThenPush(note.id, next)
      return next
    })
    setSelectedId(note.id)
    setListOpen(false)
  }

  function handleCreateChild(parentId: string) {
    const parent = notes.find((n) => n.id === parentId && !n.deleted)
    const note = createBlankNote(settings, {
      parentId,
      title: parent ? `${parent.title || '未命名'} · 子项` : undefined,
    })
    setNotes((prev) => {
      const next = [note, ...prev]
      void syncRef.current?.saveLocalThenPush(note.id, next)
      return next
    })
    setSelectedId(note.id)
    setListOpen(false)
  }

  function handleReparent(noteId: string, newParentId: string | null) {
    const next = notes.map((n) =>
      n.id === noteId
        ? {
            ...n,
            parentId: newParentId,
            sortOrder: Date.now(),
            dirty: true,
            updatedAt: Date.now(),
          }
        : n,
    )
    setNotes(next)
    void syncRef.current?.saveLocalThenPush(noteId, next)
  }

  function handleDeleteRequest(id: string) {
    setDeleteTargetId(id)
    setDeleteStep(1)
  }

  function handleDeleteCancel() {
    setDeleteTargetId(null)
    setDeleteStep(1)
  }

  function handleDeleteConfirmStep() {
    if (!deleteTargetId) return
    if (deleteStep === 1) {
      setDeleteStep(2)
      return
    }

    const ids = new Set(collectSubtreeIds(deleteTargetId, notes))
    const next = notes.map((n) =>
      ids.has(n.id)
        ? { ...n, deleted: true, dirty: true, updatedAt: Date.now() }
        : n,
    )
    setNotes(next)
    if (selectedId && ids.has(selectedId)) {
      const remaining = next.filter((n) => !n.deleted)
      setSelectedId(remaining[0]?.id ?? null)
    }
    for (const id of ids) {
      void syncRef.current?.saveLocalThenPush(id, next)
    }
    setDeleteTargetId(null)
    setDeleteStep(1)
  }

  function handleChange(content: string) {
    if (!selected) return
    const next = notes.map((n) =>
      n.id === selected.id
        ? { ...n, content, dirty: true, updatedAt: Date.now() }
        : n,
    )
    setNotes(next)
    void syncRef.current?.saveLocalThenPush(selected.id, next)
  }

  function handleRename(title: string) {
    if (!selected) return
    const next = notes.map((n) =>
      n.id === selected.id
        ? { ...n, title, dirty: true, updatedAt: Date.now() }
        : n,
    )
    setNotes(next)
    void syncRef.current?.saveLocalThenPush(selected.id, next)
  }

  async function handleSaveSettings(nextSettings: AppSettings) {
    await saveSettings(nextSettings)
    setSettings(nextSettings)
    setSettingsOpen(false)
    syncRef.current?.updateSettings(nextSettings)
    if (isConfigured(nextSettings)) {
      const pulled = await syncRef.current?.pull()
      if (pulled && pulled.length > 0 && !pulled.some((n) => n.id === selectedId)) {
        setSelectedId(pulled[0].id)
      }
      void syncRef.current?.flushPending()
    } else {
      setStatus('pending')
      setStatusMessage('已保存到本地（未配置 GitHub）')
    }
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.teal} size="large" />
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.atmosphere} />
        <SyncStatusBar
          status={status}
          message={statusMessage}
          onSync={() => void syncRef.current?.pushNow(selected?.dirty ? selected.id : undefined)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <View style={styles.main}>
          <NoteList
            notes={notes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={handleCreate}
            onCreateChild={handleCreateChild}
            onDelete={handleDeleteRequest}
            onReparent={handleReparent}
            mobileOpen={isWide ? false : listOpen}
            onCloseMobile={() => setListOpen(false)}
            collapsed={isWide ? sidebarCollapsed : false}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          />
          <Editor
            note={selected}
            settings={settings}
            onChange={handleChange}
            onRename={handleRename}
            onOpenList={() => setListOpen(true)}
            onStatus={(message, error) => {
              if (!message) return
              setStatus(error ? 'error' : 'pending')
              setStatusMessage(message)
            }}
          />
        </View>
        <SettingsModal
          open={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(s) => void handleSaveSettings(s)}
        />
        <ConflictModal
          conflict={conflict}
          onKeepLocal={() => {
            if (conflict) void syncRef.current?.resolveConflictKeepLocal(conflict)
          }}
          onKeepRemote={() => {
            if (conflict) void syncRef.current?.resolveConflictKeepRemote(conflict)
          }}
          onClose={() => setConflict(null)}
        />
        <DeleteConfirmModal
          open={Boolean(deleteTarget)}
          title={deleteTarget?.title ?? ''}
          childCount={deleteChildCount}
          step={deleteStep}
          onCancel={handleDeleteCancel}
          onConfirmStep={handleDeleteConfirmStep}
        />
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgMid,
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgTop,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMid,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    paddingTop: 2,
  },
})
