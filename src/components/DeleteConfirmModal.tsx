import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

interface Props {
  open: boolean
  title: string
  childCount?: number
  step: 1 | 2
  onCancel: () => void
  onConfirmStep: () => void
}

export function DeleteConfirmModal({
  open,
  title,
  childCount = 0,
  step,
  onCancel,
  onConfirmStep,
}: Props) {
  const isFirst = step === 1

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {isFirst ? '确认删除错题本？' : '再次确认删除'}
          </Text>
          <Text style={styles.hint}>
            {isFirst
              ? `是否确认要删除错题本「${title || '未命名'}」？${
                  childCount > 0 ? `\n其中包含 ${childCount} 个子选项卡，将一并删除。` : ''
                }\n\n请再确认一次后才会真正删除。`
              : `请再次确认：删除「${title || '未命名'}」后将从列表移除，并尝试同步删除云端文件。\n\n第二次确认后才会执行删除。`}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.ghost} onPress={onCancel}>
              <Text style={styles.ghostText}>取消</Text>
            </Pressable>
            <Pressable
              style={[styles.primary, !isFirst && styles.danger]}
              onPress={onConfirmStep}
            >
              <Text style={styles.primaryText}>
                {isFirst ? '确认删除（第 1 次）' : '确认删除（第 2 次）'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 34, 40, 0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  hint: {
    marginTop: 12,
    marginBottom: 16,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  ghost: { paddingHorizontal: 12, paddingVertical: 10 },
  ghostText: { color: colors.ink, fontWeight: '600' },
  primary: {
    backgroundColor: colors.teal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  danger: { backgroundColor: colors.danger },
  primaryText: { color: colors.white, fontWeight: '700' },
})
