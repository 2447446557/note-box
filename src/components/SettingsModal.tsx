import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import type { AppSettings } from '../types'
import { testGitHubConnection } from '../lib/github'
import { colors, radius, space } from '../theme'

interface Props {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => void
}

function normalizeForm(form: AppSettings): AppSettings {
  return {
    ...form,
    token: form.token.trim(),
    owner: form.owner.trim(),
    repo: form.repo.trim(),
    branch: form.branch.trim() || 'main',
    notesPath: form.notesPath.trim() || 'notes',
  }
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const { width } = useWindowDimensions()
  const isMobile = width < 860
  const [form, setForm] = useState(settings)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testError, setTestError] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(settings)
      setTestMsg(null)
      setTestError(false)
    }
  }, [open, settings])

  async function handleTest() {
    setTesting(true)
    setTestMsg(null)
    try {
      const msg = await testGitHubConnection(normalizeForm(form))
      setTestMsg(msg)
      setTestError(false)
    } catch (error) {
      setTestMsg(error instanceof Error ? error.message : '连接失败')
      setTestError(true)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal
      visible={open}
      animationType={isMobile ? 'slide' : 'fade'}
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isMobile && styles.backdropMobile]}>
        {isMobile ? <Pressable style={styles.backdropTap} onPress={onClose} /> : null}
        <View style={[styles.card, isMobile && styles.cardMobile]}>
          {isMobile ? <View style={styles.handle} /> : null}
          <View style={styles.header}>
            <Text style={styles.title}>GitHub 设置</Text>
            <Pressable
              style={({ pressed }) => [styles.closeHit, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.link}>关闭</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            使用 Personal Access Token。内容先存本地，再同步到 GitHub；断网时可继续编辑。
          </Text>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
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
                  placeholderTextColor={colors.faint}
                  secureTextEntry={secure}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
            {testMsg ? (
              <Text style={[styles.testMsg, testError && styles.testMsgError]}>
                {testMsg}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
              onPress={() => void handleTest()}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={styles.ghostText}>测试连接</Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.ghostText}>取消</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
              ]}
              onPress={() => onSave(normalizeForm(form))}
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: space.lg,
  },
  backdropMobile: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  backdropTap: {
    flex: 1,
  },
  card: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  cardMobile: {
    maxHeight: '92%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    marginBottom: space.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  closeHit: { padding: 6, borderRadius: radius.sm },
  link: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  pressed: { backgroundColor: colors.surfaceHover },
  hint: {
    marginTop: space.sm,
    marginBottom: space.md,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  form: { gap: space.md, paddingBottom: space.sm },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontSize: 15,
  },
  testMsg: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.success,
  },
  testMsgError: { color: colors.danger },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  ghost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  ghostText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  primary: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  primaryPressed: { backgroundColor: colors.accentPressed },
  primaryText: { color: colors.white, fontWeight: '600', fontSize: 13 },
})
