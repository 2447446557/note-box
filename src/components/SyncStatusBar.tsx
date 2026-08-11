import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { SyncStatus } from '../types'
import { colors, radius, space } from '../theme'

const LABELS: Record<SyncStatus, string> = {
  unconfigured: '未配置',
  idle: '本地就绪',
  syncing: '同步中',
  synced: '已同步',
  pending: '待推送',
  error: '失败',
  conflict: '冲突',
}

interface Props {
  status: SyncStatus
  message?: string
  onSync: () => void
  onPull: () => void
  onOpenSettings: () => void
}

const DOT_COLORS: Record<SyncStatus, string> = {
  unconfigured: colors.faint,
  idle: colors.faint,
  syncing: colors.warn,
  synced: colors.success,
  pending: colors.warn,
  error: colors.danger,
  conflict: colors.danger,
}

export function SyncStatusBar({
  status,
  message,
  onSync,
  onPull,
  onOpenSettings,
}: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: DOT_COLORS[status] }]} />
        <View style={styles.textCol}>
          <Text style={styles.label}>{LABELS[status]}</Text>
          {message ? (
            <Text style={styles.message} numberOfLines={1}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={onPull}
        >
          <Text style={styles.btnText}>拉取</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
          onPress={onSync}
        >
          <Text style={styles.btnPrimaryText}>同步</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={onOpenSettings}
        >
          <Text style={styles.btnText}>设置</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minWidth: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  textCol: { flex: 1, minWidth: 0 },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  btnPressed: {
    backgroundColor: colors.surfaceHover,
  },
  btnText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  btnPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  btnPrimaryPressed: {
    backgroundColor: colors.accentPressed,
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
})
