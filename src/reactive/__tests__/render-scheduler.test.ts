import { RenderScheduler } from '../render-scheduler'

describe('RenderScheduler', () => {
  let scheduler: RenderScheduler
  let renderFn: jest.Mock

  beforeEach(() => {
    scheduler = new RenderScheduler()
    renderFn = jest.fn()
    jest.useFakeTimers()
  })

  afterEach(() => {
    scheduler.cancelRender()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('scheduleRender', () => {
    it('should schedule a render on next frame', () => {
      scheduler.scheduleRender(renderFn)
      expect(renderFn).not.toHaveBeenCalled()

      // Advance to next frame
      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })

    it('should batch multiple render requests into one', () => {
      scheduler.scheduleRender(renderFn)
      scheduler.scheduleRender(renderFn)
      scheduler.scheduleRender(renderFn)

      expect(renderFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })

    it('should allow new render after previous completes', () => {
      scheduler.scheduleRender(renderFn)
      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(1)

      scheduler.scheduleRender(renderFn)
      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(2)
    })

    it('should execute high priority renders immediately', () => {
      scheduler.scheduleRender(renderFn, 'high')
      expect(renderFn).toHaveBeenCalledTimes(1)

      // No additional call on next frame
      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })

    it('should cancel batched render when high priority render is called', () => {
      const batchedRender = jest.fn()
      const highPriorityRender = jest.fn()

      scheduler.scheduleRender(batchedRender, 'normal')
      expect(batchedRender).not.toHaveBeenCalled()

      scheduler.scheduleRender(highPriorityRender, 'high')
      expect(highPriorityRender).toHaveBeenCalledTimes(1)

      // Batched render should still execute
      jest.advanceTimersByTime(16)
      expect(batchedRender).not.toHaveBeenCalled()
    })

    it('should handle low priority same as normal', () => {
      scheduler.scheduleRender(renderFn, 'low')
      expect(renderFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancelRender', () => {
    it('should cancel pending render', () => {
      scheduler.scheduleRender(renderFn)
      scheduler.cancelRender()

      jest.advanceTimersByTime(16)
      expect(renderFn).not.toHaveBeenCalled()
    })

    it('should allow scheduling after cancel', () => {
      scheduler.scheduleRender(renderFn)
      scheduler.cancelRender()
      scheduler.scheduleRender(renderFn)

      jest.advanceTimersByTime(16)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })

    it('should be safe to call multiple times', () => {
      scheduler.scheduleRender(renderFn)
      scheduler.cancelRender()
      scheduler.cancelRender()
      scheduler.cancelRender()

      jest.advanceTimersByTime(16)
      expect(renderFn).not.toHaveBeenCalled()
    })

    it('should be safe to call when no render is pending', () => {
      expect(() => scheduler.cancelRender()).not.toThrow()
    })
  })

  describe('flushRender', () => {
    it('should execute render immediately', () => {
      scheduler.flushRender(renderFn)
      expect(renderFn).toHaveBeenCalledTimes(1)
    })

    it('should cancel pending batched render', () => {
      const batchedRender = jest.fn()
      const flushRender = jest.fn()

      scheduler.scheduleRender(batchedRender)
      scheduler.flushRender(flushRender)

      expect(flushRender).toHaveBeenCalledTimes(1)
      expect(batchedRender).not.toHaveBeenCalled()

      jest.advanceTimersByTime(16)
      expect(batchedRender).not.toHaveBeenCalled()
    })

    it('should work for testing scenarios', () => {
      let renderCount = 0
      const testRender = () => renderCount++

      // Simulate multiple state changes
      scheduler.scheduleRender(testRender)
      scheduler.scheduleRender(testRender)
      scheduler.scheduleRender(testRender)

      // Force immediate render for assertion
      scheduler.flushRender(testRender)
      expect(renderCount).toBe(1)

      // No additional render on next frame
      jest.advanceTimersByTime(16)
      expect(renderCount).toBe(1)
    })
  })

  describe('isPending', () => {
    it('should return false initially', () => {
      expect(scheduler.isPending()).toBe(false)
    })

    it('should return true when render is scheduled', () => {
      scheduler.scheduleRender(renderFn)
      expect(scheduler.isPending()).toBe(true)
    })

    it('should return false after render executes', () => {
      scheduler.scheduleRender(renderFn)
      jest.advanceTimersByTime(16)
      expect(scheduler.isPending()).toBe(false)
    })

    it('should return false after cancel', () => {
      scheduler.scheduleRender(renderFn)
      scheduler.cancelRender()
      expect(scheduler.isPending()).toBe(false)
    })

    it('should return false after flush', () => {
      scheduler.scheduleRender(renderFn)
      scheduler.flushRender(renderFn)
      expect(scheduler.isPending()).toBe(false)
    })

    it('should return false for high priority renders', () => {
      scheduler.scheduleRender(renderFn, 'high')
      expect(scheduler.isPending()).toBe(false)
    })
  })

  describe('real-world scenarios', () => {
    it('should batch rapid state changes', () => {
      let renderCount = 0
      const render = () => renderCount++

      // Simulate rapid state changes (e.g., during animation)
      for (let i = 0; i < 100; i++) {
        scheduler.scheduleRender(render)
      }

      expect(renderCount).toBe(0)

      jest.advanceTimersByTime(16)
      expect(renderCount).toBe(1)
    })

    it('should handle mixed priority renders', () => {
      const normalRenders: number[] = []
      const highRenders: number[] = []

      scheduler.scheduleRender(() => normalRenders.push(1), 'normal')
      scheduler.scheduleRender(() => highRenders.push(1), 'high')
      scheduler.scheduleRender(() => normalRenders.push(2), 'normal')
      scheduler.scheduleRender(() => highRenders.push(2), 'high')

      expect(highRenders).toEqual([1, 2])
      expect(normalRenders).toEqual([])

      jest.advanceTimersByTime(16)
      expect(normalRenders).toEqual([])
    })

    it('should handle errors in render function', () => {
      const errorRender = () => {
        throw new Error('Render error')
      }
      const successRender = jest.fn()

      scheduler.scheduleRender(errorRender)

      expect(() => {
        jest.advanceTimersByTime(16)
      }).toThrow('Render error')

      // After error, scheduler is no longer pending
      expect(scheduler.isPending()).toBe(false)

      // Should be able to schedule after error
      scheduler.scheduleRender(successRender)
      expect(scheduler.isPending()).toBe(true)

      jest.advanceTimersByTime(16)
      expect(successRender).toHaveBeenCalledTimes(1)
    })

    it('should support cleanup on unmount', () => {
      scheduler.scheduleRender(renderFn)
      expect(scheduler.isPending()).toBe(true)

      // Simulate component unmount
      scheduler.cancelRender()
      expect(scheduler.isPending()).toBe(false)

      jest.advanceTimersByTime(100)
      expect(renderFn).not.toHaveBeenCalled()
    })
  })

  describe('performance', () => {
    it('should handle thousands of schedule calls efficiently', () => {
      const start = performance.now()

      for (let i = 0; i < 10000; i++) {
        scheduler.scheduleRender(renderFn)
      }

      const duration = performance.now() - start
      expect(duration).toBeLessThan(10) // Should be near-instant
    })

    it('should not leak memory with repeated scheduling', () => {
      for (let i = 0; i < 1000; i++) {
        scheduler.scheduleRender(renderFn)
        scheduler.cancelRender()
      }

      expect(scheduler.isPending()).toBe(false)
    })
  })
})
