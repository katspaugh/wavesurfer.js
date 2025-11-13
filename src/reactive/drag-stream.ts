/**
 * Reactive drag stream utilities
 *
 * Provides declarative drag handling using reactive streams.
 * Automatically handles mouseup cleanup and supports constraints.
 */

import { signal, type Signal } from './store.js'
import { cleanup } from './event-streams.js'

export interface DragEvent {
  type: 'start' | 'move' | 'end'
  x: number
  y: number
  deltaX?: number
  deltaY?: number
}

export interface DragStreamOptions {
  /** Minimum distance to move before dragging starts (default: 3) */
  threshold?: number
  /** Mouse button to listen for (default: 0 = left button) */
  mouseButton?: number
  /** Delay before touch drag starts in ms (default: 100) */
  touchDelay?: number
}

/**
 * Create a reactive drag stream from an element
 *
 * Emits drag events (start, move, end) as the user drags the element.
 * Automatically handles pointer capture, multi-touch prevention, and cleanup.
 *
 * @example
 * ```typescript
 * const dragSignal = createDragStream(element)
 *
 * effect(() => {
 *   const drag = dragSignal.value
 *   if (drag?.type === 'move') {
 *     console.log('Dragging:', drag.deltaX, drag.deltaY)
 *   }
 * }, [dragSignal])
 * ```
 *
 * @param element - Element to make draggable
 * @param options - Drag configuration options
 * @returns Signal emitting drag events and cleanup function
 */
export function createDragStream(
  element: HTMLElement,
  options: DragStreamOptions = {},
): { signal: Signal<DragEvent | null>; cleanup: () => void } {
  const { threshold = 3, mouseButton = 0, touchDelay = 100 } = options

  const dragSignal = signal<DragEvent | null>(null)
  const activePointers = new Map<number, PointerEvent>()
  const isTouchDevice = matchMedia('(pointer: coarse)').matches

  let unsubscribeDocument = () => void 0

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== mouseButton) return

    activePointers.set(event.pointerId, event)
    if (activePointers.size > 1) {
      return
    }

    let startX = event.clientX
    let startY = event.clientY
    let isDragging = false
    const touchStartTime = Date.now()

    const rect = element.getBoundingClientRect()
    const { left, top } = rect

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

        if (!isDragging) {
          // Emit start event
          dragSignal.set({
            type: 'start',
            x: startX - left,
            y: startY - top,
          })
          isDragging = true
        }

        // Emit move event
        dragSignal.set({
          type: 'move',
          x: x - left,
          y: y - top,
          deltaX: dx,
          deltaY: dy,
        })

        startX = x
        startY = y
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      if (isDragging) {
        const x = event.clientX
        const y = event.clientY

        // Emit end event
        dragSignal.set({
          type: 'end',
          x: x - left,
          y: y - top,
        })
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
      setTimeout(() => {
        document.removeEventListener('click', onClick, { capture: true })
      }, 10)
    }
  }

  element.addEventListener('pointerdown', onPointerDown)

  const cleanupFn = () => {
    unsubscribeDocument()
    element.removeEventListener('pointerdown', onPointerDown)
    activePointers.clear()
    cleanup(dragSignal)
  }

  return {
    signal: dragSignal,
    cleanup: cleanupFn,
  }
}
