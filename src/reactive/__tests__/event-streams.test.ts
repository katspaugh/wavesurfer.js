import { signal } from '../store'
import { fromEvent, map, filter, debounce, throttle, cleanup } from '../event-streams'

describe('fromEvent', () => {
  let button: HTMLButtonElement

  beforeEach(() => {
    button = document.createElement('button')
  })

  it('should convert DOM events to signal', () => {
    const clicks = fromEvent(button, 'click')
    const callback = jest.fn()

    clicks.subscribe(callback)
    button.click()

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }))
  })

  it('should start with null value', () => {
    const clicks = fromEvent(button, 'click')
    expect(clicks.value).toBeNull()
  })

  it('should update signal on each event', () => {
    const clicks = fromEvent(button, 'click')
    const values: any[] = []

    clicks.subscribe((event) => values.push(event))

    button.click()
    button.click()

    expect(values).toHaveLength(2)
    expect(values[0]).toMatchObject({ type: 'click' })
    expect(values[1]).toMatchObject({ type: 'click' })
  })

  it('should cleanup event listener on cleanup()', () => {
    const clicks = fromEvent(button, 'click')
    const callback = jest.fn()

    clicks.subscribe(callback)
    button.click()
    expect(callback).toHaveBeenCalledTimes(1)

    cleanup(clicks)
    button.click()
    expect(callback).toHaveBeenCalledTimes(1) // Should not increase
  })

  it('should work with different event types', () => {
    const input = document.createElement('input')
    const changes = fromEvent(input, 'change')
    const callback = jest.fn()

    changes.subscribe(callback)
    input.dispatchEvent(new Event('change'))

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'change' }))
  })
})

describe('map', () => {
  it('should transform stream values', () => {
    const numbers = signal(5)
    const doubled = map(numbers, (n) => n * 2)

    expect(doubled.value).toBe(10)

    numbers.set(10)
    expect(doubled.value).toBe(20)
  })

  it('should notify subscribers when mapped value changes', () => {
    const numbers = signal(5)
    const doubled = map(numbers, (n) => n * 2)
    const callback = jest.fn()

    doubled.subscribe(callback)
    numbers.set(10)

    expect(callback).toHaveBeenCalledWith(20)
  })

  it('should work with complex transformations', () => {
    const button = document.createElement('button')
    const clicks = fromEvent(button, 'click')
    const positions = map(clicks, (e) => (e ? e.clientX : 0))

    expect(positions.value).toBe(0)

    button.dispatchEvent(new MouseEvent('click', { clientX: 100 }))
    expect(positions.value).toBe(100)
  })

  it('should cleanup subscriptions on cleanup()', () => {
    const numbers = signal(5)
    const doubled = map(numbers, (n) => n * 2)
    const callback = jest.fn()

    doubled.subscribe(callback)
    cleanup(doubled)

    numbers.set(10)
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('filter', () => {
  it('should filter stream values by predicate', () => {
    const numbers = signal(5)
    const evens = filter(numbers, (n) => n % 2 === 0)

    expect(evens.value).toBeNull() // 5 is odd

    numbers.set(6)
    expect(evens.value).toBe(6) // 6 is even

    numbers.set(7)
    expect(evens.value).toBeNull() // 7 is odd
  })

  it('should emit null for filtered values', () => {
    const numbers = signal(2)
    const evens = filter(numbers, (n) => n % 2 === 0)
    const values: any[] = []

    evens.subscribe((v) => values.push(v))

    numbers.set(3) // Odd - should emit null
    numbers.set(4) // Even - should emit 4
    numbers.set(5) // Odd - should emit null

    expect(values).toEqual([null, 4, null])
  })

  it('should start with correct initial value', () => {
    const evens1 = filter(signal(2), (n) => n % 2 === 0)
    expect(evens1.value).toBe(2)

    const evens2 = filter(signal(3), (n) => n % 2 === 0)
    expect(evens2.value).toBeNull()
  })

  it('should cleanup subscriptions on cleanup()', () => {
    const numbers = signal(2)
    const evens = filter(numbers, (n) => n % 2 === 0)
    const callback = jest.fn()

    evens.subscribe(callback)
    cleanup(evens)

    numbers.set(4)
    expect(callback).not.toHaveBeenCalled()
  })
})

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should delay updates', () => {
    const numbers = signal(0)
    const debounced = debounce(numbers, 300)
    const callback = jest.fn()

    debounced.subscribe(callback)

    numbers.set(1)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(200)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should reset timer on new update', () => {
    const numbers = signal(0)
    const debounced = debounce(numbers, 300)
    const callback = jest.fn()

    debounced.subscribe(callback)

    numbers.set(1)
    jest.advanceTimersByTime(200)

    numbers.set(2) // Reset timer
    jest.advanceTimersByTime(200)
    expect(callback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledWith(2)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should emit latest value after delay', () => {
    const numbers = signal(0)
    const debounced = debounce(numbers, 100)
    const values: number[] = []

    debounced.subscribe((v) => values.push(v))

    numbers.set(1)
    numbers.set(2)
    numbers.set(3)

    jest.advanceTimersByTime(100)
    expect(values).toEqual([3]) // Only last value
  })

  it('should cleanup timeout on cleanup()', () => {
    const numbers = signal(0)
    const debounced = debounce(numbers, 300)
    const callback = jest.fn()

    debounced.subscribe(callback)
    numbers.set(1)

    cleanup(debounced)
    jest.advanceTimersByTime(300)

    expect(callback).not.toHaveBeenCalled()
  })

  it('should have initial value', () => {
    const numbers = signal(5)
    const debounced = debounce(numbers, 300)

    expect(debounced.value).toBe(5)
  })
})

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should emit immediately on first update', () => {
    const numbers = signal(0)
    const throttled = throttle(numbers, 1000)
    const callback = jest.fn()

    throttled.subscribe(callback)

    numbers.set(1)
    expect(callback).toHaveBeenCalledWith(1)
  })

  it('should throttle subsequent updates', () => {
    const numbers = signal(0)
    const throttled = throttle(numbers, 1000)
    const values: number[] = []

    throttled.subscribe((v) => values.push(v))

    numbers.set(1) // Immediate
    numbers.set(2) // Too soon, scheduled
    numbers.set(3) // Too soon, scheduled (replaces 2)

    jest.advanceTimersByTime(1000)
    expect(values).toEqual([1, 3]) // 1 immediate, 3 after throttle
  })

  it('should allow emission after throttle period', () => {
    const numbers = signal(0)
    const throttled = throttle(numbers, 100)
    const values: number[] = []

    throttled.subscribe((v) => values.push(v))

    numbers.set(1) // Immediate
    jest.advanceTimersByTime(100)

    numbers.set(2) // Enough time passed, immediate
    expect(values).toEqual([1, 2])
  })

  it('should cleanup timeout on cleanup()', () => {
    const numbers = signal(0)
    const throttled = throttle(numbers, 1000)
    const callback = jest.fn()

    throttled.subscribe(callback)
    numbers.set(1)
    numbers.set(2)

    cleanup(throttled)
    jest.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1) // Only immediate call
  })

  it('should have initial value', () => {
    const numbers = signal(5)
    const throttled = throttle(numbers, 1000)

    expect(throttled.value).toBe(5)
  })
})

describe('stream composition', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should compose map + filter', () => {
    const numbers = signal(1)
    const doubled = map(numbers, (n) => n * 2)
    const evens = filter(doubled, (n) => n > 5)

    expect(evens.value).toBeNull() // 2 is not > 5

    numbers.set(3)
    expect(evens.value).toBe(6) // 6 is > 5

    numbers.set(2)
    expect(evens.value).toBeNull() // 4 is not > 5
  })

  it('should compose map + debounce', () => {
    const numbers = signal(0)
    const doubled = map(numbers, (n) => n * 2)
    const debounced = debounce(doubled, 100)
    const values: number[] = []

    debounced.subscribe((v) => values.push(v))

    numbers.set(1)
    numbers.set(2)
    numbers.set(3)

    jest.advanceTimersByTime(100)
    expect(values).toEqual([6]) // 3 * 2 = 6
  })

  it('should compose fromEvent + map + filter + debounce', () => {
    const button = document.createElement('button')
    const clicks = fromEvent(button, 'click')
    const positions = map(clicks, (e) => (e ? e.clientX : 0))
    const filtered = filter(positions, (x) => x > 50)
    const debounced = debounce(filtered, 200)
    const values: any[] = []

    debounced.subscribe((v) => values.push(v))

    button.dispatchEvent(new MouseEvent('click', { clientX: 100 }))
    button.dispatchEvent(new MouseEvent('click', { clientX: 30 })) // Filtered
    button.dispatchEvent(new MouseEvent('click', { clientX: 75 }))

    jest.advanceTimersByTime(200)
    expect(values).toEqual([75])

    cleanup(clicks)
    cleanup(positions)
    cleanup(filtered)
    cleanup(debounced)
  })
})
