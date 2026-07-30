import { signal, computed, effect, batch } from '../store'

describe('signal', () => {
  it('should create a signal with initial value', () => {
    const count = signal(0)
    expect(count.value).toBe(0)
  })

  it('should update value with set()', () => {
    const count = signal(0)
    count.set(5)
    expect(count.value).toBe(5)
  })

  it('should update value with update()', () => {
    const count = signal(0)
    count.update((n) => n + 1)
    expect(count.value).toBe(1)
  })

  it('should notify subscribers when value changes', () => {
    const count = signal(0)
    const callback = jest.fn()

    count.subscribe(callback)
    count.set(5)

    expect(callback).toHaveBeenCalledWith(5)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should not notify if value does not change', () => {
    const count = signal(0)
    const callback = jest.fn()

    count.subscribe(callback)
    count.set(0) // Same value

    expect(callback).not.toHaveBeenCalled()
  })

  it('should support multiple subscribers', () => {
    const count = signal(0)
    const callback1 = jest.fn()
    const callback2 = jest.fn()

    count.subscribe(callback1)
    count.subscribe(callback2)
    count.set(5)

    expect(callback1).toHaveBeenCalledWith(5)
    expect(callback2).toHaveBeenCalledWith(5)
  })

  it('should unsubscribe correctly', () => {
    const count = signal(0)
    const callback = jest.fn()

    const unsubscribe = count.subscribe(callback)
    count.set(1)
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    count.set(2)
    expect(callback).toHaveBeenCalledTimes(1) // Should not be called again
  })

  it('should work with object values', () => {
    const state = signal({ count: 0 })
    const callback = jest.fn()

    state.subscribe(callback)
    state.set({ count: 1 })

    expect(callback).toHaveBeenCalledWith({ count: 1 })
  })

  it('should detect reference equality for objects', () => {
    const obj = { count: 0 }
    const state = signal(obj)
    const callback = jest.fn()

    state.subscribe(callback)
    state.set(obj) // Same reference

    expect(callback).not.toHaveBeenCalled()
  })
})

describe('computed', () => {
  it('should compute initial value', () => {
    const count = signal(5)
    const doubled = computed(() => count.value * 2, [count])

    expect(doubled.value).toBe(10)
  })

  it('should recompute when dependency changes', () => {
    const count = signal(5)
    const doubled = computed(() => count.value * 2, [count])

    count.set(10)
    expect(doubled.value).toBe(20)
  })

  it('should work with multiple dependencies', () => {
    const a = signal(2)
    const b = signal(3)
    const sum = computed(() => a.value + b.value, [a, b])

    expect(sum.value).toBe(5)

    a.set(5)
    expect(sum.value).toBe(8)

    b.set(7)
    expect(sum.value).toBe(12)
  })

  it('should notify subscribers when computed value changes', () => {
    const count = signal(5)
    const doubled = computed(() => count.value * 2, [count])
    const callback = jest.fn()

    doubled.subscribe(callback)
    count.set(10)

    expect(callback).toHaveBeenCalledWith(20)
  })

  it('should not notify if computed value does not change', () => {
    const count = signal(5)
    const isPositive = computed(() => count.value > 0, [count])
    const callback = jest.fn()

    isPositive.subscribe(callback)
    count.set(10) // Still positive

    expect(callback).not.toHaveBeenCalled()
  })

  it('should support nested computed values', () => {
    const count = signal(5)
    const doubled = computed(() => count.value * 2, [count])
    const quadrupled = computed(() => doubled.value * 2, [doubled])

    expect(quadrupled.value).toBe(20)

    count.set(10)
    expect(quadrupled.value).toBe(40)
  })

  it('should cleanup subscriptions when computed is unsubscribed', () => {
    const count = signal(5)
    const doubled = computed(() => count.value * 2, [count])
    const callback = jest.fn()

    const unsubscribe = doubled.subscribe(callback)
    count.set(10)
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    count.set(15)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should be read-only (no set method)', () => {
    const count = signal(5)
    const doubled = computed(() => count.value * 2, [count])

    expect((doubled as any).set).toBeUndefined()
    expect((doubled as any).update).toBeUndefined()
  })
})

describe('effect', () => {
  it('should run immediately', () => {
    const fn = jest.fn()
    const count = signal(0)

    effect(fn, [count])

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should run when dependency changes', () => {
    const fn = jest.fn()
    const count = signal(0)

    effect(fn, [count])
    expect(fn).toHaveBeenCalledTimes(1)

    count.set(1)
    expect(fn).toHaveBeenCalledTimes(2)

    count.set(2)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should run with multiple dependencies', () => {
    const fn = jest.fn()
    const a = signal(0)
    const b = signal(0)

    effect(fn, [a, b])
    expect(fn).toHaveBeenCalledTimes(1)

    a.set(1)
    expect(fn).toHaveBeenCalledTimes(2)

    b.set(1)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should run cleanup before re-running effect', () => {
    const cleanup = jest.fn()
    const fn = jest.fn(() => cleanup)
    const count = signal(0)

    effect(fn, [count])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(cleanup).not.toHaveBeenCalled()

    count.set(1)
    expect(cleanup).toHaveBeenCalledTimes(1) // Cleanup from first run
    expect(fn).toHaveBeenCalledTimes(2)

    count.set(2)
    expect(cleanup).toHaveBeenCalledTimes(2) // Cleanup from second run
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should run cleanup on unsubscribe', () => {
    const cleanup = jest.fn()
    const fn = jest.fn(() => cleanup)
    const count = signal(0)

    const unsubscribe = effect(fn, [count])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(cleanup).not.toHaveBeenCalled()

    unsubscribe()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('should stop running after unsubscribe', () => {
    const fn = jest.fn()
    const count = signal(0)

    const unsubscribe = effect(fn, [count])
    expect(fn).toHaveBeenCalledTimes(1)

    count.set(1)
    expect(fn).toHaveBeenCalledTimes(2)

    unsubscribe()
    count.set(2)
    expect(fn).toHaveBeenCalledTimes(2) // Should not increase
  })

  it('should work with computed dependencies', () => {
    const fn = jest.fn()
    const count = signal(0)
    const doubled = computed(() => count.value * 2, [count])

    effect(fn, [doubled])
    expect(fn).toHaveBeenCalledTimes(1)

    count.set(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should handle effects without cleanup', () => {
    const fn = jest.fn()
    const count = signal(0)

    const unsubscribe = effect(fn, [count])
    count.set(1)

    expect(() => unsubscribe()).not.toThrow()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should handle accessing signal values in effect', () => {
    const values: number[] = []
    const count = signal(0)

    effect(() => {
      values.push(count.value)
    }, [count])

    count.set(1)
    count.set(2)

    expect(values).toEqual([0, 1, 2])
  })
})

describe('integration tests', () => {
  it('should work with signal -> computed -> effect chain', () => {
    const values: number[] = []
    const count = signal(0)
    const doubled = computed(() => count.value * 2, [count])

    effect(() => {
      values.push(doubled.value)
    }, [doubled])

    count.set(5)
    count.set(10)

    expect(values).toEqual([0, 10, 20])
  })

  it('should handle complex dependency graphs', () => {
    const a = signal(1)
    const b = signal(2)
    const sum = computed(() => a.value + b.value, [a, b])
    const product = computed(() => a.value * b.value, [a, b])
    const combined = computed(() => sum.value + product.value, [sum, product])

    expect(combined.value).toBe(5) // (1+2) + (1*2) = 3 + 2 = 5

    a.set(3)
    expect(combined.value).toBe(11) // (3+2) + (3*2) = 5 + 6 = 11

    b.set(4)
    expect(combined.value).toBe(19) // (3+4) + (3*4) = 7 + 12 = 19
  })

  it('should not create memory leaks with many subscriptions', () => {
    const count = signal(0)
    const unsubscribes: (() => void)[] = []

    // Create 1000 subscriptions
    for (let i = 0; i < 1000; i++) {
      unsubscribes.push(count.subscribe(() => {}))
    }

    // Unsubscribe all
    unsubscribes.forEach((unsub) => unsub())

    // Signal should still work
    count.set(5)
    expect(count.value).toBe(5)
  })

  it('should handle rapid updates correctly', () => {
    const count = signal(0)
    const callback = jest.fn()

    count.subscribe(callback)

    // Rapid updates
    for (let i = 1; i <= 100; i++) {
      count.set(i)
    }

    expect(callback).toHaveBeenCalledTimes(100)
    expect(count.value).toBe(100)
  })
})

describe('store v2', () => {
  it('computed can be disposed and stops tracking deps', () => {
    const a = signal(1)
    const c = computed(() => a.value * 2, [a])
    expect(c.value).toBe(2)
    c.dispose()
    a.set(5)
    expect(c.value).toBe(2) // frozen after dispose
  })

  it('computed with no dep array auto-tracks', () => {
    const a = signal(1)
    const b = signal(10)
    const c = computed(() => a.value + b.value)
    a.set(2)
    b.set(20)
    expect(c.value).toBe(22)
    c.dispose()
  })

  it('batch coalesces notifications', () => {
    const a = signal(0)
    const spy = jest.fn()
    a.subscribe(spy)
    batch(() => {
      a.set(1)
      a.set(2)
      a.set(3)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(3)
  })

  it('a throwing subscriber does not prevent later subscribers', () => {
    const a = signal(0)
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const second = jest.fn()
    a.subscribe(() => {
      throw new Error('boom')
    })
    a.subscribe(second)
    a.set(1)
    expect(second).toHaveBeenCalledWith(1)
    errSpy.mockRestore()
  })

  it('re-entrant set during notification settles without recursion', () => {
    const a = signal(0)
    const seen: number[] = []
    a.subscribe((v) => {
      seen.push(v)
      if (v === 1) a.set(2)
    })
    a.set(1)
    expect(a.value).toBe(2)
    expect(seen).toEqual([1, 2])
  })

  it('effect with no dep array auto-tracks and disposes', () => {
    const a = signal(1)
    const runs: number[] = []
    const dispose = effect(() => {
      runs.push(a.value)
    })
    a.set(2)
    dispose()
    a.set(3)
    expect(runs).toEqual([1, 2])
  })

  it('batch coalesces a cascaded set() to a different signal during flush', () => {
    const a = signal(0)
    const b = signal(0)
    const bCalls: number[] = []
    b.subscribe((v) => bCalls.push(v))
    a.subscribe(() => b.set(2))
    batch(() => {
      b.set(1)
      a.set(1)
    })
    expect(bCalls).toEqual([2])
  })

  it('dispose() drops the computed result subscribers', () => {
    const a = signal(1)
    const c = computed(() => a.value * 2, [a])
    const spy = jest.fn()
    c.subscribe(spy)
    // internal result signal must retain the subscriber while live...
    expect((c as any)._subscriberCount?.()).toBe(1)
    c.dispose()
    // ...and release it once disposed, so the underlying signal doesn't
    // pin the subscriber closure in memory forever.
    expect((c as any)._subscriberCount?.()).toBe(0)
  })

  it('a same-signal reentrant set() during batch flush does not double-deliver the final value', () => {
    const a = signal(0)
    const seen: number[] = []
    a.subscribe((v) => {
      seen.push(v)
      if (v === 1) a.set(2)
    })
    batch(() => {
      a.set(1)
    })
    expect(seen).toEqual([1, 2])
  })

  it('a throwing batch body still flushes queued notifications before rethrowing', () => {
    // batch()'s decrement + flush live in a `finally`, so even though the body below throws
    // after queuing a set(), the subscriber must still see it - the exception propagates to the
    // caller only AFTER the flush runs, not instead of it.
    const a = signal(0)
    const spy = jest.fn()
    a.subscribe(spy)

    expect(() =>
      batch(() => {
        a.set(1)
        throw new Error('boom')
      }),
    ).toThrow('boom')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(1)
    expect(a.value).toBe(1)
  })

  it('nested batch() only flushes once, at the outermost call', () => {
    const a = signal(0)
    const spy = jest.fn()
    a.subscribe(spy)

    batch(() => {
      a.set(1)
      batch(() => {
        a.set(2)
        a.set(3)
      })
      // Still inside the outer batch: the inner batch()'s own decrement brought batchDepth back
      // down to 1 (not 0), so it must not have flushed on its own.
      expect(spy).not.toHaveBeenCalled()
      a.set(4)
    })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(4)
  })
})
