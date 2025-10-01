/**
 * Additional stream operators for composing data flows
 */

import { createStream, type Stream } from './stream.js'

/**
 * Log error with WaveSurfer prefix
 */
function logError(context: string, error: unknown): void {
  console.error(`[wavesurfer] ${context}:`, error)
}

/**
 * Combine multiple streams into one
 */
export function combineStreams<T extends any[]>(
  ...streams: { [K in keyof T]: Stream<T[K]> }
): Stream<T> {
  return createStream((observer) => {
    const values: any[] = new Array(streams.length)
    const hasValue: boolean[] = new Array(streams.length).fill(false)

    const emit = () => {
      if (hasValue.every((v) => v)) {
        observer([...values] as T)
      }
    }

    const subscriptions = streams.map((stream, index) =>
      stream.subscribe((value) => {
        values[index] = value
        hasValue[index] = true
        emit()
      })
    )

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    }
  })
}

/**
 * Merge multiple streams into one
 */
export function mergeStreams<T>(...streams: Stream<T>[]): Stream<T> {
  return createStream((observer) => {
    const subscriptions = streams.map((stream) => stream.subscribe(observer))

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    }
  })
}

/**
 * Map to a new stream and flatten
 */
export function switchMap<T, U>(
  stream: Stream<T>,
  fn: (value: T) => Stream<U>
): Stream<U> {
  return createStream((observer) => {
    let innerSubscription: ReturnType<Stream<U>['subscribe']> | null = null

    const outerSubscription = stream.subscribe((value) => {
      // Unsubscribe from previous inner stream
      if (innerSubscription) {
        innerSubscription.unsubscribe()
      }

      // Subscribe to new inner stream
      try {
        const innerStream = fn(value)
        innerSubscription = innerStream.subscribe(observer)
      } catch (error) {
        logError('Error in switchMap operator', error)
      }
    })

    return () => {
      outerSubscription.unsubscribe()
      if (innerSubscription) {
        innerSubscription.unsubscribe()
      }
    }
  })
}

/**
 * Scan - like reduce but emits intermediate values
 */
export function scan<T, U>(
  stream: Stream<T>,
  reducer: (acc: U, value: T) => U,
  seed: U
): Stream<U> {
  return createStream((observer) => {
    let accumulator = seed

    return stream.subscribe((value) => {
      try {
        accumulator = reducer(accumulator, value)
        observer(accumulator)
      } catch (error) {
        logError('Error in scan operator', error)
      }
    })
  })
}

/**
 * StartWith - emit initial value before stream values
 */
export function startWith<T>(stream: Stream<T>, initialValue: T): Stream<T> {
  return createStream((observer) => {
    observer(initialValue)
    return stream.subscribe(observer)
  })
}

/**
 * WithLatestFrom - combine with latest value from another stream
 */
export function withLatestFrom<T, U, R>(
  stream: Stream<T>,
  other: Stream<U>,
  fn: (a: T, b: U) => R
): Stream<R> {
  return createStream((observer) => {
    let hasOther = false
    let latestOther: U

    const otherSub = other.subscribe((value) => {
      latestOther = value
      hasOther = true
    })

    const mainSub = stream.subscribe((value) => {
      if (hasOther) {
        try {
          observer(fn(value, latestOther))
        } catch (error) {
          logError('Error in withLatestFrom operator', error)
        }
      }
    })

    return () => {
      mainSub.unsubscribe()
      otherSub.unsubscribe()
    }
  })
}

/**
 * Delay - emit values after a delay
 */
export function delay<T>(stream: Stream<T>, ms: number): Stream<T> {
  return createStream((observer) => {
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const subscription = stream.subscribe((value) => {
      const timeoutId = setTimeout(() => {
        observer(value)
        const index = timeouts.indexOf(timeoutId)
        if (index > -1) {
          timeouts.splice(index, 1)
        }
      }, ms)
      timeouts.push(timeoutId)
    })

    return () => {
      subscription.unsubscribe()
      timeouts.forEach((id) => clearTimeout(id))
    }
  })
}

/**
 * Skip - skip the first n values
 */
export function skip<T>(stream: Stream<T>, count: number): Stream<T> {
  return createStream((observer) => {
    let skipped = 0

    return stream.subscribe((value) => {
      if (skipped >= count) {
        observer(value)
      } else {
        skipped++
      }
    })
  })
}

/**
 * Tap - perform side effect without modifying the stream
 */
export function tap<T>(stream: Stream<T>, fn: (value: T) => void): Stream<T> {
  return createStream((observer) => {
    return stream.subscribe((value) => {
      try {
        fn(value)
      } catch (error) {
        logError('Error in tap operator', error)
      }
      observer(value)
    })
  })
}
