import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import type { AppSettings } from '../types'
import { imageHtml, pickImage, uploadImageToGitHub } from '../lib/images'
import { buildNativeEditorHtml } from '../lib/nativeEditorHtml'
import { isConfigured } from '../lib/storage'

interface Props {
  editorKey: string
  html: string
  settings: AppSettings
  onChange: (html: string) => void
  onStatus?: (message: string, error?: boolean) => void
}

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'change'; html: string }
  | { type: 'status'; message: string; error?: boolean }
  | { type: 'requestImage' }

export function NativeRichTextEditor({
  editorKey,
  html,
  settings,
  onChange,
  onStatus,
}: Props) {
  const webRef = useRef<WebView>(null)
  const lastLocalHtml = useRef(html)
  const readyRef = useRef(false)
  const [sourceHtml] = useState(() => buildNativeEditorHtml(html || '<p><br></p>'))

  const inject = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js}; true;`)
  }, [])

  useEffect(() => {
    if (!readyRef.current) return
    if (html === lastLocalHtml.current) return
    lastLocalHtml.current = html
    inject(
      `window.__NOTEBOX_SET_HTML && window.__NOTEBOX_SET_HTML(${JSON.stringify(html || '<p><br></p>')}, ${JSON.stringify(editorKey)})`,
    )
  }, [editorKey, html, inject])

  async function handleUploadImage() {
    if (!isConfigured(settings)) {
      onStatus?.('请先在设置中配置 GitHub', true)
      return
    }
    try {
      inject('window.__NOTEBOX_SET_UPLOADING && window.__NOTEBOX_SET_UPLOADING(true)')
      onStatus?.('正在选择图片…')
      const file = await pickImage()
      if (!file) {
        onStatus?.('')
        return
      }
      onStatus?.('正在上传图片…')
      const { url } = await uploadImageToGitHub(settings, file)
      inject(
        `window.__NOTEBOX_INSERT_HTML && window.__NOTEBOX_INSERT_HTML(${JSON.stringify(imageHtml(url))})`,
      )
      onStatus?.('图片已插入')
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败'
      onStatus?.(message, true)
      Alert.alert('上传失败', message)
    } finally {
      inject('window.__NOTEBOX_SET_UPLOADING && window.__NOTEBOX_SET_UPLOADING(false)')
    }
  }

  function onMessage(event: WebViewMessageEvent) {
    let msg: BridgeMessage
    try {
      msg = JSON.parse(event.nativeEvent.data) as BridgeMessage
    } catch {
      return
    }

    if (msg.type === 'ready') {
      readyRef.current = true
      lastLocalHtml.current = html
      inject(
        `window.__NOTEBOX_SET_HTML && window.__NOTEBOX_SET_HTML(${JSON.stringify(html || '<p><br></p>')}, ${JSON.stringify(editorKey)})`,
      )
      return
    }

    if (msg.type === 'change') {
      lastLocalHtml.current = msg.html
      onChange(msg.html)
      return
    }

    if (msg.type === 'status') {
      if (msg.message) onStatus?.(msg.message, msg.error)
      return
    }

    if (msg.type === 'requestImage') {
      void handleUploadImage()
    }
  }

  return (
    <View style={styles.flex}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: sourceHtml }}
        onMessage={onMessage}
        style={styles.web}
        containerStyle={styles.web}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        textZoom={100}
        nestedScrollEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 0,
  },
})
