import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../../state/store'

interface TestState {
  count: number
  name: string
}

describe('StateStore', () => {
  it('should initialize with initial state', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })

    expect(store.snapshot).toEqual({ count: 0, name: 'test' })
  })

  it('should update state immutably', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })

    store.update((state) => ({ ...state, count: 1 }))

    expect(store.snapshot).toEqual({ count: 1, name: 'test' })
  })

  it('should only emit when state reference changes', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })
    const observer = vi.fn()

    store.subscribe(observer)

    // This should emit (reference changes)
    store.update((state) => ({ ...state, count: 1 }))

    // This should not emit (same reference)
    store.update((state) => state)

    expect(observer).toHaveBeenCalledTimes(2) // Initial + 1 update
  })

  it('should support set method', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })

    store.set({ count: 5, name: 'updated' })

    expect(store.snapshot).toEqual({ count: 5, name: 'updated' })
  })

  it('should select state slices', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })
    const values: number[] = []

    store.select((state) => state.count).subscribe((count) => values.push(count))

    expect(values).toEqual([0])

    store.update((state) => ({ ...state, count: 1 }))
    expect(values).toEqual([0, 1])

    // Update different property - count selector should not emit
    store.update((state) => ({ ...state, name: 'updated' }))
    expect(values).toEqual([0, 1])
  })

  it('should support selectMany', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })
    const values: Array<[number, string]> = []

    store
      .selectMany(
        (state) => state.count,
        (state) => state.name
      )
      .subscribe(([count, name]) => values.push([count, name]))

    expect(values).toEqual([[0, 'test']])

    store.update((state) => ({ ...state, count: 1 }))
    expect(values).toEqual([
      [0, 'test'],
      [1, 'test'],
    ])
  })

  it('should emit current value to new subscribers', () => {
    const store = createStore<TestState>({ count: 5, name: 'test' })

    const observer = vi.fn()
    store.subscribe(observer)

    expect(observer).toHaveBeenCalledWith({ count: 5, name: 'test' })
  })

  it('should complete the stream', () => {
    const store = createStore<TestState>({ count: 0, name: 'test' })
    const observer = vi.fn()

    store.subscribe(observer)
    store.complete()
    store.update((state) => ({ ...state, count: 1 }))

    expect(observer).toHaveBeenCalledTimes(1) // Only initial value
  })
})
