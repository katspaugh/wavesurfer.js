import WindowedSpectrogramPlugin from '../plugins/spectrogram-windowed.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'

// WindowedSpectrogramPlugin is now a thin shim that delegates into spectrogram.ts's
// definePlugin() setup (see spectrogram-windowed.ts's doc comment) - its Api (including the
// test-only __spectrogramInternalsForTests() hatch) only exists on the instance once _init()
// has run, not at .create() time. Same _init() precedent as spectrogram-destroy.test.ts; see
// spectrogram.ts's WindowedTestInternals type for what's exposed under .windowed here.
//
// __windowedInternals() below is the private-poke adaptation for this file: every direct
// instance-field poke the pre-unification version of this test used
// ((plugin as any).segments, .maxRetainedSegments, .buffer, .evictDistantSegments(), etc.) is
// replaced with the equivalent read through __spectrogramInternalsForTests().windowed, whose
// segmentManager is a real SegmentManager class instance - its own methods call each other via
// `this.foo()`, so jest.spyOn(internals.segmentManager, 'foo') still correctly intercepts
// internal calls, unlike spying on a closure-merged Api field, which only ever redirects calls
// made through the returned Api object itself.

function initPlugin(plugin: any) {
  plugin._init(createFakeWaveSurfer())
  return plugin.__spectrogramInternalsForTests().windowed
}

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
      const plugin: any = WindowedSpectrogramPlugin.create({})
      const internals = initPlugin(plugin)
      const manager = internals.segmentManager
      const cap = manager.maxRetainedSegments
      expect(typeof cap).toBe('number')
      for (let i = 0; i < cap + 10; i++) {
        manager.segments.set(i, {
          startTime: i * 30,
          endTime: (i + 1) * 30,
          startPixel: i * 30,
          endPixel: (i + 1) * 30,
          canvas: document.createElement('canvas'),
          frequencies: [],
        })
      }
      manager.evictDistantSegments(0) // current view at t=0
      expect(manager.segments.size).toBeLessThanOrEqual(cap)
    })

    it('evicts segments farthest from the current time and removes their canvases from the DOM', () => {
      const plugin: any = WindowedSpectrogramPlugin.create({})
      const internals = initPlugin(plugin)
      const manager = internals.segmentManager
      const cap = manager.maxRetainedSegments
      const container = document.createElement('div')
      document.body.appendChild(container)

      const total = cap + 10
      for (let i = 0; i < total; i++) {
        const canvas = document.createElement('canvas')
        container.appendChild(canvas)
        manager.segments.set(i, {
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
      manager.evictDistantSegments(0)

      expect(manager.segments.size).toBe(cap)
      // Every remaining segment's canvas should still be attached to the DOM.
      for (const segment of manager.segments.values()) {
        expect(segment.canvas.isConnected).toBe(true)
      }
      // The DOM should have exactly as many canvases left as retained segments -
      // the evicted ones were actually removed, not just dropped from the map.
      expect(container.children.length).toBe(cap)
      // The segments closest to t=0 (lowest indices) must have survived.
      expect(manager.segments.has(0)).toBe(true)
      expect(manager.segments.has(total - 1)).toBe(false)
    })

    it('enforces the segment cap during progressive loading even with no renderVisibleWindow calls', async () => {
      jest.useFakeTimers()
      try {
        const plugin: any = WindowedSpectrogramPlugin.create({ progressiveLoading: true })
        const internals = initPlugin(plugin)
        const manager = internals.segmentManager
        manager.maxRetainedSegments = 3
        // Long enough for far more than maxRetainedSegments 30s segments.
        plugin.__spectrogramInternalsForTests().buffer = { duration: 30 * 20 }
        manager.isProgressiveLoading = true

        // Stand in for the real FFT pipeline: just record a segment for the requested range,
        // the same way generateSegments would after computing frequencies.
        jest.spyOn(manager, 'generateSegments').mockImplementation(async (...args: unknown[]) => {
          const [start, end] = args as [number, number]
          const key = `${Math.floor(start * 10)}_${Math.floor(end * 10)}`
          manager.segments.set(key, {
            startTime: start,
            endTime: end,
            startPixel: 0,
            endPixel: 0,
            canvas: document.createElement('canvas'),
            frequencies: [],
          })
        })

        // Drive several progressive-load ticks directly (no scroll/resize/playback, so
        // renderVisibleWindow - and its evictDistantSegments call - never runs).
        for (let i = 0; i < 10; i++) {
          await manager.progressiveLoadNextSegment()
        }

        expect(manager.segments.size).toBeLessThanOrEqual(3)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe('async continuations after destroy', () => {
    it('does not re-arm the progressive-load timer once destroy runs mid-await', async () => {
      jest.useFakeTimers()
      try {
        const plugin: any = WindowedSpectrogramPlugin.create({ progressiveLoading: true })
        const internals = initPlugin(plugin)
        const manager = internals.segmentManager
        plugin.__spectrogramInternalsForTests().buffer = { duration: 120 }
        manager.isProgressiveLoading = true

        let resolveGenerate: () => void = () => {}
        const generatePromise = new Promise<void>((resolve) => {
          resolveGenerate = resolve
        })
        jest.spyOn(manager, 'generateSegments').mockReturnValue(generatePromise)

        const continuation = manager.progressiveLoadNextSegment()

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
      const plugin: any = WindowedSpectrogramPlugin.create({})
      const fakeWrapper = document.createElement('div')
      Object.defineProperty(fakeWrapper, 'offsetWidth', { value: 600, configurable: true })
      Object.defineProperty(fakeWrapper, 'clientWidth', { value: 600, configurable: true })
      plugin._init(createFakeWaveSurfer({ getWrapper: () => fakeWrapper }))
      const internals = plugin.__spectrogramInternalsForTests().windowed
      const manager = internals.segmentManager
      plugin.__spectrogramInternalsForTests().buffer = { duration: 60 }

      let resolveGenerate: () => void = () => {}
      const generatePromise = new Promise<void>((resolve) => {
        resolveGenerate = resolve
      })
      jest.spyOn(manager, 'generateSegments').mockReturnValue(generatePromise)
      const evictSpy = jest.spyOn(manager, 'evictDistantSegments')

      const renderPromise = manager.renderVisibleWindow()
      plugin.destroy()
      resolveGenerate()

      await expect(renderPromise).resolves.toBeUndefined()
      expect(evictSpy).not.toHaveBeenCalled()
    })
  })
})
