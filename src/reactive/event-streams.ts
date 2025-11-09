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
 * Transform stream values using a mapping function
 *
 * @example
 * ```typescript
 * const clicks = fromEvent(button, 'click')
 * const positions = map(clicks, e => e ? e.clientX : 0)
 * ```
 */
export function map<T, U>(source: Signal<T>, mapper: (value: T) => U): Signal<U> {
  const result = signal<U>(mapper(source.value))

  const unsubscribe = source.subscribe((value) => {
    ;(result as WritableSignal<U>).set(mapper(value))
  })

  // Store cleanup
  ;(result as any)._cleanup = unsubscribe

  return result
}

/**
 * Filter stream values based on a predicate
 *
 * @example
 * ```typescript
 * const numbers = signal(5)
 * const evenOnly = filter(numbers, n => n % 2 === 0)
 * ```
 */
export function filter<T>(source: Signal<T>, predicate: (value: T) => boolean): Signal<T | null> {
  const initialValue = predicate(source.value) ? source.value : null
  const result = signal<T | null>(initialValue)

  const unsubscribe = source.subscribe((value) => {
    if (predicate(value)) {
      ;(result as WritableSignal<T | null>).set(value)
    } else {
      ;(result as WritableSignal<T | null>).set(null)
    }
  })

  // Store cleanup
  ;(result as any)._cleanup = unsubscribe

  return result
}

/**
 * Debounce stream updates - wait for quiet period before emitting
 *
 * @example
 * ```typescript
 * const input = fromEvent(textField, 'input')
 * const debounced = debounce(input, 300) // Wait 300ms after last input
 * ```
 */
export function debounce<T>(source: Signal<T>, delay: number): Signal<T> {
  const result = signal<T>(source.value)
  let timeout: ReturnType<typeof setTimeout> | undefined

  const unsubscribe = source.subscribe((value) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      ;(result as WritableSignal<T>).set(value)
    }, delay)
  })

  // Store cleanup that clears timeout and unsubscribes
  ;(result as any)._cleanup = () => {
    clearTimeout(timeout)
    unsubscribe()
  }

  return result
}

/**
 * Throttle stream updates - limit update frequency
 *
 * Emits immediately, then waits before allowing next emission.
 * Different from debounce which waits for quiet period.
 *
 * @example
 * ```typescript
 * const scroll = fromEvent(window, 'scroll')
 * const throttled = throttle(scroll, 100) // Max once per 100ms
 * ```
 */
export function throttle<T>(source: Signal<T>, delay: number): Signal<T> {
  const result = signal<T>(source.value)
  let lastEmit = 0
  let timeout: ReturnType<typeof setTimeout> | undefined

  const unsubscribe = source.subscribe((value) => {
    const now = Date.now()
    const timeSinceLastEmit = now - lastEmit

    if (timeSinceLastEmit >= delay) {
      // Enough time has passed, emit immediately
      ;(result as WritableSignal<T>).set(value)
      lastEmit = now
    } else {
      // Too soon, schedule for later
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        ;(result as WritableSignal<T>).set(value)
        lastEmit = Date.now()
      }, delay - timeSinceLastEmit)
    }
  })

  // Store cleanup
  ;(result as any)._cleanup = () => {
    clearTimeout(timeout)
    unsubscribe()
  }

  return result
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
