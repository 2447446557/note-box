const CARD_ATTR = 'data-notebox-card'
const CARD_VALUE = 'material'

export function isMaterialCardEl(el: Element | null): el is HTMLElement {
  return Boolean(el && el instanceof HTMLElement && el.getAttribute(CARD_ATTR) === CARD_VALUE)
}

export function findMaterialCard(from: EventTarget | null): HTMLElement | null {
  if (!(from instanceof Element)) return null
  return from.closest(`[${CARD_ATTR}="${CARD_VALUE}"]`) as HTMLElement | null
}

export function buildMaterialCardHtml(): string {
  const id = `mc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  // 注意：不用 <button>，contenteditable 内 button 常被浏览器剥离，导致无法取消/删除
  return `
<div class="notebox-material-card" ${CARD_ATTR}="${CARD_VALUE}" data-card-id="${id}" contenteditable="false">
  <div class="notebox-material-card-bar" contenteditable="false">
    <span class="notebox-material-card-label">材料对照</span>
    <span role="button" tabindex="0" class="notebox-card-cancel" contenteditable="false" data-card-action="cancel">取消 card</span>
  </div>
  <div class="notebox-material-card-split" style="height:220px">
    <div class="notebox-card-pane">
      <div class="notebox-card-pane-title" contenteditable="false">材料内容</div>
      <div class="notebox-card-pane-body notebox-card-material-body" contenteditable="true"><p><br></p></div>
    </div>
    <div class="notebox-card-pane">
      <div class="notebox-card-pane-title" contenteditable="false">问题</div>
      <div class="notebox-card-pane-body notebox-card-questions-body" contenteditable="true"><p><br></p></div>
    </div>
  </div>
  <div class="notebox-card-resize" contenteditable="false" data-card-action="resize" title="拖动调整高度"><span class="notebox-card-resize-text">拖动调整高度</span></div>
</div>
<p><br></p>`.trim()
}

const MIN_CARD_HEIGHT = 120
const MAX_CARD_HEIGHT = 900

function eventClientY(ev: { clientY?: number; nativeEvent?: { clientY?: number } }): number {
  if (typeof ev.clientY === 'number') return ev.clientY
  if (typeof ev.nativeEvent?.clientY === 'number') return ev.nativeEvent.clientY
  return 0
}

/** 拖动底部手柄调整材料 card 高度 */
export function startMaterialCardResize(
  handle: HTMLElement,
  clientY: number,
  onEnd?: () => void,
  pointerId?: number,
): void {
  const card = findMaterialCard(handle)
  const split = card?.querySelector(
    '.notebox-material-card-split',
  ) as HTMLElement | null
  if (!card || !split) return

  const startY = clientY
  const startH =
    parseFloat(split.style.height) ||
    split.getBoundingClientRect().height ||
    220
  card.classList.add('is-resizing')
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'

  if (pointerId != null) {
    try {
      handle.setPointerCapture(pointerId)
    } catch {
      // ignore
    }
  }

  const applyHeight = (y: number) => {
    const next = Math.min(
      MAX_CARD_HEIGHT,
      Math.max(MIN_CARD_HEIGHT, startH + (y - startY)),
    )
    const px = `${Math.round(next)}px`
    split.style.height = px
    split.style.minHeight = px
    split.style.maxHeight = px
  }

  const onMove = (ev: PointerEvent | MouseEvent) => {
    ev.preventDefault()
    applyHeight(eventClientY(ev))
  }

  const onUp = (ev: PointerEvent | MouseEvent) => {
    applyHeight(eventClientY(ev))
    card.classList.remove('is-resizing')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('mousemove', onMove, true)
    window.removeEventListener('mouseup', onUp, true)
    try {
      const pid = (ev as PointerEvent).pointerId
      if (pid != null) handle.releasePointerCapture(pid)
    } catch {
      // ignore
    }
    onEnd?.()
  }

  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('mousemove', onMove, true)
  window.addEventListener('mouseup', onUp, true)
}

function normalizePaneHtml(html: string): string {
  const trimmed = (html || '').trim()
  if (!trimmed || trimmed === '<br>' || trimmed === '<p><br></p>') return ''
  const text = trimmed
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  if (!text) return ''
  return trimmed
}

function buildCancelControl(): HTMLElement {
  const cancel = document.createElement('span')
  cancel.className = 'notebox-card-cancel'
  cancel.setAttribute('role', 'button')
  cancel.setAttribute('tabindex', '0')
  cancel.setAttribute('contenteditable', 'false')
  cancel.setAttribute('data-card-action', 'cancel')
  cancel.textContent = '取消 card'
  return cancel
}

function buildResizeHandle(): HTMLElement {
  const handle = document.createElement('div')
  handle.className = 'notebox-card-resize'
  handle.contentEditable = 'false'
  handle.setAttribute('data-card-action', 'resize')
  handle.title = '拖动调整高度'
  const tip = document.createElement('span')
  tip.className = 'notebox-card-resize-text'
  tip.textContent = '拖动调整高度'
  handle.appendChild(tip)
  return handle
}

/** 给旧版 / 残缺 card 补上顶栏取消按钮与高度拖拽条 */
export function ensureMaterialCardChrome(root: HTMLElement): void {
  root.querySelectorAll(`[${CARD_ATTR}="${CARD_VALUE}"]`).forEach((node) => {
    const card = node as HTMLElement
    card.contentEditable = 'false'
    card.setAttribute(CARD_ATTR, CARD_VALUE)

    let bar = card.querySelector('.notebox-material-card-bar') as HTMLElement | null
    if (!bar) {
      bar = document.createElement('div')
      bar.className = 'notebox-material-card-bar'
      bar.contentEditable = 'false'
      const label = document.createElement('span')
      label.className = 'notebox-material-card-label'
      label.textContent = '材料对照'
      bar.appendChild(label)
      bar.appendChild(buildCancelControl())
      card.insertBefore(bar, card.firstChild)
    } else {
      // 把历史 <button> 换成 span，并确保取消控件存在
      const oldBtn = bar.querySelector('button.notebox-card-cancel, [data-card-action="cancel"]')
      if (oldBtn && oldBtn.tagName === 'BUTTON') {
        const next = buildCancelControl()
        oldBtn.replaceWith(next)
      } else if (!bar.querySelector('[data-card-action="cancel"]')) {
        bar.appendChild(buildCancelControl())
      }
    }

    const split = card.querySelector(
      '.notebox-material-card-split',
    ) as HTMLElement | null
    if (split && !split.style.height) {
      const h = Math.round(split.getBoundingClientRect().height || 220)
      split.style.height = `${Math.max(MIN_CARD_HEIGHT, h)}px`
    }
    if (!card.querySelector('.notebox-card-resize')) {
      card.appendChild(buildResizeHandle())
    }
  })
}

/**
 * 取消 card：把左右内容依次展开到原位置；若两边都空则彻底删除，不留残壳。
 */
export function unwrapMaterialCard(card: HTMLElement): void {
  const material =
    card.querySelector('.notebox-card-material-body')?.innerHTML ?? ''
  const questions =
    card.querySelector('.notebox-card-questions-body')?.innerHTML ?? ''

  const parts = [normalizePaneHtml(material), normalizePaneHtml(questions)].filter(
    Boolean,
  )

  const parent = card.parentNode
  if (!parent) return

  if (parts.length === 0) {
    const placeholder = document.createElement('p')
    placeholder.appendChild(document.createElement('br'))
    parent.insertBefore(placeholder, card)
    card.remove()
    return
  }

  const wrap = document.createElement('div')
  wrap.innerHTML = parts.join('')
  const fragment = document.createDocumentFragment()
  while (wrap.firstChild) fragment.appendChild(wrap.firstChild)

  parent.insertBefore(fragment, card)
  card.remove()
}

/** 直接删除整张 card（不展开内容），用于 Backspace/Delete */
export function removeMaterialCard(card: HTMLElement): void {
  const parent = card.parentNode
  if (!parent) return
  const placeholder = document.createElement('p')
  placeholder.appendChild(document.createElement('br'))
  parent.insertBefore(placeholder, card)
  card.remove()
}

export function isCancelControl(target: Element | null): boolean {
  if (!target) return false
  return Boolean(
    target.closest?.('[data-card-action="cancel"]') ||
      target.classList?.contains('notebox-card-cancel'),
  )
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 纯文本转段落 HTML（粘贴选项/题目时用，避免带入 card 结构） */
export function plainTextToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (!lines.length) return '<p><br></p>'
  return lines.map((line) => `<p>${line ? escapeText(line) : '<br>'}</p>`).join('')
}

/**
 * 去掉剪贴板里的材料 card 外壳，只保留可读正文与样式。
 * 防止「复制笔记 / 误带 card HTML」再粘贴时重新出现材料对照框。
 */
export function sanitizePastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // 保留样式表，否则选项圆标等 class 样式会丢
  const styleBlocks = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.outerHTML)
    .join('')

  doc.querySelectorAll(`[${CARD_ATTR}="${CARD_VALUE}"], .notebox-material-card`).forEach((card) => {
    const material =
      card.querySelector('.notebox-card-material-body')?.innerHTML?.trim() || ''
    const questions =
      card.querySelector('.notebox-card-questions-body')?.innerHTML?.trim() || ''
    const parts = [material, questions].filter(
      (p) => p && p !== '<br>' && p !== '<p><br></p>',
    )
    const wrap = doc.createElement('div')
    wrap.innerHTML = parts.length ? parts.join('') : escapeText(card.textContent || '')
    const frag = doc.createDocumentFragment()
    while (wrap.firstChild) frag.appendChild(wrap.firstChild)
    card.replaceWith(frag)
  })

  doc
    .querySelectorAll(
      '.notebox-card-cancel, .notebox-card-resize, .notebox-material-card-bar, .notebox-card-pane-title, [data-card-action]',
    )
    .forEach((el) => el.remove())

  // 拆掉空壳 pane（保留内部带样式的内容）
  doc.querySelectorAll('.notebox-card-pane, .notebox-material-card-split').forEach((el) => {
    const wrap = doc.createElement('div')
    wrap.innerHTML = el.innerHTML
    const frag = doc.createDocumentFragment()
    while (wrap.firstChild) frag.appendChild(wrap.firstChild)
    el.replaceWith(frag)
  })

  const bodyHtml = (doc.body?.innerHTML || '').trim()
  if (!bodyHtml) return ''
  return styleBlocks ? `${styleBlocks}${bodyHtml}` : bodyHtml
}

/** 题目 + A/B/C/D 这类粘贴：有富文本 HTML 时保留样式，不再强转纯文本 */
export function shouldPreferPlainTextPaste(text: string, html: string): boolean {
  if (!text.trim()) return false
  if (!html.trim()) return true
  // 仅有极简包装、几乎无样式时才用纯文本
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(html|body|meta|link|head|style|xml)[^>]*>/gi, '')
    .trim()
  const textOnly = stripped.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const plain = text.replace(/\s+/g, ' ').trim()
  if (textOnly && plain && textOnly === plain && !/style\s*=|class\s*=|<img\b|<table\b|<span\b|<div\b[^>]+style/i.test(html)) {
    return true
  }
  return false
}

export function clipboardEventToHtml(e: ClipboardEvent): string {
  const html = e.clipboardData?.getData('text/html')?.trim() || ''
  const text = e.clipboardData?.getData('text/plain') ?? ''

  if (html) {
    // 先剥掉材料 card 外壳，但保留选项圆标、颜色等内联样式
    const cleaned = sanitizePastedHtml(html)
    if (cleaned && cleaned.replace(/<[^>]+>/g, '').trim()) {
      // 除非清理后只剩光秃文字且原 HTML 也无样式，否则用 HTML
      if (!shouldPreferPlainTextPaste(text, cleaned)) {
        return cleaned
      }
    }
  }

  if (shouldPreferPlainTextPaste(text, html)) {
    return plainTextToHtml(text)
  }
  if (html) {
    const cleaned = sanitizePastedHtml(html)
    if (cleaned) return cleaned
  }
  return plainTextToHtml(text)
}

export const MATERIAL_CARD_CSS = `
.notebox-editor .notebox-material-card {
  display: block;
  margin: 14px 0;
  border: 1px solid rgba(29, 43, 48, 0.14);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  overflow: visible;
  box-shadow: 0 1px 0 rgba(29, 43, 48, 0.04);
  position: relative;
}
.notebox-editor .notebox-material-card.is-active {
  border-color: #2e8b80;
  box-shadow: 0 0 0 2px rgba(46, 139, 128, 0.18);
}
.notebox-editor .notebox-material-card-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(46, 139, 128, 0.1);
  border-bottom: 1px solid rgba(29, 43, 48, 0.1);
  user-select: none;
}
.notebox-editor .notebox-material-card-label {
  font-family: system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #247a70;
}
.notebox-editor .notebox-card-cancel {
  font-family: system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #c44b4b;
  background: rgba(196, 75, 75, 0.08);
  border: 1px solid rgba(196, 75, 75, 0.25);
  border-radius: 7px;
  padding: 4px 10px;
  cursor: pointer;
  display: inline-block;
  line-height: 1.3;
  user-select: none;
}
.notebox-editor .notebox-card-cancel:hover {
  background: rgba(196, 75, 75, 0.14);
}
.notebox-editor .notebox-material-card-split {
  display: flex;
  flex-direction: row;
  height: 220px;
  min-height: 120px;
  max-height: 900px;
  align-items: stretch;
  overflow: hidden;
}
.notebox-editor .notebox-card-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(29, 43, 48, 0.1);
}
.notebox-editor .notebox-card-pane:last-child {
  border-right: none;
}
.notebox-editor .notebox-card-pane-title {
  font-family: system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #5d6d74;
  padding: 8px 12px 4px;
  flex-shrink: 0;
}
.notebox-editor .notebox-card-pane-body {
  flex: 1;
  min-height: 0;
  padding: 4px 12px 12px;
  outline: none;
  cursor: text;
  overflow: auto;
}
.notebox-editor .notebox-card-pane-body:focus {
  background: rgba(46, 139, 128, 0.04);
}
.notebox-editor .notebox-card-resize {
  height: 22px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    to bottom,
    rgba(46, 139, 128, 0.1),
    rgba(46, 139, 128, 0.28)
  );
  border-top: 1px solid rgba(29, 43, 48, 0.12);
  border-radius: 0 0 12px 12px;
  position: relative;
  z-index: 5;
  flex-shrink: 0;
  touch-action: none;
  user-select: none;
  pointer-events: auto;
}
.notebox-editor .notebox-card-resize-text {
  font-family: system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #247a70;
  pointer-events: none;
  letter-spacing: 0.02em;
}
.notebox-editor .notebox-material-card.is-resizing {
  border-color: #2e8b80;
  user-select: none;
}
.notebox-editor .notebox-material-card.is-resizing .notebox-card-resize {
  background: rgba(46, 139, 128, 0.22);
}
@media (max-width: 860px) {
  .notebox-editor .notebox-material-card-split {
    flex-direction: column;
  }
  .notebox-editor .notebox-card-pane {
    border-right: none;
    border-bottom: 1px solid rgba(29, 43, 48, 0.1);
    min-height: 80px;
  }
  .notebox-editor .notebox-card-pane:last-child {
    border-bottom: none;
  }
}
`
