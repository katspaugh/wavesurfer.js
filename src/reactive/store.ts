/**
 * Reactive primitives for managing state in WaveSurfer
 *
 * This module provides signal-based reactivity similar to SolidJS signals.
 * Signals are reactive values that notify subscribers when they change.
 */

/**
 * A reactive value that can be read and subscribed to
 */
export interface Signal<T> {
  /** Get the current value */
  get value(): T
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(callback: (value: T) => void): () => void
}

/**
 * A writable reactive value that can be updated
 */
export interface WritableSignal<T> extends Signal<T> {
  /** Set a new value. Only notifies if value changed. */
  set(value: T): void
  /** Update value using a function. */
  update(fn: (current: T) => T): void
}

/**
 * Create a reactive signal that notifies subscribers when its value changes
 *
 * @example
 * ```typescript
 * const count = signal(0)
 * count.subscribe(val => console.log('Count:', val))
 * count.set(5) // Logs: Count: 5
 * ```
 */
export function signal<T>(initialValue: T): WritableSignal<T> {
  let _value = initialValue
  const subscribers = new Set<(value: T) => void>()

  return {
    get value() {
      return _value
    },

    set(newValue: T) {
      // Only update and notify if value actually changed
      if (!Object.is(_value, newValue)) {
        _value = newValue
        subscribers.forEach((fn) => fn(_value))
      }
    },

    update(fn: (current: T) => T) {
      this.set(fn(_value))
    },

    subscribe(callback: (value: T) => void): () => void {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
  }
}

/**
 * Create a computed value that automatically updates when its dependencies change
 *
 * @example
 * ```typescript
 * const count = signal(0)
 * const doubled = computed(() => count.value * 2, [count])
 * console.log(doubled.value) // 0
 * count.set(5)
 * console.log(doubled.value) // 10
 * ```
 */
export function computed<T>(fn: () => T, dependencies: Signal<any>[]): Signal<T> {
  const result = signal<T>(fn())

  // Subscribe to all dependencies immediately
  // This ensures the computed value stays in sync even if no one is subscribed to it
  dependencies.forEach((dep) =>
    dep.subscribe(() => {
      const newValue = fn()
      // Update the result signal, which will notify our subscribers if value changed
      if (!Object.is(result.value, newValue)) {
        ;(result as WritableSignal<T>).set(newValue)
      }
    }),
  )

  // Return a read-only signal that proxies the result
  return {
    get value() {
      return result.value
    },

    subscribe(callback: (value: T) => void): () => void {
      // Just subscribe to result changes
      return result.subscribe(callback)
    },
  }
}

/**
 * Run a side effect automatically when dependencies change
 *
 * @param fn - Effect function. Can return a cleanup function.
 * @param dependencies - Signals that trigger the effect when they change
 * @returns Unsubscribe function that stops the effect and runs cleanup
 *
 * @example
 * ```typescript
 * const count = signal(0)
 * effect(() => {
 *   console.log('Count is:', count.value)
 *   return () => console.log('Cleanup')
 * }, [count])
 * count.set(5) // Logs: Cleanup, Count is: 5
 * ```
 */
export function effect(fn: () => void | (() => void), dependencies: Signal<any>[]): () => void {
  let cleanup: (() => void) | void

  const run = () => {
    // Run cleanup from previous execution
    if (cleanup) {
      cleanup()
      cleanup = undefined
    }
    // Run effect and capture new cleanup
    cleanup = fn()
  }

  // Subscribe to all dependencies
  const unsubscribes = dependencies.map((dep) => dep.subscribe(run))

  // Run effect immediately
  run()

  // Return function that unsubscribes and runs cleanup
  return () => {
    if (cleanup) {
      cleanup()
      cleanup = undefined
    }
    unsubscribes.forEach((unsub) => unsub())
  }
}
