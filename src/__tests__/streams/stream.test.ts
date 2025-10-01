import { describe, it, expect, vi } from 'vitest'
import { createStream } from '../../streams/stream'
import { Subject, BehaviorSubject } from '../../streams/subject'

describe('Stream', () => {
  it('should emit values to subscribers', () => {
    const stream = createStream<number>((observer) => {
      observer(1)
      observer(2)
      observer(3)
      return () => {}
    })

    const values: number[] = []
    stream.subscribe((value) => values.push(value))

    expect(values).toEqual([1, 2, 3])
  })

  it('should unsubscribe correctly', () => {
    const cleanup = vi.fn()
    const stream = createStream<number>((observer) => {
      observer(1)
      return cleanup
    })

    const subscription = stream.subscribe(() => {})
    subscription.unsubscribe()

    expect(cleanup).toHaveBeenCalled()
    expect(subscription.closed).toBe(true)
  })

  describe('map operator', () => {
    it('should transform values', () => {
      const stream = createStream<number>((observer) => {
        observer(1)
        observer(2)
        observer(3)
        return () => {}
      })

      const values: number[] = []
      stream.map((x) => x * 2).subscribe((value) => values.push(value))

      expect(values).toEqual([2, 4, 6])
    })
  })

  describe('filter operator', () => {
    it('should filter values', () => {
      const stream = createStream<number>((observer) => {
        observer(1)
        observer(2)
        observer(3)
        observer(4)
        return () => {}
      })

      const values: number[] = []
      stream.filter((x) => x % 2 === 0).subscribe((value) => values.push(value))

      expect(values).toEqual([2, 4])
    })
  })

  describe('distinct operator', () => {
    it('should only emit distinct values', () => {
      const subject = new BehaviorSubject(1)
      const values: number[] = []

      subject.distinct().subscribe((value) => values.push(value))

      subject.next(1)
      subject.next(2)
      subject.next(2)
      subject.next(3)

      expect(values).toEqual([1, 2, 3])
    })
  })

  describe('take operator', () => {
    it('should take only first N values', () => {
      const subject = new Subject<number>()
      const values: number[] = []

      subject.take(2).subscribe((value) => values.push(value))

      subject.next(1)
      subject.next(2)
      subject.next(3)

      expect(values).toEqual([1, 2])
    })
  })

  describe('combine operator', () => {
    it('should combine two streams', () => {
      const a = new BehaviorSubject(1)
      const b = new BehaviorSubject(2)

      const values: number[] = []
      a.combine(b, (x, y) => x + y).subscribe((value) => values.push(value))

      expect(values).toEqual([3])

      a.next(2)
      expect(values).toEqual([3, 4])

      b.next(3)
      expect(values).toEqual([3, 4, 5])
    })
  })
})

describe('Subject', () => {
  it('should emit values to all subscribers', () => {
    const subject = new Subject<number>()

    const values1: number[] = []
    const values2: number[] = []

    subject.subscribe((value) => values1.push(value))
    subject.subscribe((value) => values2.push(value))

    subject.next(1)
    subject.next(2)

    expect(values1).toEqual([1, 2])
    expect(values2).toEqual([1, 2])
  })

  it('should support unsubscribe', () => {
    const subject = new Subject<number>()
    const values: number[] = []

    const subscription = subject.subscribe((value) => values.push(value))

    subject.next(1)
    subscription.unsubscribe()
    subject.next(2)

    expect(values).toEqual([1])
  })

  it('should complete', () => {
    const subject = new Subject<number>()
    const values: number[] = []

    subject.subscribe((value) => values.push(value))

    subject.next(1)
    subject.complete()
    subject.next(2)

    expect(values).toEqual([1])
    expect(subject.closed).toBe(true)
  })
})

describe('BehaviorSubject', () => {
  it('should emit current value to new subscribers', () => {
    const subject = new BehaviorSubject(42)
    const values: number[] = []

    subject.subscribe((value) => values.push(value))

    expect(values).toEqual([42])
  })

  it('should update current value', () => {
    const subject = new BehaviorSubject(1)

    subject.next(2)
    expect(subject.getValue()).toBe(2)

    subject.next(3)
    expect(subject.getValue()).toBe(3)
  })

  it('should emit updates to all subscribers', () => {
    const subject = new BehaviorSubject(1)

    const values1: number[] = []
    const values2: number[] = []

    subject.subscribe((value) => values1.push(value))
    subject.next(2)
    subject.subscribe((value) => values2.push(value))
    subject.next(3)

    expect(values1).toEqual([1, 2, 3])
    expect(values2).toEqual([2, 3])
  })
})
