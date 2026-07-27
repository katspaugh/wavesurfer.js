jest.mock(
  'web-worker:./spectrogram-worker.ts',
  () => ({
    __esModule: true,
    default: class MockSpectrogramWorker {
      onmessage: ((e: { data: any }) => void) | null = null
      onerror: ((e: Event) => void) | null = null
      onmessageerror: ((e: Event) => void) | null = null
      postMessage = jest.fn()
      terminate = jest.fn()
    },
  }),
  { virtual: true },
)

import WindowedSpectrogramPlugin from '../plugins/spectrogram-windowed.js'

describe('WindowedSpectrogramPlugin destroy', () => {
  it('delivers the destroy event to subscribers', () => {
    const plugin = WindowedSpectrogramPlugin.create({})
    const onDestroy = jest.fn()
    plugin.on('destroy', onDestroy)
    plugin.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })

  it('is idempotent and still only delivers the destroy event once', () => {
    const plugin = WindowedSpectrogramPlugin.create({})
    const onDestroy = jest.fn()
    plugin.on('destroy', onDestroy)
    plugin.destroy()
    plugin.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })

  describe('segment eviction', () => {
    it('caps retained segments', () => {
      const plugin = WindowedSpectrogramPlugin.create({})
      const cap = (plugin as any).maxRetainedSegments
      expect(typeof cap).toBe('number')
      for (let i = 0; i < cap + 10; i++) {
        ;(plugin as any).segments.set(i, {
          startTime: i * 30,
          endTime: (i + 1) * 30,
          startPixel: i * 30,
          endPixel: (i + 1) * 30,
          canvas: document.createElement('canvas'),
          frequencies: [],
        })
      }
      ;(plugin as any).evictDistantSegments(0) // current view at t=0
      expect((plugin as any).segments.size).toBeLessThanOrEqual(cap)
    })

    it('evicts segments farthest from the current time and removes their canvases from the DOM', () => {
      const plugin = WindowedSpectrogramPlugin.create({})
      const cap = (plugin as any).maxRetainedSegments
      const container = document.createElement('div')
      document.body.appendChild(container)

      const total = cap + 10
      for (let i = 0; i < total; i++) {
        const canvas = document.createElement('canvas')
        container.appendChild(canvas)
        ;(plugin as any).segments.set(i, {
          startTime: i * 30,
          endTime: (i + 1) * 30,
          startPixel: i * 30,
          endPixel: (i + 1) * 30,
          canvas,
          frequencies: [],
        })
      }

      // Current view is near the start (t=0), so the segments with the highest
      // indices (farthest midpoints) should be the ones evicted.
      ;(plugin as any).evictDistantSegments(0)

      expect((plugin as any).segments.size).toBe(cap)
      // Every remaining segment's canvas should still be attached to the DOM.
      for (const segment of (plugin as any).segments.values()) {
        expect(segment.canvas.isConnected).toBe(true)
      }
      // The DOM should have exactly as many canvases left as retained segments -
      // the evicted ones were actually removed, not just dropped from the map.
      expect(container.children.length).toBe(cap)
      // The segments closest to t=0 (lowest indices) must have survived.
      expect((plugin as any).segments.has(0)).toBe(true)
      expect((plugin as any).segments.has(total - 1)).toBe(false)
    })
  })

  describe('async continuations after destroy', () => {
    it('does not re-arm the progressive-load timer once destroy runs mid-await', async () => {
      jest.useFakeTimers()
      try {
        const plugin = WindowedSpectrogramPlugin.create({ progressiveLoading: true })
        ;(plugin as any).buffer = { duration: 120 }
        ;(plugin as any).isProgressiveLoading = true

        let resolveGenerate: () => void = () => {}
        const generatePromise = new Promise<void>((resolve) => {
          resolveGenerate = resolve
        })
        jest.spyOn(plugin as any, 'generateSegments').mockReturnValue(generatePromise)

        const continuation = (plugin as any).progressiveLoadNextSegment()

        // Destroy while the generateSegments() await is still pending.
        plugin.destroy()
        expect(jest.getTimerCount()).toBe(0)

        resolveGenerate()
        await expect(continuation).resolves.toBeUndefined()

        // The post-await continuation must not have scheduled a new timer.
        expect(jest.getTimerCount()).toBe(0)
        jest.advanceTimersByTime(5000)
        expect(jest.getTimerCount()).toBe(0)
      } finally {
        jest.useRealTimers()
      }
    })

    it('does not throw or touch destroyed DOM state when renderVisibleWindow resumes after destroy', async () => {
      const plugin = WindowedSpectrogramPlugin.create({})
      ;(plugin as any).buffer = { duration: 60 }
      const fakeWrapper = document.createElement('div')
      ;(plugin as any).wavesurfer = { getWrapper: () => fakeWrapper, options: {} }

      let resolveGenerate: () => void = () => {}
      const generatePromise = new Promise<void>((resolve) => {
        resolveGenerate = resolve
      })
      jest.spyOn(plugin as any, 'generateSegments').mockReturnValue(generatePromise)
      const evictSpy = jest.spyOn(plugin as any, 'evictDistantSegments')

      const renderPromise = (plugin as any).renderVisibleWindow()
      plugin.destroy()
      resolveGenerate()

      await expect(renderPromise).resolves.toBeUndefined()
      expect(evictSpy).not.toHaveBeenCalled()
    })
  })
})
