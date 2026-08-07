import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { AppSettings } from '../types'
import {
  clearSelectedImages,
  measureOverlay,
  selectImage,
  startImageResize,
  stripImageSelection,
  type OverlayBox,
  type ResizeHandle,
} from '../lib/imageResize'
import { imageHtml, pickImage, uploadImageToGitHub } from '../lib/images'
import {
  buildMaterialCardHtml,
  clipboardEventToHtml,
  ensureMaterialCardChrome,
  findMaterialCard,
  isCancelControl,
  MATERIAL_CARD_CSS,
  removeMaterialCard,
  startMaterialCardResize,
  unwrapMaterialCard,
} from '../lib/materialCard'
import { isConfigured } from '../lib/storage'
import { colors } from '../theme'

interface Props {
  editorKey: string
  html: string
  settings: AppSettings
  onChange: (html: string) => void
  onStatus?: (message: string, error?: boolean) => void
  /** 嵌套在材料/问题卡片时使用更紧凑的高度 */
  compact?: boolean
  minHeight?: number
}

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

interface CopiedFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  fontSize: string
  color: string
  fontFamily: string
  blockTag: 'h1' | 'h2' | 'p' | null
}

export function RichTextEditor({
  editorKey,
  html,
  settings,
  onChange,
  onStatus,
  compact = false,
  minHeight,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const selectedImg = useRef<HTMLImageElement | null>(null)
  const savedRange = useRef<Range | null>(null)
  const lastKey = useRef<string>('')
  const copiedFormat = useRef<CopiedFormat | null>(null)
  const paintSticky = useRef(false)
  const formatBrushOnRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [fontSize, setFontSize] = useState('16')
  const [fontColor, setFontColor] = useState('#1d2b30')
  const [overlay, setOverlay] = useState<OverlayBox | null>(null)
  const [formatBrushOn, setFormatBrushOn] = useState(false)

  const emit = useCallback(() => {
    if (!ref.current) return
    const html = stripImageSelection(ref.current.innerHTML || '').replace(
      /\s*is-active/g,
      '',
    )
    onChange(html)
  }, [onChange])

  const refreshOverlay = useCallback(() => {
    if (!ref.current || !selectedImg.current) {
      setOverlay(null)
      return
    }
    if (!ref.current.contains(selectedImg.current)) {
      selectedImg.current = null
      setOverlay(null)
      return
    }
    setOverlay(measureOverlay(selectedImg.current))
  }, [])

  const deselectImage = useCallback(() => {
    if (ref.current) clearSelectedImages(ref.current)
    selectedImg.current = null
    setOverlay(null)
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!ref.current) return
    if (lastKey.current === editorKey) return
    lastKey.current = editorKey
    deselectImage()
    copiedFormat.current = null
    paintSticky.current = false
    formatBrushOnRef.current = false
    setFormatBrushOn(false)
    ref.current.classList.remove('format-brush-cursor')
    ref.current.innerHTML = html || '<p><br></p>'
    ensureMaterialCardChrome(ref.current)
  }, [editorKey, html, deselectImage])

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const styleId = 'notebox-editor-style'
    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    style.textContent = `
      .notebox-editor-wrap { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .notebox-editor h1 { font-size: 1.75rem; font-weight: 700; margin: 0.6em 0 0.35em; }
      .notebox-editor h2 { font-size: 1.35rem; font-weight: 700; margin: 0.55em 0 0.3em; }
      .notebox-editor p { margin: 0.4em 0; }
      .notebox-editor img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        cursor: pointer;
        display: inline-block;
        vertical-align: middle;
      }
      .notebox-editor img.notebox-img-selected {
        outline: 2px solid #2e8b80;
        outline-offset: 2px;
      }
      .notebox-editor ul, .notebox-editor ol { padding-left: 1.4em; }
      .notebox-img-overlay {
        position: fixed;
        box-sizing: border-box;
        border: 2px solid #2e8b80;
        pointer-events: none;
        z-index: 10000;
      }
      .notebox-img-handle {
        position: absolute;
        width: 12px;
        height: 12px;
        background: #fff;
        border: 2px solid #2e8b80;
        border-radius: 2px;
        pointer-events: auto;
        box-sizing: border-box;
        touch-action: none;
      }
      .notebox-img-handle.nw { left: -6px; top: -6px; cursor: nwse-resize; }
      .notebox-img-handle.n  { left: 50%; top: -6px; transform: translateX(-50%); cursor: ns-resize; }
      .notebox-img-handle.ne { right: -6px; top: -6px; cursor: nesw-resize; }
      .notebox-img-handle.e  { right: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
      .notebox-img-handle.se { right: -6px; bottom: -6px; cursor: nwse-resize; }
      .notebox-img-handle.s  { left: 50%; bottom: -6px; transform: translateX(-50%); cursor: ns-resize; }
      .notebox-img-handle.sw { left: -6px; bottom: -6px; cursor: nesw-resize; }
      .notebox-img-handle.w  { left: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
      .notebox-toolbar button, .notebox-toolbar input, .notebox-toolbar label {
        font-family: system-ui, sans-serif;
      }
      .notebox-toolbar button {
        border: 1px solid rgba(29,43,48,0.12);
        background: rgba(255,255,255,0.85);
        border-radius: 6px;
        padding: 5px 8px;
        cursor: pointer;
        color: #1d2b30;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.2;
      }
      .notebox-toolbar button:hover { background: #fff; }
      .notebox-toolbar button.primary {
        background: #2e8b80;
        border-color: #2e8b80;
        color: #fff;
      }
      .notebox-toolbar button.active {
        background: #c9852a;
        border-color: #c9852a;
        color: #fff;
      }
      .notebox-toolbar button:disabled { opacity: 0.5; cursor: default; }
      .notebox-editor.format-brush-cursor,
      .notebox-editor.format-brush-cursor * {
        cursor: cell !important;
      }
      .notebox-toolbar .sep {
        width: 1px; height: 20px; background: rgba(29,43,48,0.12); margin: 0 4px;
      }
      .notebox-toolbar .field {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 0 4px; color: #5d6d74; font-size: 12px;
      }
      .notebox-toolbar input[type="number"] {
        width: 56px; border: 1px solid rgba(29,43,48,0.15);
        border-radius: 6px; padding: 4px 6px; font-size: 13px;
      }
      .notebox-toolbar input[type="color"] {
        width: 28px; height: 28px; border: none; padding: 0;
        background: transparent; cursor: pointer;
      }
      ${MATERIAL_CARD_CSS}
    `
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onScrollOrResize = () => refreshOverlay()
    const editor = ref.current
    editor?.addEventListener('scroll', onScrollOrResize)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      editor?.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [refreshOverlay, editorKey])

  // 材料 card 内嵌套 contenteditable 的输入事件
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const editor = ref.current
    if (!editor) return
    const onNestedInput = () => {
      saveSelection()
      emit()
      refreshOverlay()
    }
    editor.addEventListener('input', onNestedInput, true)
    return () => editor.removeEventListener('input', onNestedInput, true)
  }, [editorKey, emit, refreshOverlay])

  // 粘贴：剥掉材料 card 外壳；题目/选项优先纯文本；避免粘贴进 card 残壳
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const editor = ref.current
    if (!editor) return

    const onPaste = (ev: ClipboardEvent) => {
      const html = clipboardEventToHtml(ev)
      if (!html) return
      ev.preventDefault()
      ev.stopPropagation()

      const active = document.activeElement as HTMLElement | null
      const pane = active?.closest?.(
        '.notebox-card-pane-body',
      ) as HTMLElement | null
      const inPane = Boolean(pane && editor.contains(pane))

      const sel = window.getSelection()
      const anchor = sel?.anchorNode
      const anchorEl =
        anchor instanceof Element ? anchor : anchor?.parentElement || null
      const card = findMaterialCard(anchorEl || active)

      if (inPane && pane) {
        // 用户点进了「材料内容 / 问题」：粘贴进当前栏
        pane.focus()
        const s = window.getSelection()
        if (s && (!s.anchorNode || !pane.contains(s.anchorNode))) {
          const r = document.createRange()
          r.selectNodeContents(pane)
          r.collapse(false)
          s.removeAllRanges()
          s.addRange(r)
        }
      } else if (card && editor.contains(card)) {
        // 点在 card 外壳上：贴到 card 后面，当作普通正文
        const range = document.createRange()
        range.setStartAfter(card)
        range.collapse(true)
        sel?.removeAllRanges()
        sel?.addRange(range)
        editor.focus()
      }

      document.execCommand('insertHTML', false, html)
      ensureMaterialCardChrome(editor)
      saveSelection()
      emit()
    }

    editor.addEventListener('paste', onPaste, true)
    return () => editor.removeEventListener('paste', onPaste, true)
  }, [editorKey, emit])

  // 原生事件委托：取消 card + 拖拽高度（capture，避免 contentEditable 吞掉点击）
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const wrap = wrapRef.current
    const editor = ref.current
    const root = wrap || editor
    if (!root) return

    const handleCancel = (ev: Event) => {
      const target = ev.target as Element | null
      if (!target || !isCancelControl(target)) return
      const card = findMaterialCard(target)
      if (!card || !root.contains(card)) return
      ev.preventDefault()
      ev.stopPropagation()
      unwrapMaterialCard(card)
      clearActiveCards()
      emit()
      onStatus?.('已取消 card')
    }

    const beginResize = (ev: PointerEvent | MouseEvent, pointerId?: number) => {
      const target = ev.target as HTMLElement | null
      if (!target) return false
      const handle = target.classList?.contains('notebox-card-resize')
        ? target
        : (target.closest?.('.notebox-card-resize') as HTMLElement | null)
      if (!handle || !root.contains(handle)) return false
      ev.preventDefault()
      ev.stopPropagation()
      startMaterialCardResize(
        handle,
        ev.clientY,
        () => {
          emit()
          onStatus?.('已调整材料 card 高度')
        },
        pointerId,
      )
      return true
    }

    const onPointerDown = (ev: PointerEvent) => {
      if (isCancelControl(ev.target as Element)) {
        handleCancel(ev)
        return
      }
      beginResize(ev, ev.pointerId)
    }
    const onMouseDown = (ev: MouseEvent) => {
      if (isCancelControl(ev.target as Element)) {
        handleCancel(ev)
        return
      }
      if (typeof window.PointerEvent !== 'undefined') return
      beginResize(ev)
    }
    const onClick = (ev: MouseEvent) => {
      if (isCancelControl(ev.target as Element)) handleCancel(ev)
    }

    root.addEventListener('pointerdown', onPointerDown, true)
    root.addEventListener('mousedown', onMouseDown, true)
    root.addEventListener('click', onClick, true)
    return () => {
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeEventListener('mousedown', onMouseDown, true)
      root.removeEventListener('click', onClick, true)
    }
  }, [editorKey, emit, onStatus])

  // Delete / Backspace 删除当前选中的材料 card（contenteditable=false 时否则删不掉）
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const editor = ref.current
    if (!editor) return

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Backspace' && ev.key !== 'Delete') return
      const active = editor.querySelector(
        '.notebox-material-card.is-active',
      ) as HTMLElement | null
      const anchor = window.getSelection()?.anchorNode
      const anchorEl =
        anchor instanceof Element ? anchor : anchor?.parentElement || null
      const fromSel = findMaterialCard(anchorEl)
      const card = active || fromSel
      if (!card || !editor.contains(card)) return

      // 若焦点在 pane 正文内且还有字，交给默认删除
      const t = ev.target as HTMLElement | null
      if (t?.closest?.('.notebox-card-pane-body')) {
        const body = t.closest('.notebox-card-pane-body') as HTMLElement
        const text = (body.innerText || '').replace(/\u200b/g, '').trim()
        if (text.length > 0) return
      }

      ev.preventDefault()
      ev.stopPropagation()
      removeMaterialCard(card)
      clearActiveCards()
      emit()
      onStatus?.('已删除材料 card')
    }

    editor.addEventListener('keydown', onKeyDown, true)
    return () => editor.removeEventListener('keydown', onKeyDown, true)
  }, [editorKey, emit, onStatus])

  const saveSelection = () => {
    if (Platform.OS !== 'web') return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (ref.current && ref.current.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange()
    }
  }

  const restoreSelection = () => {
    if (!savedRange.current) return
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(savedRange.current)
  }

  const focusEditor = (opts?: { preventScroll?: boolean }) => {
    ref.current?.focus({ preventScroll: opts?.preventScroll ?? true })
    restoreSelection()
  }

  const runCommand = (cmd: string, value?: string) => {
    if (Platform.OS !== 'web') return
    focusEditor({ preventScroll: true })
    document.execCommand(cmd, false, value)
    saveSelection()
    emit()
  }

  const applyInlineStyle = (style: Record<string, string>) => {
    if (Platform.OS !== 'web') return
    focusEditor({ preventScroll: true })
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)

    const span = document.createElement('span')
    Object.assign(span.style, style)

    if (range.collapsed) {
      span.appendChild(document.createTextNode('\u200b'))
      range.insertNode(span)
      const textNode = span.firstChild
      if (textNode) {
        const next = document.createRange()
        next.setStart(textNode, 1)
        next.collapse(true)
        sel.removeAllRanges()
        sel.addRange(next)
      }
    } else {
      try {
        range.surroundContents(span)
      } catch {
        const fragment = range.extractContents()
        span.appendChild(fragment)
        range.insertNode(span)
      }
      const next = document.createRange()
      next.selectNodeContents(span)
      sel.removeAllRanges()
      sel.addRange(next)
    }

    saveSelection()
    emit()
  }

  const applyFontSize = () => {
    const px = Number(fontSize)
    if (!Number.isFinite(px) || px < 8 || px > 96) {
      Alert.alert('字号无效', '请输入 8–96 之间的数字')
      return
    }
    applyInlineStyle({ fontSize: `${px}px` })
  }

  const applyFontColor = (color: string) => {
    setFontColor(color)
    applyInlineStyle({ color })
  }

  const captureFormatFromSelection = (): CopiedFormat | null => {
    if (Platform.OS !== 'web') return null
    const sel = window.getSelection()
    // 点工具栏时选区可能已丢，优先用编辑器里保存的选区取样
    if (
      (!sel || sel.rangeCount === 0 || sel.isCollapsed) &&
      savedRange.current &&
      ref.current
    ) {
      try {
        sel?.removeAllRanges()
        sel?.addRange(savedRange.current.cloneRange())
      } catch {
        return null
      }
    }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
    const node = sel.anchorNode
    if (!node || !ref.current?.contains(node)) return null
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement
    if (!el) return null
    const cs = window.getComputedStyle(el)
    let blockTag: CopiedFormat['blockTag'] = null
    let walk: HTMLElement | null = el
    while (walk && walk !== ref.current) {
      const tag = walk.tagName.toLowerCase()
      if (tag === 'h1' || tag === 'h2' || tag === 'p') {
        blockTag = tag
        break
      }
      walk = walk.parentElement
    }
    const deco = `${cs.textDecorationLine || ''} ${cs.textDecoration || ''}`
    return {
      bold:
        document.queryCommandState('bold') ||
        cs.fontWeight === 'bold' ||
        Number(cs.fontWeight) >= 600,
      italic: document.queryCommandState('italic') || cs.fontStyle === 'italic',
      underline:
        document.queryCommandState('underline') || deco.includes('underline'),
      strike:
        document.queryCommandState('strikeThrough') ||
        deco.includes('line-through'),
      fontSize: cs.fontSize,
      color: cs.color,
      fontFamily: cs.fontFamily,
      blockTag,
    }
  }

  const applyCopiedFormat = (fmt: CopiedFormat, range: Range) => {
    if (Platform.OS !== 'web' || !ref.current) return false
    if (range.collapsed) return false

    const editor = ref.current
    const winScrollX = window.scrollX
    const winScrollY = window.scrollY
    const editorScroll = editor.scrollTop

    editor.focus({ preventScroll: true })

    const sel = window.getSelection()
    if (!sel) return false
    sel.removeAllRanges()
    sel.addRange(range)

    // 只刷内联样式，避免 formatBlock 导致整段重排并跳到顶部
    const span = document.createElement('span')
    span.style.fontSize = fmt.fontSize
    span.style.color = fmt.color
    span.style.fontFamily = fmt.fontFamily
    if (fmt.bold) span.style.fontWeight = '700'
    if (fmt.italic) span.style.fontStyle = 'italic'
    const decorations: string[] = []
    if (fmt.underline) decorations.push('underline')
    if (fmt.strike) decorations.push('line-through')
    if (decorations.length) {
      span.style.textDecoration = decorations.join(' ')
    }

    try {
      const live = sel.getRangeAt(0)
      try {
        live.surroundContents(span)
      } catch {
        const fragment = live.extractContents()
        span.appendChild(fragment)
        live.insertNode(span)
      }
    } catch {
      return false
    }

    // 恢复滚动位置，防止跳顶
    editor.scrollTop = editorScroll
    window.scrollTo(winScrollX, winScrollY)

    saveSelection()
    emit()
    // emit 后 React 可能重绘，再压一次滚动
    requestAnimationFrame(() => {
      editor.scrollTop = editorScroll
      window.scrollTo(winScrollX, winScrollY)
    })
    return true
  }

  const exitFormatBrush = (silent?: boolean) => {
    copiedFormat.current = null
    paintSticky.current = false
    formatBrushOnRef.current = false
    setFormatBrushOn(false)
    ref.current?.classList.remove('format-brush-cursor')
    if (!silent) onStatus?.('')
  }

  const toggleFormatBrush = (sticky: boolean) => {
    if (Platform.OS !== 'web') return
    if (formatBrushOnRef.current && !sticky) {
      exitFormatBrush()
      onStatus?.('已取消格式刷')
      return
    }
    const fmt = captureFormatFromSelection()
    if (!fmt) {
      onStatus?.('请先选中一段有格式的文字，再点格式刷', true)
      return
    }
    copiedFormat.current = fmt
    paintSticky.current = sticky
    formatBrushOnRef.current = true
    setFormatBrushOn(true)
    ref.current?.classList.add('format-brush-cursor')
    onStatus?.(
      sticky
        ? '格式刷已锁定：选中文字即可刷格式，再点格式刷结束'
        : '格式刷已启用：拖选目标文字即可刷上格式',
    )
  }

  const clearActiveCards = () => {
    ref.current
      ?.querySelectorAll('.notebox-material-card.is-active')
      .forEach((el) => el.classList.remove('is-active'))
  }

  const insertMaterialCard = () => {
    if (Platform.OS !== 'web' || !ref.current) return
    focusEditor()
    const wrap = document.createElement('div')
    wrap.innerHTML = buildMaterialCardHtml()
    const frag = document.createDocumentFragment()
    while (wrap.firstChild) frag.appendChild(wrap.firstChild)

    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && ref.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(frag)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      ref.current.appendChild(frag)
    }

    ensureMaterialCardChrome(ref.current)
    saveSelection()
    emit()
    onStatus?.('已插入材料 card，可拖底部青条调整高度')
  }

  const onEditorClick = (e: {
    target: EventTarget | null
    preventDefault?: () => void
  }) => {
    const target = e.target as HTMLElement | null
    if (!ref.current || !target) return

    // 取消 card：展平左右内容到原位置（原生 capture 已处理；此处兜底）
    if (isCancelControl(target)) {
      e.preventDefault?.()
      const card = findMaterialCard(target)
      if (card) {
        unwrapMaterialCard(card)
        clearActiveCards()
        emit()
        onStatus?.('已取消 card')
      }
      return
    }

    if (
      target.classList.contains('notebox-card-resize') ||
      target.getAttribute('data-card-action') === 'resize'
    ) {
      return
    }

    const card = findMaterialCard(target)
    clearActiveCards()
    if (card) {
      // 补全被浏览器剥掉的取消按钮等控件
      ensureMaterialCardChrome(ref.current)
      card.classList.add('is-active')
    }

    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement
      selectImage(ref.current, img)
      selectedImg.current = img
      setOverlay(measureOverlay(img))
      return
    }
    deselectImage()
  }

  const onEditorInput = () => {
    saveSelection()
    emit()
    refreshOverlay()
  }

  // 格式刷：mouseup 处理放到 ref，避免闭包过期；原生监听避免丢选区
  const formatBrushMouseUpRef = useRef<() => void>(() => {})
  formatBrushMouseUpRef.current = () => {
    if (!formatBrushOnRef.current || !copiedFormat.current || !ref.current) return
    const editor = ref.current
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    if (!editor.contains(sel.anchorNode)) return

    const range = sel.getRangeAt(0).cloneRange()
    const fmt = copiedFormat.current
    requestAnimationFrame(() => {
      if (!formatBrushOnRef.current || !fmt) return
      const ok = applyCopiedFormat(fmt, range)
      if (!ok) {
        onStatus?.('格式刷未生效，请重新拖选文字后再试', true)
        return
      }
      if (!paintSticky.current) {
        exitFormatBrush(true)
        onStatus?.('已应用格式')
      } else {
        onStatus?.('已应用格式（锁定中，可继续刷）')
      }
    })
  }

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const editor = ref.current
    if (!editor) return
    const onUp = () => formatBrushMouseUpRef.current()
    editor.addEventListener('mouseup', onUp)
    return () => editor.removeEventListener('mouseup', onUp)
  }, [editorKey])

  const onEditorMouseUp = () => {
    saveSelection()
  }

  const onHandlePointerDown = (handle: ResizeHandle, e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.preventDefault()
    e.stopPropagation()
    const img = selectedImg.current
    const editor = ref.current
    if (!img || !editor) return

    const maxWidth = Math.max(48, editor.clientWidth - 8)
    startImageResize({
      img,
      handle,
      clientX: e.clientX,
      clientY: e.clientY,
      maxWidth,
      onMove: refreshOverlay,
      onEnd: () => {
        refreshOverlay()
        emit()
      },
    })
  }

  const resizeOverlay =
    overlay && typeof document !== 'undefined'
      ? createPortal(
          createElement(
            'div',
            {
              className: 'notebox-img-overlay',
              style: {
                top: overlay.top,
                left: overlay.left,
                width: overlay.width,
                height: overlay.height,
              },
            },
            ...HANDLES.map((h) =>
              createElement('div', {
                key: h,
                className: `notebox-img-handle ${h}`,
                onPointerDown: (ev: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) =>
                  onHandlePointerDown(h, ev),
                onMouseDown: (ev: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) =>
                  onHandlePointerDown(h, ev),
              }),
            ),
          ),
          document.body,
        )
      : null

  async function handleUploadImage() {
    if (!isConfigured(settings)) {
      onStatus?.('请先在设置中配置 GitHub', true)
      return
    }
    try {
      setUploading(true)
      onStatus?.('正在选择图片…')
      const file = await pickImage()
      if (!file) {
        onStatus?.('')
        return
      }
      onStatus?.('正在上传图片…')
      const { url } = await uploadImageToGitHub(settings, file)
      if (Platform.OS === 'web') {
        focusEditor()
        document.execCommand('insertHTML', false, imageHtml(url))
        saveSelection()
        emit()
        // 选中刚插入的最后一张图
        requestAnimationFrame(() => {
          const imgs = ref.current?.querySelectorAll('img')
          const last = imgs?.[imgs.length - 1] as HTMLImageElement | undefined
          if (last && ref.current) {
            selectImage(ref.current, last)
            selectedImg.current = last
            setOverlay(measureOverlay(last))
          }
        })
      } else {
        onChange(`${html}${imageHtml(url)}`)
      }
      onStatus?.('图片已插入，可拖边缘调整大小')
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片上传失败'
      onStatus?.(message, true)
      Alert.alert('上传失败', message)
    } finally {
      setUploading(false)
    }
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.flex}>
        <Text style={styles.nativeHint}>完整字体样式与图片缩放请使用电脑 Web 版。</Text>
        <TextInput
          style={styles.nativeInput}
          multiline
          textAlignVertical="top"
          value={html.replace(/<[^>]+>/g, '')}
          onChangeText={(text) => onChange(`<p>${text.replace(/\n/g, '<br/>')}</p>`)}
          placeholder="开始写笔记…"
          placeholderTextColor={colors.muted}
        />
      </View>
    )
  }

  const btn = (
    label: string,
    onMouseDown: () => void,
    opts?: {
      primary?: boolean
      active?: boolean
      disabled?: boolean
      title?: string
    },
  ) =>
    createElement(
      'button',
      {
        type: 'button',
        title: opts?.title,
        disabled: opts?.disabled,
        className: [opts?.primary && 'primary', opts?.active && 'active']
          .filter(Boolean)
          .join(' ') || undefined,
        onMouseDown: (ev: { preventDefault: () => void }) => {
          ev.preventDefault()
          onMouseDown()
        },
        onDoubleClick: (ev: { preventDefault: () => void }) => {
          ev.preventDefault()
        },
      },
      label,
    )

  return (
    <View style={styles.flex}>
      {createElement(
        'div',
        {
          className: 'notebox-toolbar',
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 4,
            padding: '8px 10px',
            borderBottom: '1px solid rgba(29,43,48,0.12)',
            background: 'rgba(255,255,255,0.72)',
          },
        },
        btn('B', () => runCommand('bold'), { title: '加粗' }),
        btn('I', () => runCommand('italic'), { title: '斜体' }),
        btn('U', () => runCommand('underline'), { title: '下划线' }),
        btn('S', () => runCommand('strikeThrough'), { title: '删除线' }),
        createElement('span', { className: 'sep' }),
        btn('标题', () => runCommand('formatBlock', 'h1')),
        btn('小标题', () => runCommand('formatBlock', 'h2')),
        btn('正文', () => runCommand('formatBlock', 'p')),
        createElement('span', { className: 'sep' }),
        createElement(
          'label',
          { className: 'field', title: '自定义字号（px）' },
          '字号',
          createElement('input', {
            type: 'number',
            min: 8,
            max: 96,
            value: fontSize,
            onChange: (e: { target: { value: string } }) => setFontSize(e.target.value),
            onMouseDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
          }),
          'px',
        ),
        btn('应用字号', applyFontSize, { title: '对选中文字或后续输入生效' }),
        createElement('span', { className: 'sep' }),
        createElement(
          'label',
          { className: 'field', title: '自定义颜色' },
          '颜色',
          createElement('input', {
            type: 'color',
            value: fontColor,
            onFocus: () => saveSelection(),
            onMouseDown: () => saveSelection(),
            onChange: (e: { target: { value: string } }) => {
              applyFontColor(e.target.value)
            },
          }),
        ),
        btn('应用颜色', () => applyFontColor(fontColor)),
        createElement('span', { className: 'sep' }),
        btn('• 列表', () => runCommand('insertUnorderedList')),
        btn('1. 列表', () => runCommand('insertOrderedList')),
        btn('清除样式', () => runCommand('removeFormat')),
        createElement(
          'button',
          {
            type: 'button',
            title: '格式刷：先选中带格式文字再点击；双击可连续刷',
            className: formatBrushOn ? 'active' : undefined,
            onMouseDown: (ev: { preventDefault: () => void }) => {
              ev.preventDefault()
              toggleFormatBrush(false)
            },
            onDoubleClick: (ev: { preventDefault: () => void }) => {
              ev.preventDefault()
              toggleFormatBrush(true)
            },
          },
          formatBrushOn ? '格式刷中' : '格式刷',
        ),
        createElement('span', { className: 'sep' }),
        btn(uploading ? '上传中…' : '图片', () => void handleUploadImage(), {
          primary: true,
          disabled: uploading,
        }),
        createElement('span', { className: 'sep' }),
        btn('插入材料 card', insertMaterialCard, {
          primary: true,
          title: '插入左右对照：材料内容 + 问题',
        }),
      )}

      {createElement(
        'div',
        {
          className: 'notebox-editor-wrap',
          ref: (node: HTMLDivElement | null) => {
            wrapRef.current = node
          },
        },
        createElement('div', {
          ref: (node: HTMLDivElement | null) => {
            ref.current = node
          },
          contentEditable: true,
          suppressContentEditableWarning: true,
          className: 'notebox-editor',
          onClick: onEditorClick,
          onInput: onEditorInput,
          // 嵌套 contenteditable 的输入也要同步保存
          onInputCapture: onEditorInput,
          onKeyUp: saveSelection,
          onMouseUp: onEditorMouseUp,
          onSelect: saveSelection,
          onBlur: saveSelection,
          onScroll: refreshOverlay,
          style: {
            flex: 1,
            outline: 'none',
            padding: compact ? '10px 12px' : '14px 16px',
            overflow: 'auto',
            color: colors.ink,
            fontSize: 16,
            lineHeight: 1.7,
            minHeight: minHeight ?? (compact ? 160 : 240),
            fontFamily: 'Georgia, "Source Serif 4", serif',
          },
        }),
      )}
      {resizeOverlay}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nativeInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  nativeHint: {
    padding: 10,
    fontSize: 12,
    color: colors.muted,
  },
})
