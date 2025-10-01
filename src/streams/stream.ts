/**
 * Stream abstraction for reactive data flow
 * Provides observable pattern with composable operators
 */

export interface Subscription {
  unsubscribe(): void
  readonly closed: boolean
}

export type Observer<T> = (value: T) => void

export interface Stream<T> {
  subscribe(observer: Observer<T>): Subscription
  map<U>(fn: (value: T) => U): Stream<U>
  filter(predicate: (value: T) => boolean): Stream<T>
  distinct(compareFn?: (prev: T, curr: T) => boolean): Stream<T>
  debounce(ms: number): Stream<T>
  throttle(ms: number): Stream<T>
  take(count: number): Stream<T>
  takeUntil(notifier: Stream<any>): Stream<T>
  combine<U, R>(other: Stream<U>, fn: (a: T, b: U) => R): Stream<R>
  share(): Stream<T>
}

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

/**
 * Base Stream implementation
 */
export class BaseStream<T> implements Stream<T> {
  constructor(
    protected subscribeImpl: (observer: Observer<T>) => Subscription
  ) {}

  subscribe(observer: Observer<T>): Subscription {
    return this.subscribeImpl(observer)
  }

  map<U>(fn: (value: T) => U): Stream<U> {
    return new BaseStream<U>((observer) => {
      return this.subscribe((value) => {
        try {
          observer(fn(value))
        } catch (error) {
          // Silently ignore errors in transformations
          // Production code should handle this more gracefully
        }
      })
    })
  }

  filter(predicate: (value: T) => boolean): Stream<T> {
    return new BaseStream<T>((observer) => {
      return this.subscribe((value) => {
        try {
          if (predicate(value)) {
            observer(value)
          }
        } catch (error) {
          // Silently ignore errors in predicates
        }
      })
    })
  }

  distinct(compareFn: (prev: T, curr: T) => boolean = (a, b) => a === b): Stream<T> {
    return new BaseStream<T>((observer) => {
      let hasValue = false
      let lastValue: T

      return this.subscribe((value) => {
        if (!hasValue || !compareFn(lastValue, value)) {
          hasValue = true
          lastValue = value
          observer(value)
        }
      })
    })
  }

  debounce(ms: number): Stream<T> {
    return new BaseStream<T>((observer) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      const subscription = this.subscribe((value) => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(() => {
          timeoutId = undefined
          observer(value)
        }, ms)
      })

      return new SubscriptionImpl(() => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
        subscription.unsubscribe()
      })
    })
  }

  throttle(ms: number): Stream<T> {
    return new BaseStream<T>((observer) => {
      let lastEmit = 0

      return this.subscribe((value) => {
        const now = Date.now()
        if (now - lastEmit >= ms) {
          lastEmit = now
          observer(value)
        }
      })
    })
  }

  take(count: number): Stream<T> {
    return new BaseStream<T>((observer) => {
      let taken = 0
      const subscription = this.subscribe((value) => {
        if (taken < count) {
          taken++
          observer(value)
          if (taken >= count) {
            subscription.unsubscribe()
          }
        }
      })
      return subscription
    })
  }

  takeUntil(notifier: Stream<any>): Stream<T> {
    return new BaseStream<T>((observer) => {
      const subscription = this.subscribe(observer)
      const notifierSub = notifier.subscribe(() => {
        subscription.unsubscribe()
        notifierSub.unsubscribe()
      })

      return new SubscriptionImpl(() => {
        subscription.unsubscribe()
        notifierSub.unsubscribe()
      })
    })
  }

  combine<U, R>(other: Stream<U>, fn: (a: T, b: U) => R): Stream<R> {
    return new BaseStream<R>((observer) => {
      let hasA = false
      let hasB = false
      let lastA: T
      let lastB: U

      const emit = () => {
        if (hasA && hasB) {
          try {
            observer(fn(lastA, lastB))
          } catch (error) {
            // Silently ignore errors
          }
        }
      }

      const subA = this.subscribe((value) => {
        lastA = value
        hasA = true
        emit()
      })

      const subB = other.subscribe((value) => {
        lastB = value
        hasB = true
        emit()
      })

      return new SubscriptionImpl(() => {
        subA.unsubscribe()
        subB.unsubscribe()
      })
    })
  }

  share(): Stream<T> {
    let refCount = 0
    let subscription: Subscription | null = null
    const observers: Set<Observer<T>> = new Set()

    return new BaseStream<T>((observer) => {
      observers.add(observer)
      refCount++

      if (refCount === 1) {
        subscription = this.subscribe((value) => {
          observers.forEach((obs) => obs(value))
        })
      }

      return new SubscriptionImpl(() => {
        observers.delete(observer)
        refCount--
        if (refCount === 0 && subscription) {
          subscription.unsubscribe()
          subscription = null
        }
      })
    })
  }
}

/**
 * Create a stream from a subscribe function
 */
export function createStream<T>(
  subscribe: (observer: Observer<T>) => Subscription | (() => void)
): Stream<T> {
  return new BaseStream<T>((observer) => {
    const result = subscribe(observer)
    if (typeof result === 'function') {
      return new SubscriptionImpl(result)
    }
    return result
  })
}
