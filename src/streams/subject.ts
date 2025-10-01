/**
 * Subject - A stream that can be manually triggered
 * Acts as both observable and observer
 */

import { BaseStream, Observer, Subscription, type Stream } from './stream.js'

class SubscriptionImpl implements Subscription {
  private _closed = false

  constructor(private cleanup: () => void) {}

  unsubscribe(): void {
    if (!this._closed) {
      this._closed = true
      this.cleanup()
    }
  }

  get closed(): boolean {
    return this._closed
  }
}

export class Subject<T> extends BaseStream<T> {
  private observers: Set<Observer<T>> = new Set()
  private _closed = false

  constructor() {
    super((observer) => {
      if (this._closed) {
        return new SubscriptionImpl(() => {})
      }

      this.observers.add(observer)

      return new SubscriptionImpl(() => {
        this.observers.delete(observer)
      })
    })
  }

  /**
   * Emit a value to all observers
   */
  next(value: T): void {
    if (this._closed) return

    this.observers.forEach((observer) => {
      try {
        observer(value)
      } catch (error) {
        // Prevent one observer error from affecting others
        console.error('Error in stream observer:', error)
      }
    })
  }

  /**
   * Complete the subject - no more values will be emitted
   */
  complete(): void {
    this._closed = true
    this.observers.clear()
  }

  /**
   * Check if the subject is closed
   */
  get closed(): boolean {
    return this._closed
  }

  /**
   * Get the current number of observers
   */
  get observerCount(): number {
    return this.observers.size
  }
}

/**
 * BehaviorSubject - A subject that stores the latest value
 * New subscribers immediately receive the current value
 */
export class BehaviorSubject<T> extends BaseStream<T> {
  private observers: Set<Observer<T>> = new Set()
  private _closed = false

  constructor(private value: T) {
    super((observer) => {
      if (this._closed) {
        return new SubscriptionImpl(() => {})
      }

      this.observers.add(observer)

      // Immediately emit current value to new subscriber
      try {
        observer(this.value)
      } catch (error) {
        console.error('Error in stream observer:', error)
      }

      return new SubscriptionImpl(() => {
        this.observers.delete(observer)
      })
    })
  }

  /**
   * Emit a value to all observers and store it
   */
  next(value: T): void {
    if (this._closed) return

    this.value = value
    this.observers.forEach((observer) => {
      try {
        observer(value)
      } catch (error) {
        console.error('Error in stream observer:', error)
      }
    })
  }

  /**
   * Get the current value
   */
  getValue(): T {
    return this.value
  }

  /**
   * Complete the subject - no more values will be emitted
   */
  complete(): void {
    this._closed = true
    this.observers.clear()
  }

  /**
   * Check if the subject is closed
   */
  get closed(): boolean {
    return this._closed
  }

  /**
   * Get the current number of observers
   */
  get observerCount(): number {
    return this.observers.size
  }
}

/**
 * Create a subject
 */
export function createSubject<T>(): Subject<T> {
  return new Subject<T>()
}

/**
 * Create a behavior subject with an initial value
 */
export function createBehaviorSubject<T>(initialValue: T): BehaviorSubject<T> {
  return new BehaviorSubject<T>(initialValue)
}
