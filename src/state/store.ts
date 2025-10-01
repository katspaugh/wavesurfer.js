/**
 * State store for immutable state management
 * Provides centralized state with reactive updates
 */

import { BehaviorSubject, type Stream } from '../streams/index.js'

export type StateUpdate<S> = (state: S) => S

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
   */
  select<T>(selector: (state: S) => T): Stream<T> {
    return this.subject.map(selector).distinct()
  }

  /**
   * Select multiple slices and combine them
   */
  selectMany<T extends any[]>(
    ...selectors: { [K in keyof T]: (state: S) => T[K] }
  ): Stream<T> {
    return this.subject.map((state) => selectors.map((selector) => selector(state)) as T).distinct()
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
