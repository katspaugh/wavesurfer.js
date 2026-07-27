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
// Queue of not-yet-fired notifyAll closures, one per dirtied signal.
// pendingSet gives O(1) membership checks so re-dirtying an already-queued
// signal merges into its existing entry instead of pushing a duplicate.
const pendingQueue: Array<() => void> = []
const pendingSet = new Set<() => void>()

function scheduleNotification(notify: () => void): void {
  if (pendingSet.has(notify)) return
  pendingSet.add(notify)
  pendingQueue.push(notify)
}

export function batch(fn: () => void): void {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      flushPending()
    }
  }
}

/**
 * Drain pendingQueue until empty. Runs under an elevated batchDepth so that
 * any set() triggered by a notification - e.g. one signal's subscriber
 * setting another signal, or a signal's own subscriber re-setting itself -
 * is queued rather than fired immediately.
 *
 * Draining LIFO (most-recently-queued first) means a cascading set()
 * triggered while flushing a later-queued entry reaches an earlier-queued,
 * not-yet-fired entry for the same signal in time to merge into it, instead
 * of that entry having already fired with a stale value and needing a
 * second, separate flush.
 *
 * A signal stays in pendingSet for the full duration of its own notify()
 * call, not just while it's queued. That way a same-signal reentrant set()
 * triggered from within its own subscribers - which notify()'s internal
 * notifying/settleAgain loop already settles to the final value - finds
 * itself still "pending" and is deduped by scheduleNotification, instead of
 * being re-queued for a redundant second delivery of the same final value.
 */
function flushPending(): void {
  batchDepth++
  try {
    while (pendingQueue.length > 0) {
      const notify = pendingQueue.pop() as () => void
      notify()
      pendingSet.delete(notify)
    }
  } finally {
    batchDepth--
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
        scheduleNotification(notifyAll)
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
