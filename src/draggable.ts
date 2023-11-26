export function makeDraggable(
  element: HTMLElement | null,
  onDrag: (dx: number, dy: number, x: number, y: number) => void,
  onStart?: (x: number, y: number) => void,
  onEnd?: () => void,
  threshold = 3,
  mouseButton = 0,
): () => void {
  if (!element) return () => void 0

  let unsubscribeDocument = () => void 0

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== mouseButton) return

    event.preventDefault()
    event.stopPropagation()

    let startX = event.clientX
    let startY = event.clientY
    let isDragging = false

    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const x = event.clientX
      const y = event.clientY
      const dx = x - startX
      const dy = y - startY
      startX = x
      startY = y

      if (isDragging || Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        const rect = element.getBoundingClientRect()
        const { left, top } = rect

        if (!isDragging) {
          onStart?.(startX - left, startY - top)
          isDragging = true
        }

        onDrag(dx, dy, x - left, y - top)
      }
    }

    const onPointerUp = () => {
      if (isDragging) {
        onEnd?.()
      }
      unsubscribeDocument()
    }

    const onClick = (event: MouseEvent) => {
      if (isDragging) {
        event.stopPropagation()
        event.preventDefault()
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (isDragging) {
        event.preventDefault()
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('click', onClick, { capture: true })

    unsubscribeDocument = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      setTimeout(() => {
        document.removeEventListener('click', onClick, { capture: true })
      }, 10)
    }
  }

  element.addEventListener('pointerdown', onPointerDown)

  return () => {
    unsubscribeDocument()
    element.removeEventListener('pointerdown', onPointerDown)
  }
}
