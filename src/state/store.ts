/**
 * State store for immutable state management
 * Provides centralized state with reactive updates
 */

import { BehaviorSubject, type Stream } from '../streams/index.js'

export type StateUpdate<S> = (state: S) => S

/**
 * Simple deep equality check for state values
 * Handles primitives, arrays, and plain objects
 */
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true

  if (a == null || b == null) return false

  if (typeof a !== 'object' || typeof b !== 'object') return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((val, idx) => deepEqual(val, b[idx]))
  }

  if (Array.isArray(a) || Array.isArray(b)) return false

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key => deepEqual((a as any)[key], (b as any)[key]))
}

export class StateStore<S> {
  private readonly subject: BehaviorSubject<S>

  constructor(initialState: S) {
    this.subject = new BehaviorSubject(initialState)
  }

  /**
   * Get the current state snapshot
   */
  get snapshot(): S {
    return this.subject.getValue()
  }

  /**
   * Update the state using an updater function
   * Only emits if the state reference changes
   */
  update(updater: StateUpdate<S>): void {
    const currentState = this.subject.getValue()
    const newState = updater(currentState)

    // Only emit if state reference changed
    if (newState !== currentState) {
      this.subject.next(newState)
    }
  }

  /**
   * Set the state directly
   */
  set(state: S): void {
    const currentState = this.subject.getValue()
    if (state !== currentState) {
      this.subject.next(state)
    }
  }

  /**
   * Get the full state stream
   */
  get stream(): Stream<S> {
    return this.subject
  }

  /**
   * Select a slice of state and create a derived stream
   * Only emits when the selected value changes
   * Uses deep equality by default for objects, can provide custom comparator
   */
  select<T>(
    selector: (state: S) => T,
    compareFn?: (prev: T, curr: T) => boolean
  ): Stream<T> {
    const compare = compareFn || ((a, b) => {
      // Use reference equality for primitives, deep equality for objects
      if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return a === b
      }
      return deepEqual(a, b)
    })
    return this.subject.map(selector).distinct(compare)
  }

  /**
   * Select multiple slices and combine them
   * Uses deep equality to prevent unnecessary emissions
   */
  selectMany<T extends any[]>(
    ...selectors: { [K in keyof T]: (state: S) => T[K] }
  ): Stream<T> {
    return this.subject
      .map((state) => selectors.map((selector) => selector(state)) as T)
      .distinct((a, b) => deepEqual(a, b))
  }

  /**
   * Subscribe to state changes
   */
  subscribe(observer: (state: S) => void) {
    return this.subject.subscribe(observer)
  }

  /**
   * Complete the store - no more updates
   */
  complete(): void {
    this.subject.complete()
  }
}

/**
 * Create a state store with initial state
 */
export function createStore<S>(initialState: S): StateStore<S> {
  return new StateStore(initialState)
}
