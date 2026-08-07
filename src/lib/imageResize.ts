/** Click-to-select + edge/corner drag resize for images in the editor. */

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const SELECTED_CLASS = 'notebox-img-selected'

export function stripImageSelection(html: string): string {
  return html
    .replace(new RegExp(`\\s*${SELECTED_CLASS}`, 'g'), '')
    .replace(/\sclass=""/g, '')
    .replace(/\sclass=''/g, '')
}

export function clearSelectedImages(root: HTMLElement) {
  root.querySelectorAll(`img.${SELECTED_CLASS}`).forEach((img) => {
    img.classList.remove(SELECTED_CLASS)
  })
}

export function selectImage(root: HTMLElement, img: HTMLImageElement) {
  clearSelectedImages(root)
  img.classList.add(SELECTED_CLASS)
}

/** Viewport box for position:fixed overlay (matches image on screen). */
export interface OverlayBox {
  top: number
  left: number
  width: number
  height: number
}

export function measureOverlay(img: HTMLImageElement): OverlayBox {
  const ir = img.getBoundingClientRect()
  return {
    top: ir.top,
    left: ir.left,
    width: Math.max(1, ir.width),
    height: Math.max(1, ir.height),
  }
}

export function startImageResize(options: {
  img: HTMLImageElement
  handle: ResizeHandle
  clientX: number
  clientY: number
  maxWidth: number
  onMove: () => void
  onEnd: () => void
}) {
  const { img, handle, clientX, clientY, maxWidth, onMove, onEnd } = options
  const startX = clientX
  const startY = clientY
  const startW = img.getBoundingClientRect().width
  const startH = img.getBoundingClientRect().height
  const ratio = startW > 0 ? startH / startW : 1

  const onPointerMove = (e: PointerEvent) => {
    e.preventDefault()
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    let nextW = startW
    if (handle.includes('e')) nextW = startW + dx
    else if (handle.includes('w')) nextW = startW - dx
    else if (handle === 'n' || handle === 's') {
      const nextH = handle === 's' ? startH + dy : startH - dy
      nextW = ratio > 0 ? nextH / ratio : startW
    }

    nextW = Math.max(48, Math.min(maxWidth, nextW))
    img.style.width = `${Math.round(nextW)}px`
    img.style.height = 'auto'
    img.style.maxWidth = '100%'
    img.removeAttribute('width')
    img.removeAttribute('height')
    onMove()
  }

  const onPointerUp = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    onEnd()
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
