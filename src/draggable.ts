/**
 * @deprecated Use createDragStream from './reactive/drag-stream.js' instead.
 * This function is maintained for backward compatibility but will be removed in a future version.
 */
export function makeDraggable(
  element: HTMLElement | null,
  onDrag: (dx: number, dy: number, x: number, y: number) => void,
  onStart?: (x: number, y: number) => void,
  onEnd?: (x: number, y: number) => void,
  threshold = 3,
  mouseButton = 0,
  touchDelay = 100,
): () => void {
  if (!element) return () => void 0

  const activePointers = new Map<number, PointerEvent>()
  const isTouchDevice = matchMedia('(pointer: coarse)').matches

  let unsubscribeDocument = () => void 0
  let clickCleanupTimeout: ReturnType<typeof setTimeout> | undefined

  // Clean up any previous document-level listeners before starting a new drag
  const safeCleanup = () => {
    if (clickCleanupTimeout != null) {
      clearTimeout(clickCleanupTimeout)
      clickCleanupTimeout = undefined
    }
    unsubscribeDocument()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== mouseButton) return

    // Clean up any stale document listeners from a previous drag that never ended
    safeCleanup()

    activePointers.set(event.pointerId, event)
    if (activePointers.size > 1) {
      return
    }

    let startX = event.clientX
    let startY = event.clientY
    let isDragging = false
    const touchStartTime = Date.now()

    const onPointerMove = (event: PointerEvent) => {
      if (event.defaultPrevented || activePointers.size > 1) {
        return
      }

      if (isTouchDevice && Date.now() - touchStartTime < touchDelay) return

      const x = event.clientX
      const y = event.clientY
      const dx = x - startX
      const dy = y - startY

      if (isDragging || Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        event.preventDefault()
        event.stopPropagation()

        const rect = element.getBoundingClientRect()
        const { left, top } = rect

        if (!isDragging) {
          onStart?.(startX - left, startY - top)
          isDragging = true
        }

        onDrag(dx, dy, x - left, y - top)

        startX = x
        startY = y
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      if (isDragging) {
        const x = event.clientX
        const y = event.clientY
        const rect = element.getBoundingClientRect()
        const { left, top } = rect

        onEnd?.(x - left, y - top)
      }
      unsubscribeDocument()
    }

    const onPointerLeave = (e: PointerEvent) => {
      activePointers.delete(e.pointerId)
      if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
        onPointerUp(e)
      }
    }

    const onClick = (event: MouseEvent) => {
      if (isDragging) {
        event.stopPropagation()
        event.preventDefault()
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.defaultPrevented || activePointers.size > 1) {
        return
      }
      if (isDragging) {
        event.preventDefault()
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointerout', onPointerLeave)
    document.addEventListener('pointercancel', onPointerLeave)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('click', onClick, { capture: true })

    unsubscribeDocument = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointerout', onPointerLeave)
      document.removeEventListener('pointercancel', onPointerLeave)
      document.removeEventListener('touchmove', onTouchMove)
      // Clear any previous click cleanup and schedule a new one
      if (clickCleanupTimeout != null) clearTimeout(clickCleanupTimeout)
      clickCleanupTimeout = setTimeout(() => {
        document.removeEventListener('click', onClick, { capture: true })
        clickCleanupTimeout = undefined
      }, 10)
    }
  }

  element.addEventListener('pointerdown', onPointerDown)

  return () => {
    safeCleanup()
    if (clickCleanupTimeout != null) {
      clearTimeout(clickCleanupTimeout)
      clickCleanupTimeout = undefined
    }
    element.removeEventListener('pointerdown', onPointerDown)
    activePointers.clear()
  }
}
