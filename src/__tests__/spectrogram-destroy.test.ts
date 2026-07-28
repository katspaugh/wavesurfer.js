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
// with other ported plugins. Validation, which used to throw straight out of the pre-port class's
// constructor, has moved with it: it now runs (and can only throw) at `_init()` time too. A
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
  })
})
