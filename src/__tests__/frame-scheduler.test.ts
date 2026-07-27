import { FrameScheduler } from '../frame-scheduler.js'
import { Scope } from '../scope.js'

describe('FrameScheduler', () => {
  beforeEach(() => {
    let id = 0
    const pending = new Map<number, FrameRequestCallback>()
    ;(global as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      pending.set(++id, cb)
      return id
    }
    ;(global as any).cancelAnimationFrame = (i: number) => pending.delete(i)
    ;(global as any).__flushFrames = (n = 1) => {
      for (let k = 0; k < n; k++) {
        const cbs = [...pending.values()]
        pending.clear()
        cbs.forEach((cb) => cb(performance.now()))
      }
    }
  })

  // Note: start() fires the first tick synchronously (replicating Timer.start()'s
  // behavior) so WaveSurfer's compatibility contract for the first timeupdate/
  // audioprocess emission is preserved. That adds one extra synchronous call on
  // top of the RAF-scheduled calls, versus a scheduler whose first tick is
  // itself RAF-scheduled.
  it('ticks the callback once per frame while running, plus a synchronous first tick', () => {
    const scope = new Scope()
    const scheduler = new FrameScheduler(scope)
    const tick = jest.fn()
    scheduler.start(tick)
    expect(tick).toHaveBeenCalledTimes(1) // synchronous first tick from start()
    ;(global as any).__flushFrames(3)
    expect(tick).toHaveBeenCalledTimes(4)
    scheduler.stop()
    ;(global as any).__flushFrames(2)
    expect(tick).toHaveBeenCalledTimes(4)
  })

  it('start is idempotent (no double loops)', () => {
    const scope = new Scope()
    const scheduler = new FrameScheduler(scope)
    const tick = jest.fn()
    scheduler.start(tick)
    scheduler.start(tick)
    expect(tick).toHaveBeenCalledTimes(1) // only the first start() fires synchronously
    ;(global as any).__flushFrames(1)
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('scope disposal stops the loop', () => {
    const scope = new Scope()
    const scheduler = new FrameScheduler(scope)
    const tick = jest.fn()
    scheduler.start(tick)
    expect(tick).toHaveBeenCalledTimes(1) // synchronous first tick already fired
    scope.dispose()
    ;(global as any).__flushFrames(2)
    expect(tick).toHaveBeenCalledTimes(1) // no further ticks after dispose
  })

  it('running reflects start/stop state', () => {
    const scope = new Scope()
    const scheduler = new FrameScheduler(scope)
    expect(scheduler.running).toBe(false)
    scheduler.start(jest.fn())
    expect(scheduler.running).toBe(true)
    scheduler.stop()
    expect(scheduler.running).toBe(false)
  })

  it('stop is idempotent', () => {
    const scope = new Scope()
    const scheduler = new FrameScheduler(scope)
    scheduler.start(jest.fn())
    scheduler.stop()
    expect(() => scheduler.stop()).not.toThrow()
  })
})
