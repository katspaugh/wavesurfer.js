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
    plugin.__testInternals().buffer = { length: 1 } as any // simulate a render having cached it
    plugin.destroy()
    expect(plugin.__testInternals().buffer).toBeNull()
  })

  it('does not let one instance override another instance maxCanvasWidth', () => {
    const a = SpectrogramPlugin.create({ maxCanvasWidth: 1000 })
    a._init(createFakeWaveSurfer() as any)
    const b = SpectrogramPlugin.create({})
    b._init(createFakeWaveSurfer() as any)
    expect(a.__testInternals().maxCanvasWidth).toBe(1000)
    expect(b.__testInternals().maxCanvasWidth).toBe(30000)
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

      await expect(loadPromise).resolves.toBeUndefined()
      // The post-await destroyed guard (ctx.scope.disposed) must stop loadFrequenciesData before
      // it ever reaches drawSpectrogram - observed here via drawSpectrogram's real side effect
      // (a canvas would be added) rather than a spy, since spying on the exposed
      // __testInternals().drawSpectrogram wouldn't observe loadFrequenciesData's internal call to
      // the same closure function (Object.assign-based instance properties don't intercept a
      // closure's own direct calls to itself).
      expect(plugin.__testInternals().canvases).toHaveLength(0)
    })
  })
})
