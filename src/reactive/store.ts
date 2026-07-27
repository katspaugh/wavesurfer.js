/**
 * Reactive primitives for managing state in WaveSurfer.
 * Signals notify synchronously; use batch() to coalesce. computed/effect
 * auto-track dependencies when no dependency array is given, and are
 * always disposable.
 */

export interface Signal<T> {
  get value(): T
  subscribe(callback: (value: T) => void): () => void
}

export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void
  update(fn: (current: T) => T): void
}

export interface ComputedSignal<T> extends Signal<T> {
  dispose(): void
}

type AnySignal = Signal<unknown>

let activeTracker: Set<AnySignal> | null = null
let batchDepth = 0
const pendingNotifications = new Set<() => void>()

export function batch(fn: () => void): void {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      const pending = [...pendingNotifications]
      pendingNotifications.clear()
      pending.forEach((notify) => notify())
    }
  }
}

export function signal<T>(initialValue: T): WritableSignal<T> {
  let _value = initialValue
  const subscribers = new Set<(value: T) => void>()
  let notifying = false
  let settleAgain = false

  const notifyAll = () => {
    if (notifying) {
      settleAgain = true
      return
    }
    notifying = true
    try {
      do {
        settleAgain = false
        const snapshot = [...subscribers]
        const valueAtStart = _value
        for (const fn of snapshot) {
          try {
            fn(valueAtStart)
          } catch (err) {
            console.error('Signal subscriber error:', err)
          }
          // A subscriber changed the value again; abort this pass, the
          // settle loop delivers the newer value to everyone
          if (!Object.is(_value, valueAtStart)) {
            settleAgain = true
            break
          }
        }
      } while (settleAgain)
    } finally {
      notifying = false
    }
  }

  const self: WritableSignal<T> = {
    get value() {
      activeTracker?.add(self)
      return _value
    },

    set(newValue: T) {
      if (Object.is(_value, newValue)) return
      _value = newValue
      if (batchDepth > 0) {
        pendingNotifications.add(notifyAll)
      } else {
        notifyAll()
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

  return self
}

/** Run fn, recording which signals it reads. Returns [result, dependencies]. */
function track<T>(fn: () => T): [T, Set<AnySignal>] {
  const previousTracker = activeTracker
  const deps = new Set<AnySignal>()
  activeTracker = deps
  try {
    return [fn(), deps]
  } finally {
    activeTracker = previousTracker
  }
}

export function computed<T>(fn: () => T, dependencies?: Signal<any>[]): ComputedSignal<T> {
  const result = signal<T>(undefined as T)
  let unsubscribes: Array<() => void> = []
  let disposed = false

  const recompute = () => {
    if (disposed) return
    if (dependencies) {
      result.set(fn())
    } else {
      // Auto-tracked: re-collect dependencies on every run so
      // conditional reads stay correct
      unsubscribes.forEach((unsub) => unsub())
      const [value, deps] = track(fn)
      unsubscribes = [...deps].map((dep) => dep.subscribe(recompute))
      result.set(value)
    }
  }

  if (dependencies) {
    unsubscribes = dependencies.map((dep) => dep.subscribe(recompute))
    result.set(fn())
  } else {
    recompute()
  }

  const dispose = () => {
    disposed = true
    unsubscribes.forEach((unsub) => unsub())
    unsubscribes = []
  }

  const readonly: ComputedSignal<T> = {
    get value() {
      // Propagate tracking so computeds can nest
      activeTracker?.add(readonly)
      return result.value
    },
    subscribe: (callback) => result.subscribe(callback),
    dispose,
  }

  // Duck-typed disposal used by event-streams' cleanup()
  Object.defineProperty(readonly, '_cleanup', { value: dispose, enumerable: false })

  return readonly
}

export function effect(fn: () => void | (() => void), dependencies?: Signal<any>[]): () => void {
  let cleanup: (() => void) | void
  let unsubscribes: Array<() => void> = []
  let disposed = false

  const run = () => {
    if (disposed) return
    if (cleanup) {
      try {
        cleanup()
      } catch (err) {
        console.error('Effect cleanup error:', err)
      }
      cleanup = undefined
    }
    if (dependencies) {
      cleanup = fn()
    } else {
      unsubscribes.forEach((unsub) => unsub())
      const [result, deps] = track(fn)
      unsubscribes = [...deps].map((dep) => dep.subscribe(run))
      cleanup = result
    }
  }

  if (dependencies) {
    unsubscribes = dependencies.map((dep) => dep.subscribe(run))
  }
  run()

  return () => {
    disposed = true
    if (cleanup) {
      try {
        cleanup()
      } catch (err) {
        console.error('Effect cleanup error:', err)
      }
      cleanup = undefined
    }
    unsubscribes.forEach((unsub) => unsub())
    unsubscribes = []
  }
}
