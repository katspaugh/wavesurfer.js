import FFT from '../fft.js'
import '../plugins/spectrogram-worker.js'

type WorkerOptions = {
  startTime: number
  endTime: number
  sampleRate: number
  fftSamples: number
  windowFunc: string
  alpha?: number
  noverlap: number
  scale: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  gainDB: number
  rangeDB: number
  splitChannels: boolean
}

const SAMPLE_RATE = 8000
const GAIN_DB = 20
const RANGE_DB = 80

/** A 1 kHz sine, long enough for several FFT frames */
function makeSine(length: number): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE)
  }
  return signal
}

/** Dispatch a message to the worker handler and return its response synchronously */
function runWorker(signal: Float32Array, options: WorkerOptions): Uint8Array[][] {
  const postMessage = jest.fn()
  ;(self as any).postMessage = postMessage
  ;(self as any).onmessage({
    data: { type: 'calculateFrequencies', id: 'test', audioData: [signal], options },
  })
  const response = postMessage.mock.calls[0][0]
  expect(response.error).toBeUndefined()
  return response.result
}

/** The main-thread computation from spectrogram.ts getFrequencies(), linear scale */
function mainThreadFrequencies(
  signal: Float32Array,
  fftSamples: number,
  windowFunc: string,
  alpha: number | undefined,
): Uint8Array[] {
  const fft = new (FFT as any)(fftSamples, SAMPLE_RATE, windowFunc, alpha)

  const noverlap = Math.round(fftSamples * 0.5)
  const hopSize = Math.max(Math.max(64, fftSamples * 0.25), fftSamples - noverlap)

  const frames: Uint8Array[] = []
  for (let sample = 0; sample + fftSamples < signal.length; sample += hopSize) {
    const spectrum = fft.calculateSpectrum(signal.slice(sample, sample + fftSamples))
    const freqBins = new Uint8Array(spectrum.length)
    for (let j = 0; j < spectrum.length; j++) {
      const magnitude = spectrum[j] > 1e-12 ? spectrum[j] : 1e-12
      const valueDB = 20 * Math.log10(magnitude)
      if (valueDB <= -(GAIN_DB + RANGE_DB)) {
        freqBins[j] = 0
      } else if (valueDB >= -GAIN_DB) {
        freqBins[j] = 255
      } else {
        freqBins[j] = Math.round(((valueDB + GAIN_DB + RANGE_DB) / RANGE_DB) * 255)
      }
    }
    frames.push(freqBins)
  }
  return frames
}

function workerOptions(signal: Float32Array, fftSamples: number, windowFunc: string, alpha?: number): WorkerOptions {
  return {
    startTime: 0,
    endTime: signal.length / SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    fftSamples,
    windowFunc,
    alpha,
    noverlap: Math.round(fftSamples * 0.5),
    scale: 'linear',
    gainDB: GAIN_DB,
    rangeDB: RANGE_DB,
    splitChannels: false,
  }
}

describe('spectrogram worker', () => {
  it('uses the same default window alpha as the main thread when alpha is not set', () => {
    const fftSamples = 512
    const signal = makeSine(4000)

    const workerResult = runWorker(signal, workerOptions(signal, fftSamples, 'gauss'))
    const mainResult = mainThreadFrequencies(signal, fftSamples, 'gauss', undefined)

    expect(workerResult[0].length).toBe(mainResult.length)
    expect(mainResult.some((frame) => frame.some((value) => value > 0))).toBe(true)
    workerResult[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(mainResult[i]))
    })
  })

  it('honors an explicitly set alpha', () => {
    const fftSamples = 256
    const signal = makeSine(4000)

    const workerResult = runWorker(signal, workerOptions(signal, fftSamples, 'gauss', 0.4))
    const mainResult = mainThreadFrequencies(signal, fftSamples, 'gauss', 0.4)

    expect(workerResult[0].length).toBe(mainResult.length)
    workerResult[0].forEach((frame: Uint8Array, i: number) => {
      expect(Array.from(frame)).toEqual(Array.from(mainResult[i]))
    })
  })
})
