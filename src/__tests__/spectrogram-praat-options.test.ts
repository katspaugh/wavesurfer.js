import Spectrogram from '../plugins/spectrogram.js'
import WindowedSpectrogram from '../plugins/spectrogram-windowed.js'
import '../plugins/spectrogram-worker.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'
import { createFakeAudioBuffer } from './helpers/audio-buffer.js'

const SAMPLE_RATE = 8000

function makeSine(length: number, amplitude = 1, frequency = 1000): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE)
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
        fftSamples: 256,
        windowFunc: 'hann',
        noverlap: 128,
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

const flatten = (result: Uint8Array[][]) => result[0].map((frame) => Array.from(frame))
const frameMaxima = (result: Uint8Array[][]) => result[0].map((frame) => Math.max(...Array.from(frame)))

/** Full-scale sine for the first half, 40 dB quieter for the second */
function makeLoudThenQuiet(length: number): Float32Array {
  const signal = makeSine(length)
  for (let i = length / 2; i < length; i++) {
    signal[i] *= 0.01
  }
  return signal
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
])('%s Praat display option validation', (_name, Plugin: any) => {
  it('rejects non-finite or non-positive rangeDB', () => {
    expect(() => Plugin.create({ rangeDB: 0 })).toThrow(TypeError)
    expect(() => Plugin.create({ rangeDB: -5 })).toThrow(TypeError)
    expect(() => Plugin.create({ rangeDB: NaN })).toThrow(TypeError)
    expect(() => Plugin.create({ rangeDB: Infinity })).toThrow(TypeError)
  })

  it('rejects non-finite gainDB and preEmphasis', () => {
    expect(() => Plugin.create({ gainDB: NaN })).toThrow(TypeError)
    expect(() => Plugin.create({ preEmphasis: NaN })).toThrow(TypeError)
    expect(() => Plugin.create({ preEmphasis: Infinity })).toThrow(TypeError)
  })

  it('accepts finite preEmphasis values including zero and negatives', () => {
    expect(() => Plugin.create({ preEmphasis: 0 })).not.toThrow()
    expect(() => Plugin.create({ preEmphasis: 6 })).not.toThrow()
    expect(() => Plugin.create({ preEmphasis: -3 })).not.toThrow()
  })

  it('rejects invalid alpha values per window function', () => {
    expect(() => Plugin.create({ alpha: NaN })).toThrow(TypeError)
    expect(() => Plugin.create({ windowFunc: 'gauss', alpha: 0 })).toThrow(TypeError)
    expect(() => Plugin.create({ windowFunc: 'gauss', alpha: -0.2 })).toThrow(TypeError)
  })

  it('accepts an explicit blackman alpha of 0', () => {
    expect(() => Plugin.create({ windowFunc: 'blackman', alpha: 0 })).not.toThrow()
  })

  it('rejects dynamicCompression outside 0-1', () => {
    expect(() => Plugin.create({ dynamicCompression: NaN })).toThrow(TypeError)
    expect(() => Plugin.create({ dynamicCompression: Infinity })).toThrow(TypeError)
    expect(() => Plugin.create({ dynamicCompression: -Infinity })).toThrow(TypeError)
    expect(() => Plugin.create({ dynamicCompression: -0.1 })).toThrow(TypeError)
    expect(() => Plugin.create({ dynamicCompression: 1.1 })).toThrow(TypeError)
  })

  it('accepts dynamicCompression from 0 to 1', () => {
    expect(() => Plugin.create({ dynamicCompression: 0 })).not.toThrow()
    expect(() => Plugin.create({ dynamicCompression: 0.5 })).not.toThrow()
    expect(() => Plugin.create({ dynamicCompression: 1 })).not.toThrow()
  })
})

describe('worker compute with preEmphasis', () => {
  it('quantizes the DC bin to 0 and changes the output', () => {
    const signal = makeSine(4000)
    const plain = runWorker(signal, {})
    const tilted = runWorker(signal, { preEmphasis: 6 })

    expect(flatten(tilted)).not.toEqual(flatten(plain))
    for (const frame of tilted[0]) {
      expect(frame[0]).toBe(0)
    }
  })

  it('applies the tilt on non-linear scales using the row center frequencies', () => {
    const signal = makeSine(4000)
    const plain = runWorker(signal, { scale: 'mel' })
    const tilted = runWorker(signal, { scale: 'mel', preEmphasis: 6 })

    expect(flatten(tilted)).not.toEqual(flatten(plain))
    expect(tilted[0].some((frame) => frame.some((value) => value > 0))).toBe(true)
  })
})

describe('worker compute with autoGain', () => {
  it('produces identical output regardless of absolute signal level', () => {
    const loud = runWorker(makeSine(4000, 1), { autoGain: true })
    const quiet = runWorker(makeSine(4000, 0.01), { autoGain: true })

    expect(flatten(quiet)).toEqual(flatten(loud))
  })

  it('ignores gainDB while enabled', () => {
    const signal = makeSine(4000)
    const lowGain = runWorker(signal, { autoGain: true, gainDB: 0 })
    const highGain = runWorker(signal, { autoGain: true, gainDB: 60 })

    expect(flatten(highGain)).toEqual(flatten(lowGain))
  })

  it('maps the loudest bin to 255', () => {
    const result = runWorker(makeSine(4000, 0.05), { autoGain: true })
    const max = Math.max(...result[0].map((frame) => Math.max(...Array.from(frame))))
    expect(max).toBe(255)
  })

  it('leaves digital silence blank instead of amplifying the numeric floor', () => {
    const result = runWorker(new Float32Array(4000), { autoGain: true })
    expect(result[0].length).toBeGreaterThan(0)
    for (const frame of result[0]) {
      expect(frame.every((value: number) => value === 0)).toBe(true)
    }
  })

  it.each([
    ['buffered', {}],
    ['recompute', { autoGainBufferBudgetBytes: 1 }],
  ])('leaves digital silence blank under steep pre-emphasis (%s strategy)', (_label, extra) => {
    const options = { ...extra, autoGain: true, sampleRate: 48000, endTime: 1, preEmphasis: 18 }
    const result = runWorker(new Float32Array(48000), options)
    expect(result[0].length).toBeGreaterThan(0)
    for (const frame of result[0]) {
      expect(frame.every((value: number) => value === 0)).toBe(true)
    }
  })

  it('keeps a quiet signal visible when negative pre-emphasis tilts it under the silence floor', () => {
    // About 3.5 dB above the floor before pre-emphasis, 6 dB below it at -6 dB/oct and 3 kHz
    const result = runWorker(makeSine(8000, 3e-9, 3000), { autoGain: true, preEmphasis: -6 })
    expect(Math.max(...result[0].map((frame) => Math.max(...Array.from(frame))))).toBe(255)
  })

  it('produces identical output on the buffered and recompute memory strategies', () => {
    const signal = makeSine(4000)
    const options = { autoGain: true, preEmphasis: 6 }
    const buffered = runWorker(signal, options)
    const recomputed = runWorker(signal, { ...options, autoGainBufferBudgetBytes: 1 })

    expect(flatten(recomputed)).toEqual(flatten(buffered))
  })

  it('scales to the signal, not the 0 Hz row, with negative pre-emphasis', () => {
    const result = runWorker(makeSine(8000), { autoGain: true, preEmphasis: -3 })
    expect(Math.max(...result[0].map((frame) => Math.max(...Array.from(frame).slice(1))))).toBe(255)
  })
})

describe('worker compute with dynamicCompression', () => {
  it.each([false, true])('is byte-identical to omitting the option at 0 (autoGain: %s)', (autoGain) => {
    const signal = makeLoudThenQuiet(8000)
    const compressed = runWorker(signal, { autoGain, dynamicCompression: 0 })

    expect(flatten(compressed)).toEqual(flatten(runWorker(signal, { autoGain })))
  })

  it('lifts quiet frames toward 255 under autoGain while loud frames stay at 255', () => {
    const signal = makeLoudThenQuiet(8000)
    const plain = frameMaxima(runWorker(signal, { autoGain: true }))
    const half = frameMaxima(runWorker(signal, { autoGain: true, dynamicCompression: 0.5 }))
    const full = frameMaxima(runWorker(signal, { autoGain: true, dynamicCompression: 1 }))
    const quiet = plain.length - 1

    expect([plain[0], half[0], full[0]]).toEqual([255, 255, 255])
    expect(half[quiet]).toBeGreaterThan(plain[quiet])
    expect(full.every((max) => max === 255)).toBe(true)
  })

  it.each([false, true])('keeps digitally silent frames blank at full compression (autoGain: %s)', (autoGain) => {
    const signal = makeSine(8000)
    signal.fill(0, 3000, 5000)
    const result = runWorker(signal, { autoGain, dynamicCompression: 1 })
    // Frames entirely inside the gap (hop 128, window 256)
    const gapFrames = result[0].filter((_frame, i) => i * 128 >= 3000 && i * 128 + 256 <= 5000)

    expect(gapFrames.length).toBeGreaterThan(0)
    for (const frame of gapFrames) {
      expect(frame.every((value) => value === 0)).toBe(true)
    }
  })

  it('produces identical output on the buffered and recompute memory strategies', () => {
    const signal = makeLoudThenQuiet(8000)
    const options = { autoGain: true, preEmphasis: 6, dynamicCompression: 0.5 }
    const buffered = runWorker(signal, options)
    const recomputed = runWorker(signal, { ...options, autoGainBufferBudgetBytes: 1 })

    expect(flatten(recomputed)).toEqual(flatten(buffered))
  })

  it.each(['linear', 'mel'])('keeps non-DC content visible with negative pre-emphasis (%s)', (scale) => {
    const result = runWorker(makeSine(8000), { scale, preEmphasis: -3, dynamicCompression: 0.4 })
    expect(Math.max(...result[0].map((frame) => Math.max(...Array.from(frame).slice(1))))).toBe(255)
  })

  it.each([
    ['fixed gain', {}],
    ['autoGain', { autoGain: true }],
    ['autoGain, recompute strategy', { autoGain: true, autoGainBufferBudgetBytes: 1 }],
  ])('keeps a zero gap blank under steep pre-emphasis at full compression (%s)', (_label, extra) => {
    const sampleRate = 48000
    const signal = Float32Array.from({ length: sampleRate }, (_, i) => Math.sin((2 * Math.PI * 1000 * i) / sampleRate))
    signal.fill(0, 20000, 30000)
    const options = { ...extra, sampleRate, endTime: 1, preEmphasis: 18, dynamicCompression: 1 }
    const result = runWorker(signal, options)
    // Frames entirely inside the gap (hop 128, window 256)
    const gapFrames = result[0].filter((_frame, i) => i * 128 >= 20000 && i * 128 + 256 <= 30000)

    expect(gapFrames.length).toBeGreaterThan(0)
    for (const frame of gapFrames) {
      expect(frame.every((value) => value === 0)).toBe(true)
    }
    expect(Math.max(...Array.from(result[0][0]))).toBe(255)
  })
})

describe('main-thread parity with the worker for the new options', () => {
  const makeBuffer = (signal: Float32Array) => createFakeAudioBuffer(signal, { sampleRate: SAMPLE_RATE })

  it.each([
    ['preEmphasis', { preEmphasis: 6 }],
    ['autoGain', { autoGain: true }],
    ['both combined on mel scale', { preEmphasis: 6, autoGain: true, scale: 'mel' }],
  ])('matches the worker byte for byte with %s', async (_label, extra) => {
    const signal = makeSine(4000)
    const plugin: any = Spectrogram.create({ fftSamples: 256, noverlap: 128, scale: 'linear', ...extra } as any)
    plugin._init(createFakeWaveSurfer())

    const mainResult = await plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))
    const workerResult = runWorker(signal, extra as Record<string, unknown>)

    expect(mainResult[0].length).toBe(workerResult[0].length)
    mainResult[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(workerResult[0][i]))
    })
  })

  // A steady sine gives every frame the same peak, so compression would have nothing to change
  it.each([
    ['autoGain', { autoGain: true }],
    ['fixed gain', {}],
  ])('matches the worker byte for byte with dynamicCompression and %s', async (_label, extra) => {
    const signal = makeLoudThenQuiet(8000)
    const options = { ...extra, dynamicCompression: 0.5 }
    const workerResult = runWorker(signal, options)
    const quiet = workerResult[0].length - 1
    expect(Array.from(workerResult[0][quiet])).not.toEqual(Array.from(runWorker(signal, extra)[0][quiet]))

    const plugin: any = Spectrogram.create({ fftSamples: 256, noverlap: 128, scale: 'linear', ...options } as any)
    plugin._init(createFakeWaveSurfer())
    const mainResult = await plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))

    expect(flatten(mainResult)).toEqual(flatten(workerResult))
  })

  it('uses the recompute strategy on the main thread when over budget, with identical output', async () => {
    const signal = makeSine(4000)
    const makePlugin = (): any => {
      const plugin: any = Spectrogram.create({ fftSamples: 256, noverlap: 128, autoGain: true })
      plugin._init(createFakeWaveSurfer())
      return plugin
    }

    const buffered = await makePlugin().__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))
    const constrained = makePlugin()
    constrained.__spectrogramInternalsForTests().autoGainBudgetBytes = 1
    const recomputed = await constrained.__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))

    expect(flatten(recomputed)).toEqual(flatten(buffered))
  })
})

describe('explicit blackman alpha: 0 end-to-end', () => {
  const makeBuffer = (signal: Float32Array) => createFakeAudioBuffer(signal, { sampleRate: SAMPLE_RATE })

  it('is honored on the worker path, byte-identical to the main thread', async () => {
    // Distinct fftSamples so the worker module's FFT cache (keyed on sizes only) cannot
    // serve a window built for another test's windowFunc/alpha
    const signal = makeSine(4000)
    const options = { fftSamples: 512, noverlap: 256, windowFunc: 'blackman', alpha: 0 }

    const workerResult = runWorker(signal, options)
    const plugin: any = Spectrogram.create({ ...options, scale: 'linear' } as any)
    plugin._init(createFakeWaveSurfer())
    const mainResult = await plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))

    expect(mainResult[0].length).toBe(workerResult[0].length)
    mainResult[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(workerResult[0][i]))
    })
  })

  it('produces different output than the blackman default on the main thread', async () => {
    const signal = makeSine(4000)
    const create = (alpha?: number): any => {
      const plugin: any = Spectrogram.create({
        fftSamples: 256,
        noverlap: 128,
        scale: 'linear',
        windowFunc: 'blackman',
        alpha,
      } as any)
      plugin._init(createFakeWaveSurfer())
      return plugin
    }

    const explicitZero = await create(0).__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))
    const defaulted = await create(undefined).__spectrogramInternalsForTests().getFrequencies(makeBuffer(signal))

    expect(explicitZero[0].map((f: Uint8Array) => Array.from(f))).not.toEqual(
      defaulted[0].map((f: Uint8Array) => Array.from(f)),
    )
  })
})

// WindowedSpectrogramPlugin is now a thin shim delegating into spectrogram.ts's definePlugin()
// setup (see spectrogram-windowed.ts) - calculateFrequenciesMainThread/calculateFrequenciesWithWorker
// only exist post-_init(), under __spectrogramInternalsForTests().windowed. Same _init()
// precedent as the rest of this file's SpectrogramPlugin rows; see spectrogram-windowed-destroy.test.ts
// for the fuller explanation of this adaptation.
describe('windowed plugin preEmphasis', () => {
  it('tilts the main-thread computation', async () => {
    const signal = makeSine(4000)
    const create = (preEmphasis: number): any => {
      const plugin: any = WindowedSpectrogram.create({ fftSamples: 256, noverlap: 128, scale: 'linear', preEmphasis })
      plugin._init(createFakeWaveSurfer())
      const internals = plugin.__spectrogramInternalsForTests()
      internals.buffer = createFakeAudioBuffer(signal, { sampleRate: SAMPLE_RATE })
      return internals.windowed
    }

    const plain = await create(0).calculateFrequenciesMainThread(0, signal.length / SAMPLE_RATE)
    const tilted = await create(6).calculateFrequenciesMainThread(0, signal.length / SAMPLE_RATE)

    expect(flatten(tilted)).not.toEqual(flatten(plain))
    for (const frame of tilted[0]) {
      expect(frame[0]).toBe(0)
    }
  })

  it('forwards preEmphasis to the worker', async () => {
    const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 128, preEmphasis: 6 })
    plugin._init(createFakeWaveSurfer())
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = createFakeAudioBuffer(makeSine(4000), { sampleRate: SAMPLE_RATE })

    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.5)
    promise.catch(() => undefined)
    const worker = internals.worker
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    expect(worker.postMessage.mock.calls[0][0].options.preEmphasis).toBe(6)
    plugin.destroy()
  })
})

describe('dynamicCompression forwarding', () => {
  it('forwards dynamicCompression to the worker in full rendering', async () => {
    const plugin: any = Spectrogram.create({ useWebWorker: true, noverlap: 128, dynamicCompression: 0.5 })
    plugin._init(createFakeWaveSurfer())
    const internals = plugin.__spectrogramInternalsForTests()

    const promise = internals.calculateFrequenciesWithWorker(
      createFakeAudioBuffer(makeSine(4000), { sampleRate: SAMPLE_RATE }),
    )
    promise.catch(() => undefined)
    const worker = internals.worker
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    expect(worker.postMessage.mock.calls[0][0].options.dynamicCompression).toBe(0.5)
    plugin.destroy()
  })

  it('forwards dynamicCompression to the worker in windowed rendering', async () => {
    const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 128, dynamicCompression: 0.5 })
    plugin._init(createFakeWaveSurfer())
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = createFakeAudioBuffer(makeSine(4000), { sampleRate: SAMPLE_RATE })

    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.5)
    promise.catch(() => undefined)
    const worker = internals.worker
    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    expect(worker.postMessage.mock.calls[0][0].options.dynamicCompression).toBe(0.5)
    plugin.destroy()
  })

  it('compresses the windowed main-thread computation', async () => {
    const signal = makeLoudThenQuiet(8000)
    const create = (dynamicCompression: number): any => {
      const plugin: any = WindowedSpectrogram.create({
        fftSamples: 256,
        noverlap: 128,
        scale: 'linear',
        dynamicCompression,
      })
      plugin._init(createFakeWaveSurfer())
      const internals = plugin.__spectrogramInternalsForTests()
      internals.buffer = createFakeAudioBuffer(signal, { sampleRate: SAMPLE_RATE })
      return internals.windowed
    }

    const plain = await create(0).calculateFrequenciesMainThread(0, signal.length / SAMPLE_RATE)
    const compressed = await create(0.5).calculateFrequenciesMainThread(0, signal.length / SAMPLE_RATE)

    expect(flatten(compressed)).not.toEqual(flatten(plain))
  })
})
