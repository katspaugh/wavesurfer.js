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

import Spectrogram from '../plugins/spectrogram.js'
import WindowedSpectrogram from '../plugins/spectrogram-windowed.js'
import '../plugins/spectrogram-worker.js'

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
    const result = runWorker(signal, { fftSamples, fftSize: 512, noverlap: 400 })

    // noverlap capped at floor(333 / 2) = 166 -> hop = max(max(64, ceil(83.25)), 333 - 166) = 167
    const hop = 167
    const expectedFrames = Math.floor((signal.length - fftSamples - 1) / hop) + 1
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
    const buffer = {
      sampleRate: SAMPLE_RATE,
      length: signal.length,
      duration: signal.length / SAMPLE_RATE,
      numberOfChannels: 1,
      getChannelData: () => signal,
    } as unknown as AudioBuffer

    const mainResult = await plugin.getFrequencies(buffer)
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
