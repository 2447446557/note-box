import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { AppSettings } from '../types'
import { colors } from '../theme'

interface Props {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => void
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [form, setForm] = useState(settings)

  useEffect(() => {
    if (open) setForm(settings)
  }, [open, settings])

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>GitHub 设置</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.link}>关闭</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            使用 Personal Access Token。笔记会先保存在本机，再推送到 GitHub；网络不通时仍可继续编辑，恢复后自动重试推送。
          </Text>
          <ScrollView contentContainerStyle={styles.form}>
            {(
              [
                ['token', 'Personal Access Token', 'ghp_… / github_pat_…', true],
                ['owner', '仓库所有者 (owner)', 'your-github-username', false],
                ['repo', '仓库名 (repo)', 'my-notes', false],
                ['branch', '分支', 'main', false],
                ['notesPath', '笔记目录', 'notes', false],
              ] as const
            ).map(([key, label, placeholder, secure]) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  secureTextEntry={secure}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.ghost} onPress={onClose}>
              <Text style={styles.ghostText}>取消</Text>
            </Pressable>
            <Pressable
              style={styles.primary}
              onPress={() =>
                onSave({
                  ...form,
                  token: form.token.trim(),
                  owner: form.owner.trim(),
                  repo: form.repo.trim(),
                  branch: form.branch.trim() || 'main',
                  notesPath: form.notesPath.trim() || 'notes',
                })
              }
            >
              <Text style={styles.primaryText}>保存并同步</Text>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
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
  form: { gap: 12, paddingBottom: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
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
