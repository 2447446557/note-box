import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { ConflictState } from '../types'
import { colors } from '../theme'

interface Props {
  conflict: ConflictState | null
  onKeepLocal: () => void
  onKeepRemote: () => void
  onClose: () => void
}

export function ConflictModal({ conflict, onKeepLocal, onKeepRemote, onClose }: Props) {
  return (
    <Modal visible={!!conflict} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>远程内容已变更</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.link}>关闭</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            同一篇笔记在别处被修改过。可强制用本地覆盖，或使用远程版本。
          </Text>
          <View style={styles.grid}>
            <View style={styles.col}>
              <Text style={styles.colTitle}>本地</Text>
              <ScrollView style={styles.pre}>
                <Text style={styles.preText}>{conflict?.localContent}</Text>
              </ScrollView>
            </View>
            <View style={styles.col}>
              <Text style={styles.colTitle}>远程</Text>
              <ScrollView style={styles.pre}>
                <Text style={styles.preText}>{conflict?.remoteContent}</Text>
              </ScrollView>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.ghost} onPress={onKeepRemote}>
              <Text style={styles.ghostText}>使用远程覆盖</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={onKeepLocal}>
              <Text style={styles.primaryText}>强制用本地覆盖</Text>
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
    maxHeight: '90%',
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  link: { color: colors.ink, fontWeight: '600' },
  hint: {
    marginTop: 10,
    marginBottom: 12,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  grid: { gap: 10, flexDirection: 'column' },
  col: { flex: 1, minHeight: 120 },
  colTitle: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  pre: {
    maxHeight: 160,
    backgroundColor: 'rgba(30, 50, 55, 0.06)',
    borderRadius: 10,
    padding: 10,
  },
  preText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.ink,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  ghost: { paddingHorizontal: 12, paddingVertical: 10 },
  ghostText: { color: colors.ink, fontWeight: '600' },
  primary: {
    backgroundColor: colors.teal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryText: { color: colors.white, fontWeight: '700' },
})
