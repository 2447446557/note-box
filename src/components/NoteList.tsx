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
import { colors, radius, space } from '../theme'

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
          <Text style={styles.brand}>笔记</Text>
          <Text style={styles.brandSub}>本地优先 · GitHub 同步</Text>
        </View>
        {onToggleCollapse ? (
          <Pressable
            style={({ pressed }) => [styles.collapseBtn, pressed && styles.pressed]}
            onPress={onToggleCollapse}
            accessibilityLabel="收缩侧边栏"
          >
            <Text style={styles.collapseBtnText}>⟨</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.closeMobileBtn, pressed && styles.pressed]}
            onPress={onCloseMobile}
          >
            <Text style={styles.closeMobileText}>关闭</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
          ]}
          onPress={onCreate}
        >
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
              padding: '6px 14px 10px',
              fontSize: 11,
              color: colors.muted,
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            },
          },
          '拖到此处变为顶级 · 拖到条目上成为子笔记',
        )
      ) : (
        <Text style={styles.dragHint}>点「子」可新建子笔记</Text>
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
    width: 280,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
  },
  collapsedPane: {
    width: 48,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingTop: space.lg,
    gap: space.sm,
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHover,
  },
  expandBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  collapsedCreate: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  collapsedCreateText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  closeMobileBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  closeMobileText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  pressed: { backgroundColor: colors.surfaceHover },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '88%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  sidebar: { flex: 1, backgroundColor: colors.surface },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  brand: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  brandSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  primaryBtnPressed: { backgroundColor: colors.accentPressed },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  dragHint: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    fontSize: 11,
    color: colors.faint,
  },
  listContent: { paddingHorizontal: space.sm, paddingBottom: 32 },
  empty: {
    padding: space.lg,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  itemWrap: {
    position: 'relative',
    marginBottom: 2,
    borderRadius: radius.md,
  },
  itemDropTarget: {
    backgroundColor: colors.accentSoft,
  },
  item: {
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 72,
    borderRadius: radius.md,
  },
  itemActive: {
    backgroundColor: colors.surfaceHover,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nestMark: { color: colors.faint, fontSize: 12 },
  itemTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 11,
    color: colors.faint,
  },
  actions: {
    position: 'absolute',
    right: 4,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  iconBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  deleteText: {
    fontSize: 18,
    color: colors.faint,
  },
})
