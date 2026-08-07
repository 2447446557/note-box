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
import { colors } from '../theme'
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
          <Pressable style={styles.ghostBtn} onPress={onOpenList}>
            <Text style={styles.ghostBtnText}>笔记列表</Text>
          </Pressable>
        )}
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>选择或新建一篇错题本</Text>
          <Text style={styles.emptyDesc}>
            内容先保存在本地，再自动推送到 GitHub。网络异常时不影响继续编辑。
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.editor}>
      <View style={styles.toolbar}>
        {!isWide && (
          <Pressable style={styles.ghostBtn} onPress={onOpenList}>
            <Text style={styles.ghostBtnText}>列表</Text>
          </Pressable>
        )}
        <TextInput
          style={styles.titleInput}
          value={note.title}
          onChangeText={onRename}
          placeholder="标题（不显示 #）"
          placeholderTextColor={colors.muted}
        />
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
    backgroundColor: 'rgba(255,255,255,0.55)',
    minHeight: 0,
    borderTopLeftRadius: 16,
    overflow: 'hidden',
  },
  emptyWrap: { flex: 1, padding: 16 },
  emptyCard: {
    marginTop: 48,
    alignSelf: 'center',
    maxWidth: 420,
    padding: 28,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  titleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    paddingVertical: 4,
  },
  ghostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(46,139,128,0.1)',
  },
  ghostBtnText: {
    color: colors.tealDark,
    fontWeight: '700',
    fontSize: 13,
  },
})
