jest.mock(
  'web-worker:./spectrogram-worker.ts',
  () => ({
    __esModule: true,
    default: class MockSpectrogramWorker {
      onmessage: ((e: { data: any }) => void) | null = null
      onerror: ((e: Event) => void) | null = null
      postMessage = jest.fn()
      terminate = jest.fn()
    },
  }),
  { virtual: true },
)

import SpectrogramPlugin from '../plugins/spectrogram.js'

// SpectrogramPlugin is a definePlugin() plugin now: its setup() (where the public/test API is
// attached to the instance) only runs once the plugin is registered with a wavesurfer instance
// (`_init`), not at `.create()` time - see hover.test.ts/regions.test.ts for the same pattern
// with other ported plugins. Option validation, however, still throws synchronously out of
// `.create()`/`new SpectrogramPlugin()`, matching pre-port behavior: the default export is a
// thin wrapper class around definePlugin's output whose constructor calls validateOptions()
// right after `super()`, specifically so a bad option (e.g. an odd fftSize) fails at
// construction time instead of surfacing later inside `_init()`/setup() - see
// src/plugins/spectrogram.ts and src/spectrogram-setup.ts's validateOptions() for why. A
// minimal fake wavesurfer is enough since these tests never exercise a real render.
function createFakeWaveSurfer(overrides: Record<string, unknown> = {}) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'offsetWidth', { value: 600, configurable: true })
  Object.defineProperty(wrapper, 'clientWidth', { value: 600, configurable: true })
  return {
    options: {},
    getWrapper: () => wrapper,
    getDecodedData: () => null,
    on: () => () => undefined,
    ...overrides,
  }
}

describe('SpectrogramPlugin destroy', () => {
  it('delivers the destroy event to subscribers', () => {
    const plugin = SpectrogramPlugin.create({})
    plugin._init(createFakeWaveSurfer() as any)
    const onDestroy = jest.fn()
    plugin.on('destroy', onDestroy)
    plugin.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })

  it('releases the decoded buffer on destroy', () => {
    const plugin = SpectrogramPlugin.create({})
    plugin._init(createFakeWaveSurfer() as any)
    plugin.__spectrogramInternalsForTests().buffer = { length: 1 } as any // simulate a render having cached it
    plugin.destroy()
    expect(plugin.__spectrogramInternalsForTests().buffer).toBeNull()
  })

  it('does not let one instance override another instance maxCanvasWidth', () => {
    const a = SpectrogramPlugin.create({ maxCanvasWidth: 1000 })
    a._init(createFakeWaveSurfer() as any)
    const b = SpectrogramPlugin.create({})
    b._init(createFakeWaveSurfer() as any)
    expect(a.__spectrogramInternalsForTests().maxCanvasWidth).toBe(1000)
    expect(b.__spectrogramInternalsForTests().maxCanvasWidth).toBe(30000)
  })

  describe('async continuations after destroy', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('does not touch destroyed DOM state when frequenciesData arrives after destroy', async () => {
      let resolveJson: (value: unknown) => void = () => {}
      const jsonPromise = new Promise((resolve) => {
        resolveJson = resolve
      })
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => jsonPromise,
      }) as any

      const plugin = SpectrogramPlugin.create({})
      plugin._init(createFakeWaveSurfer() as any)

      const loadPromise = plugin.loadFrequenciesData('https://example.com/data.json')
      plugin.destroy()

      resolveJson([[1, 2, 3]])

      // This resolves assertion is what actually catches the regression: without the post-await
      // destroyed guard (ctx.scope.disposed) in loadFrequenciesData, drawSpectrogram would run
      // after destroy() and throw inside getWidth() (ctx.wavesurfer reads plugin.wavesurfer, which
      // destroy() -> super.destroy() has set to undefined by then), turning loadPromise into a
      // rejection instead of a clean resolve.
      await expect(loadPromise).resolves.toBeUndefined()
      // Secondary sanity check: no canvas got created either. Not the primary signal above (a spy
      // on the exposed __spectrogramInternalsForTests().drawSpectrogram wouldn't work here -  it
      // wouldn't observe loadFrequenciesData's internal, direct call to the same closure function;
      // Object.assign-based instance properties don't intercept a closure's own direct calls to
      // itself).
      expect(plugin.__spectrogramInternalsForTests().canvases).toHaveLength(0)
    })

    it('does not repopulate cachedBuffer/cachedFrequencies when getFrequenciesData resolves after destroy', async () => {
      // getFrequenciesData()'s cache write (cachedBuffer = decodedData; cachedFrequencies =
      // frequencies) happens after `await getFrequencies(decodedData)`, with no post-await
      // destroyed guard - unlike every other async continuation in this file (loadFrequenciesData
      // above, the worker-error handlers at spectrogram-setup.ts:695/829) which all check
      // ctx.scope.disposed immediately after their await. A caller firing getFrequenciesData()
      // and destroying without awaiting it (a plausible sequence - the public method returns a
      // promise nothing forces the caller to await) would see the destroyed plugin's cache
      // silently repopulated with a stale AudioBuffer reference post-teardown. No worker mocking
      // needed to hit the race: useWebWorker defaults to false, so getFrequencies() runs its
      // main-thread branch synchronously and returns a promise via computeFrequencies() - awaiting
      // that always yields at least one microtask turn, which is enough for a synchronous
      // destroy() call in between to land first.
      const sampleRate = 8000
      const signal = new Float32Array(2048)
      for (let i = 0; i < signal.length; i++) {
        signal[i] = Math.sin((2 * Math.PI * 1000 * i) / sampleRate)
      }
      const buffer = {
        sampleRate,
        length: signal.length,
        duration: signal.length / sampleRate,
        numberOfChannels: 1,
        getChannelData: () => signal,
      } as unknown as AudioBuffer

      const plugin = SpectrogramPlugin.create({})
      plugin._init(createFakeWaveSurfer({ getDecodedData: () => buffer }) as any)

      const dataPromise = plugin.getFrequenciesData() // fire-and-forget, not awaited before destroy
      plugin.destroy()

      await dataPromise

      const internals = plugin.__spectrogramInternalsForTests()
      expect(internals.cachedBuffer).toBeNull()
      expect(internals.cachedFrequencies).toBeNull()
    })
  })
})
