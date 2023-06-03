export function makeDraggable(
  element: HTMLElement | null,
  onDrag: (dx: number, dy: number, x: number, y: number) => void,
  onStart?: (x: number, y: number) => void,
  onEnd?: () => void,
  threshold = 5,
): () => void {
  let unsub = () => {
    return
  }

  if (!element) return unsub

  const down = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()

    let startX = e.clientX
    let startY = e.clientY
    let isDragging = false

    const move = (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const x = e.clientX
      const y = e.clientY

      if (isDragging || Math.abs(x - startX) >= threshold || Math.abs(y - startY) >= threshold) {
        if (!isDragging) {
          isDragging = true
          onStart?.(startX, startY)
        }

        const { left, top } = element.getBoundingClientRect()
        onDrag(x - startX, y - startY, x - left, y - top)
        startX = x
        startY = y
      }
    }

    const click = (e: Event) => {
      if (isDragging) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    unsub = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      setTimeout(() => {
        document.removeEventListener('click', click, true)
      }, 10)
    }

    const up = () => {
      if (isDragging) {
        onEnd?.()
      }
      unsub()
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('click', click, true)
  }

  element.addEventListener('pointerdown', down)

  return () => {
    unsub()
    element.removeEventListener('pointerdown', down)
  }
}
