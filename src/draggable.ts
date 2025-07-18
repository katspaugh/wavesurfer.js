import Wavesurfer from './wavesurfer'

export function makeDraggable(
  element: HTMLElement | null,
  onDrag: (dx: number, dy: number, x: number, y: number) => void,
  onStart?: (x: number, y: number) => void,
  onEnd?: (x: number, y: number) => void,
  wavesurfer?: Wavesurfer,
  threshold = 3,
  mouseButton = 0,
  touchDelay = 100,
): () => void {
  if (!element) return () => void 0

  const isTouchDevice = matchMedia('(pointer: coarse)').matches

  let unsubscribeDocument = () => void 0

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== mouseButton) return

    event.preventDefault()
    event.stopPropagation()

    let startX = event.clientX
    let startY = event.clientY
    let lastX = event.clientX
    let lastScroll = wavesurfer?.getScroll() ?? 0

    let isDragging = false
    const touchStartTime = Date.now()

    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (isTouchDevice && Date.now() - touchStartTime < touchDelay) return

      const x = event.clientX

      const y = event.clientY
      const currentScroll = wavesurfer?.getScroll() ?? 0
      const scrollDiff = currentScroll - lastScroll
      lastScroll = currentScroll
      const dx = x + scrollDiff - startX
      const dy = y - startY
      lastX = x

      if (isDragging || Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
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
      if (isDragging) {
        const x = event.clientX
        const y = event.clientY
        const rect = element.getBoundingClientRect()
        const { left, top } = rect

        onEnd?.(x - left, y - top)
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

    const onScroll = () => {
      if (!isDragging || !wavesurfer) {
        return
      }

      const currentScroll = wavesurfer.getScroll()
      const scrollDiff = currentScroll - lastScroll
      lastScroll = currentScroll

      const { left } = element.getBoundingClientRect()

      onDrag(scrollDiff, 0, lastX - left, 0)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('click', onClick, { capture: true })
    wavesurfer?.on('scroll', onScroll)
    unsubscribeDocument = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      wavesurfer?.un('scroll', onScroll)
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
