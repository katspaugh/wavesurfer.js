import {
  createScrollStream,
  createScrollStreamWithAction,
  calculateScrollPercentages,
  calculateScrollBounds,
  type ScrollData,
} from '../scroll-stream'

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
      expect(stream.cleanup).toBeDefined()

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
  })

  describe('createScrollStreamWithAction', () => {
    let element: HTMLElement

    beforeEach(() => {
      element = document.createElement('div')
      document.body.appendChild(element)

      Object.defineProperties(element, {
        scrollLeft: { value: 100, writable: true, configurable: true },
        scrollWidth: { value: 1000, writable: true, configurable: true },
        clientWidth: { value: 200, writable: true, configurable: true },
      })
    })

    afterEach(() => {
      document.body.removeChild(element)
    })

    it('should call action on scroll', () => {
      const onScrollChange = jest.fn()
      const stream = createScrollStreamWithAction(element, onScrollChange)

      // Initial call from effect
      expect(onScrollChange).toHaveBeenCalledWith(100)

      // Update scroll
      Object.defineProperty(element, 'scrollLeft', {
        value: 200,
        writable: true,
        configurable: true,
      })
      element.dispatchEvent(new Event('scroll'))

      expect(onScrollChange).toHaveBeenCalledWith(200)

      stream.cleanup()
    })

    it('should cleanup action effect', () => {
      const onScrollChange = jest.fn()
      const stream = createScrollStreamWithAction(element, onScrollChange)

      const callCount = onScrollChange.mock.calls.length

      stream.cleanup()

      // Update scroll after cleanup
      Object.defineProperty(element, 'scrollLeft', {
        value: 300,
        writable: true,
        configurable: true,
      })
      element.dispatchEvent(new Event('scroll'))

      // Should not be called again
      expect(onScrollChange).toHaveBeenCalledTimes(callCount)
    })
  })
})
