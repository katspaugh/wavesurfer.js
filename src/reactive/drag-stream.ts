/**
 * Reactive drag stream utilities
 *
 * Provides declarative drag handling using reactive streams.
 * Automatically handles mouseup cleanup and supports constraints.
 */

import { signal, type Signal } from './store.js'

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
 * @param element - Element to make draggable. Typed as the base `Element` (not `HTMLElement`)
 *   so SVG elements (envelope.ts's polyline/handle circles) can be passed directly, without an
 *   `as unknown as HTMLElement` cast -- every DOM API this function touches
 *   (getBoundingClientRect, add/removeEventListener) is declared on `Element`/`EventTarget`, not
 *   `HTMLElement` specifically.
 * @param options - Drag configuration options
 * @returns Signal emitting drag events and cleanup function
 */
export function createDragStream(
  element: Element,
  options: DragStreamOptions = {},
): { signal: Signal<DragEvent | null>; cleanup: () => void } {
  const { threshold = 3, mouseButton = 0, touchDelay = 100 } = options

  const dragSignal = signal<DragEvent | null>(null)
  const activePointers = new Map<number, PointerEvent>()
  const isTouchDevice = matchMedia('(pointer: coarse)').matches

  let unsubscribeDocument = () => void 0

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== mouseButton) return
    if (activePointers.has(event.pointerId)) return

    activePointers.set(event.pointerId, event)
    if (activePointers.size > 1) {
      return
    }

    const dragPointerId = event.pointerId
    let startX = event.clientX
    let startY = event.clientY
    let isDragging = false
    const touchStartTime = Date.now()

    const rect = element.getBoundingClientRect()
    const { left, top } = rect

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) return
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
      // Only react to pointers that started on the element
      if (!activePointers.delete(event.pointerId)) return

      // Only the pointer that started the drag can end it
      if (event.pointerId === dragPointerId && isDragging) {
        const x = event.clientX
        const y = event.clientY

        // Emit end event
        dragSignal.set({
          type: 'end',
          x: x - left,
          y: y - top,
        })
      }

      // Keep listening until all pointers are released
      if (activePointers.size === 0) {
        unsubscribeDocument()
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

    // Listen on window (not document) so a drag survives the pointer leaving
    // the document, and don't end the drag on 'pointerout': when the container
    // auto-scrolls under a stationary pointer (e.g. dragging a region to the
    // edge of a scrolling waveform), the element moves out from under the
    // pointer and a spurious pointerout would otherwise kill the drag.
    // 'pointercancel' is still honored -- the browser fires no pointerup after
    // it, so ignoring it would leave the drag stuck until the next pointerup.
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('click', onClick, { capture: true })

    unsubscribeDocument = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.removeEventListener('touchmove', onTouchMove)
      setTimeout(() => {
        document.removeEventListener('click', onClick, { capture: true })
      }, 10)
    }
  }

  // Element (unlike HTMLElement) doesn't merge GlobalEventHandlersEventMap into its
  // addEventListener overloads, so 'pointerdown' isn't a recognized key on the plain-Element
  // overload -- cast to the generic EventListener form at the call site only; onPointerDown
  // itself stays declared as `(event: PointerEvent) => void` everywhere else in this file.
  element.addEventListener('pointerdown', onPointerDown as EventListener)

  const cleanupFn = () => {
    unsubscribeDocument()
    element.removeEventListener('pointerdown', onPointerDown as EventListener)
    activePointers.clear()
  }

  return {
    signal: dragSignal,
    cleanup: cleanupFn,
  }
}
