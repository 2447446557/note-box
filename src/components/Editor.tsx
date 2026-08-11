import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import type { AppSettings, Note } from '../types'
import { flattenNoteContentToHtml } from '../lib/content'
import { colors, radius, space } from '../theme'
import { RichTextEditor } from './RichTextEditor'

interface Props {
  note: Note | null
  settings: AppSettings
  onChange: (content: string) => void
  onRename: (title: string) => void
  onOpenList: () => void
  onStatus?: (message: string, error?: boolean) => void
}

export function Editor({
  note,
  settings,
  onChange,
  onRename,
  onOpenList,
  onStatus,
}: Props) {
  const { width } = useWindowDimensions()
  const isWide = width >= 860

  if (!note) {
    return (
      <View style={styles.emptyWrap}>
        {!isWide && (
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={onOpenList}
          >
            <Text style={styles.backBtnText}>← 笔记列表</Text>
          </Pressable>
        )}
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>选择或新建一篇笔记</Text>
          <Text style={styles.emptyDesc}>
            内容先保存在本地，再同步到 GitHub。断网时也可继续编辑。
          </Text>
          {!isWide && (
            <Pressable
              style={({ pressed }) => [
                styles.emptyCta,
                pressed && styles.emptyCtaPressed,
              ]}
              onPress={onOpenList}
            >
              <Text style={styles.emptyCtaText}>打开列表</Text>
            </Pressable>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.editor}>
      <View style={styles.toolbar}>
        {!isWide && (
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={onOpenList}
            hitSlop={8}
          >
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
        )}
        <TextInput
          style={styles.titleInput}
          value={note.title}
          onChangeText={onRename}
          placeholder="无标题"
          placeholderTextColor={colors.faint}
        />
        {note.dirty ? <View style={styles.dirtyDot} /> : null}
      </View>

      <RichTextEditor
        editorKey={note.id}
        html={flattenNoteContentToHtml(note.content)}
        settings={settings}
        onChange={onChange}
        onStatus={onStatus}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    backgroundColor: colors.surface,
    minHeight: 0,
  },
  emptyWrap: {
    flex: 1,
    padding: space.lg,
    backgroundColor: colors.surface,
  },
  emptyCard: {
    marginTop: 72,
    alignSelf: 'center',
    maxWidth: 360,
    paddingHorizontal: space.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: space.sm,
  },
  emptyDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: space.xl,
    alignSelf: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  emptyCtaPressed: { backgroundColor: colors.accentPressed },
  emptyCtaText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  titleInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    paddingVertical: 6,
    letterSpacing: -0.2,
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.surfaceHover },
  backBtnText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 15,
  },
  dirtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warn,
    marginRight: 4,
  },
})
