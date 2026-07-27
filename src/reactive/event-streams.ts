/**
 * Event stream utilities for converting DOM events to reactive signals
 *
 * These utilities allow composing event handling using reactive primitives.
 */

import { signal, type Signal, type WritableSignal } from './store.js'

/**
 * Convert DOM events to a reactive signal
 *
 * @example
 * ```typescript
 * const clicks = fromEvent(button, 'click')
 * clicks.subscribe(event => console.log('Clicked!', event))
 * ```
 */
export function fromEvent<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  eventName: K,
): WritableSignal<HTMLElementEventMap[K] | null> {
  const stream = signal<HTMLElementEventMap[K] | null>(null)

  const handler = (event: HTMLElementEventMap[K]) => {
    stream.set(event)
  }

  element.addEventListener(eventName, handler)

  // Store cleanup function on the signal
  ;(stream as any)._cleanup = () => {
    element.removeEventListener(eventName, handler)
  }

  return stream
}

/**
 * Cleanup a stream created with event stream utilities
 *
 * This removes event listeners and unsubscribes from sources.
 */
export function cleanup(stream: Signal<any>): void {
  const cleanupFn = (stream as any)._cleanup
  if (typeof cleanupFn === 'function') {
    cleanupFn()
  }
}
