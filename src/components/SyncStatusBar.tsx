import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SyncStatus } from '../types'
import { colors } from '../theme'

const LABELS: Record<SyncStatus, string> = {
  unconfigured: '未配置',
  idle: '本地就绪',
  syncing: '同步中',
  synced: '已同步',
  pending: '已存本地',
  error: '失败',
  conflict: '冲突',
}

interface Props {
  status: SyncStatus
  message?: string
  onSync: () => void
  onOpenSettings: () => void
}

const DOT_COLORS: Record<SyncStatus, { backgroundColor: string }> = {
  unconfigured: { backgroundColor: colors.muted },
  idle: { backgroundColor: colors.muted },
  syncing: { backgroundColor: colors.warn },
  synced: { backgroundColor: colors.teal },
  pending: { backgroundColor: colors.warn },
  error: { backgroundColor: colors.danger },
  conflict: { backgroundColor: colors.danger },
}

export function SyncStatusBar({ status, message, onSync, onOpenSettings }: Props) {
  return (
    <View style={styles.bar}>
      <View style={[styles.dot, DOT_COLORS[status]]} />
      <Text style={styles.text} numberOfLines={1}>
        {LABELS[status]}
        {message ? ` · ${message}` : ''}
      </Text>
      <Pressable style={styles.btn} onPress={onSync}>
        <Text style={styles.btnText}>立即同步</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={onOpenSettings}>
        <Text style={styles.btnText}>设置</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
  },
  text: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
  },
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
})
