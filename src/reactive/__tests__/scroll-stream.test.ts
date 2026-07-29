import {
  createScrollStream,
  calculateScrollPercentages,
  calculateScrollBounds,
  type ScrollData,
} from '../scroll-stream'
import type { WritableSignal } from '../store'

describe('scroll-stream', () => {
  describe('calculateScrollPercentages', () => {
    it('should calculate percentages for basic scroll', () => {
      const data: ScrollData = {
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 200,
      }

      const result = calculateScrollPercentages(data)
      expect(result.startX).toBe(0.1)
      expect(result.endX).toBe(0.3)
    })

    it('should handle zero scroll width', () => {
      const data: ScrollData = {
        scrollLeft: 0,
        scrollWidth: 0,
        clientWidth: 200,
      }

      const result = calculateScrollPercentages(data)
      expect(result.startX).toBe(0)
      expect(result.endX).toBe(1)
    })

    it('should handle scroll at start', () => {
      const data: ScrollData = {
        scrollLeft: 0,
        scrollWidth: 1000,
        clientWidth: 200,
      }

      const result = calculateScrollPercentages(data)
      expect(result.startX).toBe(0)
      expect(result.endX).toBe(0.2)
    })

    it('should handle scroll at end', () => {
      const data: ScrollData = {
        scrollLeft: 800,
        scrollWidth: 1000,
        clientWidth: 200,
      }

      const result = calculateScrollPercentages(data)
      expect(result.startX).toBe(0.8)
      expect(result.endX).toBe(1)
    })

    it('should clamp values to 0-1 range', () => {
      const data: ScrollData = {
        scrollLeft: -10,
        scrollWidth: 1000,
        clientWidth: 200,
      }

      const result = calculateScrollPercentages(data)
      expect(result.startX).toBeGreaterThanOrEqual(0)
      expect(result.endX).toBeLessThanOrEqual(1)
    })

    // Moved from renderer-utils.test.ts's now-deleted duplicate: a
    // partial clamp (only the low end goes negative) with exact expected
    // values, distinct from the boundary-only assertion above.
    it('clamps only the out-of-range end while leaving the other exact', () => {
      const data: ScrollData = {
        scrollLeft: -10,
        scrollWidth: 400,
        clientWidth: 100,
      }

      const result = calculateScrollPercentages(data)
      expect(result).toEqual({ startX: 0, endX: 0.225 })
    })
  })

  describe('calculateScrollBounds', () => {
    it('should calculate scroll bounds', () => {
      const data: ScrollData = {
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 200,
      }

      const result = calculateScrollBounds(data)
      expect(result.left).toBe(100)
      expect(result.right).toBe(300)
    })

    it('should handle zero scroll', () => {
      const data: ScrollData = {
        scrollLeft: 0,
        scrollWidth: 1000,
        clientWidth: 200,
      }

      const result = calculateScrollBounds(data)
      expect(result.left).toBe(0)
      expect(result.right).toBe(200)
    })
  })

  describe('createScrollStream', () => {
    let element: HTMLElement

    beforeEach(() => {
      element = document.createElement('div')
      document.body.appendChild(element)

      // Mock scroll properties
      Object.defineProperties(element, {
        scrollLeft: { value: 100, writable: true, configurable: true },
        scrollWidth: { value: 1000, writable: true, configurable: true },
        clientWidth: { value: 200, writable: true, configurable: true },
      })
    })

    afterEach(() => {
      document.body.removeChild(element)
    })

    it('should create a scroll stream', () => {
      const stream = createScrollStream(element)

      expect(stream.scrollData).toBeDefined()
      expect(stream.percentages).toBeDefined()
      expect(stream.bounds).toBeDefined()
      expect(stream.refresh).toBeDefined()
      expect(stream.cleanup).toBeDefined()

      stream.cleanup()
    })

    it('refresh() re-reads scroll metrics without a scroll event', () => {
      const stream = createScrollStream(element)

      expect(stream.scrollData.value).toEqual({
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 200,
      })

      // Change the element's metrics directly (as a layout pass would,
      // e.g. render()/zoom()/container resize) WITHOUT dispatching a
      // 'scroll' event.
      Object.defineProperty(element, 'scrollWidth', { value: 2000, writable: true, configurable: true })
      Object.defineProperty(element, 'clientWidth', { value: 400, writable: true, configurable: true })

      // Stale until refresh() is called.
      expect(stream.scrollData.value).toEqual({
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 200,
      })

      stream.refresh()

      expect(stream.scrollData.value).toEqual({
        scrollLeft: 100,
        scrollWidth: 2000,
        clientWidth: 400,
      })
      expect(stream.percentages.value.endX).toBeCloseTo((100 + 400) / 2000)

      stream.cleanup()
    })

    it('refresh() does not notify when metrics are unchanged (idempotent)', () => {
      // Regression: refresh() used to call scrollData.set(readScrollData())
      // unconditionally. readScrollData() always returns a fresh object
      // literal, so even when every field is identical to the current
      // value, signal.set()'s Object.is(_value, newValue) check always sees
      // two distinct objects and always notifies -- meaning the Renderer's
      // public 'scroll' event fired on every render()/resize call, even
      // when nothing about the scroll metrics actually changed. Two
      // consecutive refresh() calls with unchanged metrics must produce
      // zero additional notifications; an actual metrics change must
      // produce exactly one.
      const stream = createScrollStream(element)
      const spy = jest.fn()
      stream.scrollData.subscribe(spy)

      stream.refresh()
      stream.refresh()
      expect(spy).not.toHaveBeenCalled()

      Object.defineProperty(element, 'scrollLeft', { value: 250, writable: true, configurable: true })
      stream.refresh()
      expect(spy).toHaveBeenCalledTimes(1)

      // A second refresh() against the now-unchanged (post-update) metrics
      // must not notify again.
      stream.refresh()
      expect(spy).toHaveBeenCalledTimes(1)

      stream.cleanup()
    })

    it('should initialize with current scroll values', () => {
      const stream = createScrollStream(element)

      expect(stream.scrollData.value).toEqual({
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 200,
      })

      stream.cleanup()
    })

    it('should compute percentages', () => {
      const stream = createScrollStream(element)

      expect(stream.percentages.value.startX).toBe(0.1)
      expect(stream.percentages.value.endX).toBe(0.3)

      stream.cleanup()
    })

    it('should compute bounds', () => {
      const stream = createScrollStream(element)

      expect(stream.bounds.value.left).toBe(100)
      expect(stream.bounds.value.right).toBe(300)

      stream.cleanup()
    })

    it('should update on scroll event', () => {
      const stream = createScrollStream(element)

      // Update scroll position
      Object.defineProperty(element, 'scrollLeft', {
        value: 200,
        writable: true,
        configurable: true,
      })

      // Dispatch scroll event
      element.dispatchEvent(new Event('scroll'))

      expect(stream.scrollData.value.scrollLeft).toBe(200)
      expect(stream.percentages.value.startX).toBe(0.2)
      expect(stream.percentages.value.endX).toBe(0.4)

      stream.cleanup()
    })

    it('should cleanup event listeners', () => {
      const stream = createScrollStream(element)
      const addSpy = jest.spyOn(element, 'addEventListener')
      const removeSpy = jest.spyOn(element, 'removeEventListener')

      stream.cleanup()

      expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))

      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it('cleanup() disposes derived computeds, not just the DOM listener', () => {
      const stream = createScrollStream(element)
      const spy = jest.fn()
      stream.percentages.subscribe(spy)
      stream.cleanup()
      // Force an internal write after cleanup, bypassing the (now-removed)
      // DOM listener: scrollData is a plain signal, so setting it directly
      // still notifies subscribers. percentages must no longer recompute.
      ;(stream.scrollData as WritableSignal<ScrollData>).set({
        scrollLeft: 999,
        scrollWidth: 1000,
        clientWidth: 200,
      })
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
