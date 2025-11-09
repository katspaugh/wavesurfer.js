import { toStream, toStreams, mergeStreams, mapStream, filterStream } from '../event-stream-emitter'
import EventEmitter from '../../event-emitter'

type TestEvents = {
  play: []
  pause: []
  timeupdate: [time: number]
  error: [error: Error]
  customEvent: [data: string, count: number]
}

// Test class that exposes emit for testing
class TestEmitter extends EventEmitter<TestEvents> {
  public emit<E extends keyof TestEvents>(event: E, ...args: TestEvents[E]): void {
    super.emit(event, ...args)
  }
}

describe('event-stream-emitter', () => {
  let emitter: TestEmitter

  beforeEach(() => {
    emitter = new TestEmitter()
  })

  describe('toStream', () => {
    it('should create a stream from event', () => {
      const { stream, cleanup } = toStream(emitter, 'play')

      expect(stream.value).toBeNull()

      const values: any[] = []
      stream.subscribe((value) => values.push(value))

      emitter.emit('play')
      expect(stream.value).toEqual([])
      // Values includes initial null and then the event
      expect(values.length).toBeGreaterThanOrEqual(1)
      expect(values[values.length - 1]).toEqual([])

      cleanup()
    })

    it('should update stream with event arguments', () => {
      const { stream, cleanup } = toStream(emitter, 'timeupdate')

      emitter.emit('timeupdate', 42)
      expect(stream.value).toEqual([42])

      emitter.emit('timeupdate', 100)
      expect(stream.value).toEqual([100])

      cleanup()
    })

    it('should handle multiple arguments', () => {
      const { stream, cleanup } = toStream(emitter, 'customEvent')

      emitter.emit('customEvent', 'hello', 5)
      expect(stream.value).toEqual(['hello', 5])

      cleanup()
    })

    it('should cleanup event listener', () => {
      const { stream, cleanup } = toStream(emitter, 'play')

      emitter.emit('play')
      expect(stream.value).toEqual([])

      cleanup()

      // After cleanup, event should not update stream
      const oldValue = stream.value
      emitter.emit('play')
      expect(stream.value).toBe(oldValue) // Value should not change after cleanup
    })

    it('should allow multiple subscriptions to stream', () => {
      const { stream, cleanup } = toStream(emitter, 'timeupdate')

      const values1: any[] = []
      const values2: any[] = []

      stream.subscribe((value) => values1.push(value))
      stream.subscribe((value) => values2.push(value))

      emitter.emit('timeupdate', 10)
      emitter.emit('timeupdate', 20)

      expect(values1).toContainEqual([10])
      expect(values1).toContainEqual([20])
      expect(values2).toContainEqual([10])
      expect(values2).toContainEqual([20])

      cleanup()
    })
  })

  describe('toStreams', () => {
    it('should create multiple streams', () => {
      const streams = toStreams(emitter, ['play', 'pause', 'timeupdate'])

      expect(streams.play).toBeDefined()
      expect(streams.pause).toBeDefined()
      expect(streams.timeupdate).toBeDefined()

      emitter.emit('play')
      expect(streams.play.value).toEqual([])

      emitter.emit('pause')
      expect(streams.pause.value).toEqual([])

      emitter.emit('timeupdate', 50)
      expect(streams.timeupdate.value).toEqual([50])

      streams.cleanup()
    })

    it('should cleanup all streams', () => {
      const streams = toStreams(emitter, ['play', 'pause'])

      streams.cleanup()

      emitter.emit('play')
      emitter.emit('pause')

      // Streams should not update after cleanup
      expect(streams.play.value).toBeNull()
      expect(streams.pause.value).toBeNull()
    })

    it('should handle empty event list', () => {
      const streams = toStreams(emitter, [])

      expect(streams.cleanup).toBeDefined()
      expect(typeof streams.cleanup).toBe('function')

      streams.cleanup() // Should not throw
    })
  })

  describe('mergeStreams', () => {
    it('should merge multiple events into one stream', () => {
      const { stream, cleanup } = mergeStreams(emitter, ['play', 'pause'])

      expect(stream.value).toBeNull()

      const values: any[] = []
      stream.subscribe((value) => values.push(value))

      emitter.emit('play')
      expect(stream.value).toEqual({ event: 'play', args: [] })

      emitter.emit('pause')
      expect(stream.value).toEqual({ event: 'pause', args: [] })

      expect(values).toContainEqual({ event: 'play', args: [] })
      expect(values).toContainEqual({ event: 'pause', args: [] })

      cleanup()
    })

    it('should include event arguments in merged stream', () => {
      const { stream, cleanup } = mergeStreams(emitter, ['timeupdate', 'error'])

      emitter.emit('timeupdate', 42)
      expect(stream.value).toEqual({ event: 'timeupdate', args: [42] })

      const error = new Error('Test error')
      emitter.emit('error', error)
      expect(stream.value).toEqual({ event: 'error', args: [error] })

      cleanup()
    })

    it('should cleanup all merged event listeners', () => {
      const { stream, cleanup } = mergeStreams(emitter, ['play', 'pause'])

      cleanup()

      emitter.emit('play')
      emitter.emit('pause')

      // Stream should not update after cleanup
      expect(stream.value).toBeNull()
    })

    it('should handle single event', () => {
      const { stream, cleanup } = mergeStreams(emitter, ['play'])

      emitter.emit('play')
      expect(stream.value).toEqual({ event: 'play', args: [] })

      cleanup()
    })
  })

  describe('mapStream', () => {
    it('should transform stream values', () => {
      const { stream: timeStream, cleanup } = toStream(emitter, 'timeupdate')
      const seconds = mapStream(timeStream, (value) => (value ? Math.floor(value[0]) : 0))

      expect(seconds.value).toBe(0)

      emitter.emit('timeupdate', 42.7)
      expect(seconds.value).toBe(42)

      emitter.emit('timeupdate', 99.9)
      expect(seconds.value).toBe(99)

      cleanup()
    })

    it('should work with multiple subscriptions', () => {
      const { stream: timeStream, cleanup } = toStream(emitter, 'timeupdate')
      const doubled = mapStream(timeStream, (value) => (value ? value[0] * 2 : 0))

      const values: number[] = []
      doubled.subscribe((value) => values.push(value))

      emitter.emit('timeupdate', 5)
      emitter.emit('timeupdate', 10)

      expect(values).toContain(10)
      expect(values).toContain(20)

      cleanup()
    })

    it('should handle null values', () => {
      const { stream, cleanup } = toStream(emitter, 'play')
      const mapped = mapStream(stream, (value) => (value ? 'playing' : 'not playing'))

      expect(mapped.value).toBe('not playing')

      emitter.emit('play')
      expect(mapped.value).toBe('playing')

      cleanup()
    })
  })

  describe('filterStream', () => {
    it('should filter stream values', () => {
      const { stream: timeStream, cleanup } = toStream(emitter, 'timeupdate')
      const afterTen = filterStream(timeStream, (value) => (value ? value[0] > 10 : false))

      expect(afterTen.value).toBeNull()

      emitter.emit('timeupdate', 5)
      expect(afterTen.value).toBeNull()

      emitter.emit('timeupdate', 15)
      expect(afterTen.value).toEqual([15])

      emitter.emit('timeupdate', 7)
      expect(afterTen.value).toBeNull()

      cleanup()
    })

    it('should work with subscriptions', () => {
      const { stream: timeStream, cleanup } = toStream(emitter, 'timeupdate')
      const evenSeconds = filterStream(
        timeStream,
        (value) => value !== null && Math.floor(value[0]) % 2 === 0,
      )

      const values: any[] = []
      evenSeconds.subscribe((value) => values.push(value))

      emitter.emit('timeupdate', 1)
      emitter.emit('timeupdate', 2)
      emitter.emit('timeupdate', 3)
      emitter.emit('timeupdate', 4)

      expect(values.filter((v) => v !== null)).toEqual([[2], [4]])

      cleanup()
    })

    it('should pass through values that match predicate', () => {
      const { stream, cleanup } = toStream(emitter, 'customEvent')
      const onlyHello = filterStream(stream, (value) => value !== null && value[0] === 'hello')

      emitter.emit('customEvent', 'hello', 1)
      expect(onlyHello.value).toEqual(['hello', 1])

      emitter.emit('customEvent', 'world', 2)
      expect(onlyHello.value).toBeNull()

      cleanup()
    })
  })

  describe('integration', () => {
    it('should allow chaining stream operations', () => {
      const { stream: timeStream, cleanup } = toStream(emitter, 'timeupdate')

      // Filter for times > 10, then map to seconds
      const filtered = filterStream(timeStream, (value) => (value ? value[0] > 10 : false))
      const seconds = mapStream(filtered, (value) => (value ? Math.floor(value[0]) : 0))

      const values: number[] = []
      seconds.subscribe((value) => values.push(value))

      emitter.emit('timeupdate', 5)
      emitter.emit('timeupdate', 15.7)
      emitter.emit('timeupdate', 20.3)

      expect(values).toContain(15)
      expect(values).toContain(20)
      expect(values).not.toContain(5)

      cleanup()
    })

    it('should work with merged streams', () => {
      const { stream: mergedStream, cleanup } = mergeStreams(emitter, ['play', 'pause'])

      const eventNames = mapStream(mergedStream, (value) => (value ? value.event : null))

      const names: any[] = []
      eventNames.subscribe((name) => names.push(name))

      emitter.emit('play')
      emitter.emit('pause')
      emitter.emit('play')

      expect(names).toContain('play')
      expect(names).toContain('pause')
      expect(names.filter((n) => n === 'play')).toHaveLength(2)

      cleanup()
    })
  })
})
