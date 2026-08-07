import { createElement, useMemo, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import type { Note } from '../types'
import { colors } from '../theme'

interface Props {
  notes: Note[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onCreateChild: (parentId: string) => void
  onDelete: (id: string) => void
  onReparent: (noteId: string, newParentId: string | null) => void
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

interface TreeNode {
  note: Note
  children: TreeNode[]
}

function formatTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts)
  } catch {
    return ''
  }
}

function sortNotes(a: Note, b: Note): number {
  const ao = a.sortOrder ?? a.updatedAt
  const bo = b.sortOrder ?? b.updatedAt
  if (ao !== bo) return ao - bo
  return b.updatedAt - a.updatedAt
}

function buildTree(notes: Note[]): TreeNode[] {
  const visible = notes.filter((n) => !n.deleted)
  const byId = new Map(visible.map((n) => [n.id, n]))
  const childrenMap = new Map<string | null, Note[]>()

  for (const n of visible) {
    const parent =
      n.parentId && byId.has(n.parentId) ? n.parentId : null
    const list = childrenMap.get(parent) ?? []
    list.push(n)
    childrenMap.set(parent, list)
  }

  const walk = (parentId: string | null): TreeNode[] => {
    const list = (childrenMap.get(parentId) ?? []).slice().sort(sortNotes)
    return list.map((note) => ({
      note,
      children: walk(note.id),
    }))
  }

  return walk(null)
}

function collectDescendantIds(rootId: string, notes: Note[]): Set<string> {
  const ids = new Set<string>()
  const walk = (id: string) => {
    for (const n of notes) {
      if (n.deleted) continue
      if (n.parentId === id) {
        ids.add(n.id)
        walk(n.id)
      }
    }
  }
  walk(rootId)
  return ids
}

function flattenTree(nodes: TreeNode[], depth = 0): { note: Note; depth: number }[] {
  const out: { note: Note; depth: number }[] = []
  for (const node of nodes) {
    out.push({ note: node.note, depth })
    out.push(...flattenTree(node.children, depth + 1))
  }
  return out
}

function ListBody({
  notes,
  selectedId,
  onSelect,
  onCreate,
  onCreateChild,
  onDelete,
  onReparent,
  onCloseMobile,
  onToggleCollapse,
}: Omit<Props, 'mobileOpen' | 'collapsed'>) {
  const tree = useMemo(() => buildTree(notes), [notes])
  const flat = useMemo(() => flattenTree(tree), [tree])
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  function canDropOnto(targetId: string, sourceId: string): boolean {
    if (sourceId === targetId) return false
    const descendants = collectDescendantIds(sourceId, notes)
    if (descendants.has(targetId)) return false
    return true
  }

  function handleDrop(targetId: string | null) {
    if (!draggingId) return
    if (targetId && !canDropOnto(targetId, draggingId)) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    const source = notes.find((n) => n.id === draggingId)
    if (!source) return
    const nextParent = targetId
    if ((source.parentId ?? null) === nextParent) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    onReparent(draggingId, nextParent)
    setDraggingId(null)
    setDragOverId(null)
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>Note-box</Text>
          <Text style={styles.brandSub}>错题本 · 可嵌套选项卡</Text>
        </View>
        {onToggleCollapse ? (
          <Pressable
            style={styles.collapseBtn}
            onPress={onToggleCollapse}
            accessibilityLabel="收缩侧边栏"
          >
            <Text style={styles.collapseBtnText}>⟨</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.primaryBtn} onPress={onCreate}>
          <Text style={styles.primaryBtnText}>新建</Text>
        </Pressable>
      </View>

      {Platform.OS === 'web' ? (
        createElement(
          'div',
          {
            onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
            onDrop: (e: { preventDefault: () => void }) => {
              e.preventDefault()
              handleDrop(null)
            },
            style: {
              padding: '4px 10px 8px',
              fontSize: 11,
              color: colors.muted,
              borderBottom: '1px solid rgba(29,43,48,0.08)',
            },
          },
          '拖到此处可变为顶级 · 拖到选项卡上可成为其子选项卡',
        )
      ) : (
        <Text style={styles.dragHint}>长按暂不支持拖动，可用「子」新建子选项卡</Text>
      )}

      <ScrollView contentContainerStyle={styles.listContent}>
        {flat.length === 0 ? (
          <Text style={styles.empty}>还没有错题本，点「新建」开始。</Text>
        ) : (
          flat.map(({ note, depth }) => {
            const isOver = dragOverId === note.id
            const body = (
              <View
                style={[
                  styles.itemWrap,
                  { marginLeft: depth * 14 },
                  isOver && styles.itemDropTarget,
                ]}
              >
                <Pressable
                  style={[styles.item, selectedId === note.id && styles.itemActive]}
                  onPress={() => {
                    onSelect(note.id)
                    onCloseMobile()
                  }}
                >
                  <View style={styles.titleRow}>
                    {depth > 0 ? <Text style={styles.nestMark}>└</Text> : null}
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {note.title || '未命名'}
                    </Text>
                    {note.dirty ? <View style={styles.dirty} /> : null}
                  </View>
                  <Text style={styles.itemMeta}>{formatTime(note.updatedAt)}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => onCreateChild(note.id)}
                    accessibilityLabel="新建子选项卡"
                  >
                    <Text style={styles.iconBtnText}>子</Text>
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => onDelete(note.id)}>
                    <Text style={styles.deleteText}>×</Text>
                  </Pressable>
                </View>
              </View>
            )

            if (Platform.OS !== 'web') {
              return <View key={note.id}>{body}</View>
            }

            return createElement(
              'div',
              {
                key: note.id,
                draggable: true,
                onDragStart: (e: {
                  dataTransfer?: { setData: (k: string, v: string) => void; effectAllowed: string }
                }) => {
                  setDraggingId(note.id)
                  e.dataTransfer?.setData('text/plain', note.id)
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                },
                onDragEnd: () => {
                  setDraggingId(null)
                  setDragOverId(null)
                },
                onDragOver: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (draggingId && canDropOnto(note.id, draggingId)) {
                    setDragOverId(note.id)
                  }
                },
                onDragLeave: () => {
                  setDragOverId((cur) => (cur === note.id ? null : cur))
                },
                onDrop: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDrop(note.id)
                },
                style: { cursor: 'grab' },
              },
              body,
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

export function NoteList(props: Props) {
  const { width } = useWindowDimensions()
  const isWide = width >= 860

  if (isWide) {
    if (props.collapsed) {
      return (
        <View style={styles.collapsedPane}>
          <Pressable
            style={styles.expandBtn}
            onPress={props.onToggleCollapse}
            accessibilityLabel="展开侧边栏"
          >
            <Text style={styles.expandBtnText}>⟩</Text>
          </Pressable>
          <Pressable style={styles.collapsedCreate} onPress={props.onCreate}>
            <Text style={styles.collapsedCreateText}>+</Text>
          </Pressable>
        </View>
      )
    }
    return (
      <View style={styles.desktopPane}>
        <ListBody {...props} />
      </View>
    )
  }

  return (
    <Modal visible={props.mobileOpen} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={props.onCloseMobile} />
      <View style={styles.drawer}>
        <ListBody {...props} />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  desktopPane: {
    width: 300,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
  },
  collapsedPane: {
    width: 44,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingTop: 14,
    gap: 10,
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 139, 128, 0.14)',
  },
  expandBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.tealDark,
  },
  collapsedCreate: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
  },
  collapsedCreateText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(29, 43, 48, 0.08)',
  },
  collapseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '86%',
    maxWidth: 320,
    backgroundColor: colors.paper,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(22, 34, 40, 0.28)',
  },
  sidebar: { flex: 1 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  brandSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  dragHint: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    fontSize: 11,
    color: colors.muted,
  },
  listContent: { paddingHorizontal: 8, paddingBottom: 24 },
  empty: {
    padding: 14,
    color: colors.muted,
    fontSize: 14,
  },
  itemWrap: {
    position: 'relative',
    marginBottom: 4,
    borderRadius: 10,
  },
  itemDropTarget: {
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: 'rgba(46, 139, 128, 0.12)',
  },
  item: {
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 64,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: 'rgba(46, 139, 128, 0.14)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nestMark: { color: colors.muted, fontSize: 12 },
  itemTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  dirty: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warn,
  },
  itemMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.muted,
  },
  actions: {
    position: 'absolute',
    right: 2,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tealDark,
  },
  deleteText: {
    fontSize: 20,
    color: colors.muted,
  },
})
