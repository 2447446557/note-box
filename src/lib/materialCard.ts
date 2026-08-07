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
  return `
<div class="notebox-material-card" ${CARD_ATTR}="${CARD_VALUE}" data-card-id="${id}" contenteditable="false">
  <div class="notebox-material-card-bar" contenteditable="false">
    <span class="notebox-material-card-label">材料对照</span>
    <button type="button" class="notebox-card-cancel" contenteditable="false" data-card-action="cancel">取消 card</button>
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
  return trimmed
}

/** 给旧版 card 补上高度拖拽条 */
export function ensureMaterialCardChrome(root: HTMLElement): void {
  root.querySelectorAll(`[${CARD_ATTR}="${CARD_VALUE}"]`).forEach((node) => {
    const card = node as HTMLElement
    const split = card.querySelector(
      '.notebox-material-card-split',
    ) as HTMLElement | null
    if (split && !split.style.height) {
      const h = Math.round(split.getBoundingClientRect().height || 220)
      split.style.height = `${Math.max(MIN_CARD_HEIGHT, h)}px`
    }
    if (!card.querySelector('.notebox-card-resize')) {
      const handle = document.createElement('div')
      handle.className = 'notebox-card-resize'
      handle.contentEditable = 'false'
      handle.setAttribute('data-card-action', 'resize')
      handle.title = '拖动调整高度'
      const tip = document.createElement('span')
      tip.className = 'notebox-card-resize-text'
      tip.textContent = '拖动调整高度'
      handle.appendChild(tip)
      card.appendChild(handle)
    }
  })
}

/** 取消 card：把左右内容依次展开到原位置 */
export function unwrapMaterialCard(card: HTMLElement): void {
  const material =
    card.querySelector('.notebox-card-material-body')?.innerHTML ?? ''
  const questions =
    card.querySelector('.notebox-card-questions-body')?.innerHTML ?? ''

  const parts = [normalizePaneHtml(material), normalizePaneHtml(questions)].filter(
    Boolean,
  )
  const html = parts.length ? parts.join('') : '<p><br></p>'

  const wrap = document.createElement('div')
  wrap.innerHTML = html
  const fragment = document.createDocumentFragment()
  while (wrap.firstChild) fragment.appendChild(wrap.firstChild)

  const parent = card.parentNode
  if (!parent) return
  parent.insertBefore(fragment, card)
  parent.removeChild(card)
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
