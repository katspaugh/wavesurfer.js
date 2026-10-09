import Spectrogram from '../plugins/spectrogram.js'
import WindowedSpectrogram from '../plugins/spectrogram-windowed.js'
import '../plugins/spectrogram-worker.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'
import { createFakeAudioBuffer } from './helpers/audio-buffer.js'

const SAMPLE_RATE = 8000

function makeSine(length: number): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE)
  }
  return signal
}

/** Dispatch a message to the worker handler and return its response synchronously */
function runWorker(signal: Float32Array, options: Record<string, unknown>): Uint8Array[][] {
  const postMessage = jest.fn()
  ;(self as any).postMessage = postMessage
  ;(self as any).onmessage({
    data: {
      type: 'calculateFrequencies',
      id: 'test',
      audioData: [signal],
      options: {
        startTime: 0,
        endTime: signal.length / SAMPLE_RATE,
        sampleRate: SAMPLE_RATE,
        windowFunc: 'hann',
        scale: 'linear',
        gainDB: 20,
        rangeDB: 80,
        splitChannels: false,
        ...options,
      },
    },
  })
  const response = postMessage.mock.calls[0][0]
  expect(response.error).toBeUndefined()
  return response.result
}

beforeAll(() => {
  // jsdom has no Worker; the plugins only check its existence before using the bundled constructor
  ;(globalThis as any).Worker = function Worker() {}
})

// SpectrogramPlugin is a definePlugin() plugin, but validateOptions() runs from its constructor
// (see spectrogram.ts) same as the pre-port class, so `Plugin.create({...})` alone still throws
// synchronously below - no `_init()` needed for the validation tests. The functional tests further
// down still need a fake wavesurfer since setup() (which drives the actual render/worker/cache
// behavior) only runs once the plugin is registered - see hover.test.ts/regions.test.ts for the
// underlying `_init()` precedent with other ported plugins.

describe.each([
  ['SpectrogramPlugin', Spectrogram],
  ['WindowedSpectrogramPlugin', WindowedSpectrogram],
])('%s fftSize option validation', (_name, Plugin: any) => {
  it('rejects a non-power-of-two fftSize', () => {
    expect(() => Plugin.create({ fftSize: 500 })).toThrow(TypeError)
  })

  it('rejects a non-power-of-two fftSamples when fftSize is not set', () => {
    expect(() => Plugin.create({ fftSamples: 333 })).toThrow(TypeError)
  })

  it('rejects fftSamples larger than fftSize', () => {
    expect(() => Plugin.create({ fftSamples: 1024, fftSize: 512 })).toThrow(TypeError)
  })

  it('rejects a non-integer fftSamples when fftSize is set', () => {
    expect(() => Plugin.create({ fftSamples: 80.5, fftSize: 512 })).toThrow(TypeError)
  })

  it('rejects a non-integer noverlap', () => {
    expect(() => Plugin.create({ noverlap: 100.5 })).toThrow(TypeError)
  })

  it('rejects one-sample windows, whose window formulas would produce NaN spectra', () => {
    expect(() => Plugin.create({ fftSamples: 1 })).toThrow(TypeError)
    expect(() => Plugin.create({ fftSamples: 1, fftSize: 512 })).toThrow(TypeError)
  })

  it('rejects explicit invalid fftSamples values when fftSize is set', () => {
    expect(() => Plugin.create({ fftSamples: 0, fftSize: 512 })).toThrow(TypeError)
    expect(() => Plugin.create({ fftSamples: NaN, fftSize: 512 })).toThrow(TypeError)
    expect(() => Plugin.create({ fftSamples: -64, fftSize: 512 })).toThrow(TypeError)
  })

  it('keeps the historical coercion of falsy fftSamples when fftSize is not set', () => {
    expect(() => Plugin.create({ fftSamples: 0 })).not.toThrow()
    expect(() => Plugin.create({ fftSamples: NaN })).not.toThrow()
  })

  it('rejects large non-powers-of-two that fool 32-bit bitwise checks', () => {
    expect(() => Plugin.create({ fftSize: 2 ** 32 + 1 })).toThrow(TypeError)
  })

  it('accepts a non-power-of-two window once fftSize carries the transform length', () => {
    expect(() => Plugin.create({ fftSamples: 80, fftSize: 512 })).not.toThrow()
    expect(() => Plugin.create({ fftSamples: 333, fftSize: 512 })).not.toThrow()
  })

  it('accepts the defaults unchanged', () => {
    expect(() => Plugin.create({})).not.toThrow()
  })
})

describe('worker compute with fftSize', () => {
  it('adds frequency bins without changing the frame count', () => {
    const signal = makeSine(4000)
    const noverlap = 32

    const unpadded = runWorker(signal, { fftSamples: 64, noverlap })
    const padded = runWorker(signal, { fftSamples: 64, fftSize: 512, noverlap })

    expect(padded[0].length).toBe(unpadded[0].length)
    expect(unpadded[0][0].length).toBe(32)
    expect(padded[0][0].length).toBe(256)
  })

  it('produces identical output when fftSize equals fftSamples', () => {
    const signal = makeSine(4000)

    const implicit = runWorker(signal, { fftSamples: 512, noverlap: 256 })
    const explicit = runWorker(signal, { fftSamples: 512, fftSize: 512, noverlap: 256 })

    expect(explicit.length).toBe(implicit.length)
    explicit[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(implicit[0][i]))
    })
  })

  it('renders non-linear scales with a padded FFT (no all-zero output)', () => {
    const signal = makeSine(4000)
    const result = runWorker(signal, { fftSamples: 64, fftSize: 512, noverlap: 32, scale: 'mel' })

    expect(result[0][0].length).toBe(256)
    expect(result[0].some((frame) => frame.some((value: number) => value > 0))).toBe(true)
  })

  it('uses integer hops for non-power-of-two windows', () => {
    const fftSamples = 333
    const signal = makeSine(3000)
    const result = runWorker(signal, { fftSamples, fftSize: 512, noverlap: 166 })

    // hop = 333 - 166 = 167, an integer even though fftSamples is not a power of two
    const hop = 167
    const expectedFrames = Math.floor((signal.length - fftSamples - 1) / hop) + 1
    expect(result[0].length).toBe(expectedFrames)
    expect(result[0][0].length).toBe(256)
  })

  it('honors noverlap above 50% of fftSamples, clamped only to fftSamples - 1', () => {
    const fftSamples = 333
    const signal = makeSine(1000)
    const result = runWorker(signal, { fftSamples, fftSize: 512, noverlap: 400 })

    // noverlap >= fftSamples is clamped to fftSamples - 1 = 332 -> hop = 1 (the old code
    // silently capped noverlap at 50% and floored the hop, yielding hop 167 here instead)
    const expectedFrames = Math.floor((signal.length - fftSamples - 1) / 1) + 1
    expect(result[0].length).toBe(expectedFrames)
    expect(result[0][0].length).toBe(256)
  })

  it('skips a frame ending exactly at the last sample (pre-existing bound)', () => {
    const signal = makeSine(1024)
    const result = runWorker(signal, { fftSamples: 256, noverlap: 128 })

    // hop = 128; a frame starting at 768 would end exactly at 1024 and is skipped by the < bound
    expect(result[0].length).toBe(6)
  })
})

describe('main-thread compute with fftSize', () => {
  it('matches the worker output byte for byte on the default (no worker) path', async () => {
    const signal = makeSine(4000)
    const plugin: any = Spectrogram.create({ fftSamples: 64, fftSize: 512, noverlap: 32, scale: 'mel' })
    plugin._init(createFakeWaveSurfer())
    const buffer = createFakeAudioBuffer(signal, { sampleRate: SAMPLE_RATE })

    const mainResult = await plugin.__spectrogramInternalsForTests().getFrequencies(buffer)
    const workerResult = runWorker(signal, { fftSamples: 64, fftSize: 512, noverlap: 32, scale: 'mel' })

    expect(mainResult.length).toBe(1)
    expect(mainResult[0].length).toBe(workerResult[0].length)
    expect(mainResult[0][0].length).toBe(256)
    expect(mainResult[0].some((frame: Uint8Array) => frame.some((value) => value > 0))).toBe(true)
    mainResult[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(workerResult[0][i]))
    })
  })
})

describe('noverlap resolution', () => {
  const FFT_SAMPLES = 128
  const LENGTH = 1280
  const makeBuffer = (signal: Float32Array) => createFakeAudioBuffer(signal, { sampleRate: SAMPLE_RATE })
  const framesForHop = (hop: number) => Math.floor((LENGTH - FFT_SAMPLES - 1) / hop) + 1

  /** Full-rendering plugin on a wrapper of the given width whose offsetWidth reads are counted */
  function createFull(options: Record<string, unknown>, width = 600) {
    const wrapper = document.createElement('div')
    const widthGetter = jest.fn(() => width)
    Object.defineProperty(wrapper, 'offsetWidth', { get: widthGetter, configurable: true })
    Object.defineProperty(wrapper, 'clientWidth', { value: width, configurable: true })
    const plugin: any = Spectrogram.create({ fftSamples: FFT_SAMPLES, scale: 'linear', ...options } as any)
    plugin._init(createFakeWaveSurfer({ getWrapper: () => wrapper }))
    widthGetter.mockClear()
    return { plugin, internals: plugin.__spectrogramInternalsForTests(), widthGetter }
  }

  /** The overlap a full-rendering worker request carries; the mock worker never answers */
  function forwardedNoverlap(internals: any): number {
    const promise = internals.calculateFrequenciesWithWorker(makeBuffer(makeSine(LENGTH)))
    promise.catch(() => undefined)
    return internals.worker.postMessage.mock.calls[0][0].options.noverlap
  }

  it.each([0, 64])('uses an explicit overlap of %i as is, without reading the wrapper width', async (noverlap) => {
    const worker = createFull({ useWebWorker: true, noverlap })
    expect(forwardedNoverlap(worker.internals)).toBe(noverlap)
    expect(worker.widthGetter).not.toHaveBeenCalled()
    worker.plugin.destroy()

    const main = createFull({ useWebWorker: false, noverlap })
    await main.internals.getFrequencies(makeBuffer(makeSine(LENGTH)))
    expect(main.widthGetter).not.toHaveBeenCalled()
    main.plugin.destroy()
  })

  it('forwards an explicit 0 to the worker in windowed rendering', () => {
    const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, fftSamples: FFT_SAMPLES, noverlap: 0 })
    plugin._init(createFakeWaveSurfer())
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = makeBuffer(makeSine(LENGTH))

    const promise = internals.windowed.calculateFrequenciesWithWorker(0, LENGTH / SAMPLE_RATE)
    promise.catch(() => undefined)
    expect(internals.worker.postMessage.mock.calls[0][0].options.noverlap).toBe(0)
    plugin.destroy()
  })

  it('computes an explicit 0 without overlap on the main thread, matching the worker', async () => {
    const signal = makeSine(LENGTH)
    // On this 600px wrapper the automatic overlap is 126 (hop 2), which an explicit 0 must not fall back to
    const { plugin, internals } = createFull({ useWebWorker: false, noverlap: 0 })

    const mainResult = await internals.getFrequencies(makeBuffer(signal))
    const workerResult = runWorker(signal, { fftSamples: FFT_SAMPLES, noverlap: 0 })

    expect(mainResult[0].length).toBe(framesForHop(FFT_SAMPLES))
    expect(mainResult[0].length).toBe(workerResult[0].length)
    mainResult[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(workerResult[0][i]))
    })
    plugin.destroy()
  })

  it('accepts noverlap: null through the typed options as the automatic overlap', () => {
    // Not via createFull, whose options are cast to any: the call must type-check with null
    const plugin: any = Spectrogram.create({
      useWebWorker: true,
      fftSamples: FFT_SAMPLES,
      scale: 'linear',
      noverlap: null,
    })
    plugin._init(createFakeWaveSurfer())
    // round(128 - 1280 / 600) = 126, the same as omitting the option
    expect(forwardedNoverlap(plugin.__spectrogramInternalsForTests())).toBe(126)
    plugin.destroy()
  })

  it('derives the automatic overlap from the wrapper width', async () => {
    // round(128 - 1280 / 600) = 126
    const worker = createFull({ useWebWorker: true })
    expect(forwardedNoverlap(worker.internals)).toBe(126)
    expect(worker.widthGetter).toHaveBeenCalled()
    worker.plugin.destroy()

    const main = createFull({ useWebWorker: false })
    const result = await main.internals.getFrequencies(makeBuffer(makeSine(LENGTH)))
    expect(result[0].length).toBe(framesForHop(2))
    expect(main.widthGetter).toHaveBeenCalled()
    main.plugin.destroy()
  })

  it('keeps half a window when the automatic overlap derives to 0', async () => {
    // 1280 samples on 8px is 160 samples per pixel, more than the 128-sample window
    const worker = createFull({ useWebWorker: true }, 8)
    expect(forwardedNoverlap(worker.internals)).toBe(64)
    worker.plugin.destroy()

    const main = createFull({ useWebWorker: false }, 8)
    const result = await main.internals.getFrequencies(makeBuffer(makeSine(LENGTH)))
    expect(result[0].length).toBe(framesForHop(64))
    main.plugin.destroy()
  })

  it('keeps half a window when the windowed automatic overlap derives to 0', async () => {
    // 50 px/s at 8 kHz is 160 samples per pixel
    const plugin: any = WindowedSpectrogram.create({ fftSamples: FFT_SAMPLES, scale: 'linear' })
    plugin._init(createFakeWaveSurfer({ options: { minPxPerSec: 50 } }))
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = makeBuffer(makeSine(LENGTH))

    const result = await internals.windowed.calculateFrequenciesMainThread(0, LENGTH / SAMPLE_RATE)

    expect(result[0].length).toBe(framesForHop(64))
    plugin.destroy()
  })
})
