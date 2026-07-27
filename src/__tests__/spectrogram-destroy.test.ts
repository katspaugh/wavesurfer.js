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

describe('SpectrogramPlugin destroy', () => {
  it('delivers the destroy event to subscribers', () => {
    const plugin = SpectrogramPlugin.create({})
    const onDestroy = jest.fn()
    plugin.on('destroy', onDestroy)
    plugin.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })

  it('releases the decoded buffer on destroy', () => {
    const plugin = SpectrogramPlugin.create({})
    ;(plugin as any).buffer = { length: 1 } // simulate a render having cached it
    plugin.destroy()
    expect((plugin as any).buffer).toBeNull()
  })

  it('does not let one instance override another instance maxCanvasWidth', () => {
    const a = SpectrogramPlugin.create({ maxCanvasWidth: 1000 })
    const b = SpectrogramPlugin.create({})
    expect((a as any).maxCanvasWidth).toBe(1000)
    expect((b as any).maxCanvasWidth).toBe(30000)
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
      const drawSpy = jest.spyOn(plugin as any, 'drawSpectrogram')

      const loadPromise = plugin.loadFrequenciesData('https://example.com/data.json')
      plugin.destroy()

      resolveJson([[1, 2, 3]])

      await expect(loadPromise).resolves.toBeUndefined()
      expect(drawSpy).not.toHaveBeenCalled()
    })
  })
})
