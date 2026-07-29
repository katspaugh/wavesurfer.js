import FFT from '../fft.js'
import { createSparseFilterBankForScale, applySparseFilterBank } from '../spectrogram-render-utils.js'

const SCALES = ['mel', 'logarithmic', 'bark', 'erb'] as const

function makeSine(length: number, frequency: number, sampleRate: number): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return signal
}

describe('FFT zero-padding (windowLength)', () => {
  const SAMPLE_RATE = 16000

  it('defaults windowLength to the buffer size with unchanged output', () => {
    const signal = makeSine(512, 1000, SAMPLE_RATE)
    const spectrum = new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined).calculateSpectrum(signal)
    const spectrumExplicit = new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 512).calculateSpectrum(signal)

    expect(Array.from(spectrumExplicit)).toEqual(Array.from(spectrum))
  })

  it('keeps bin magnitudes calibrated when the window is zero-padded', () => {
    // Sine on bin 8 of a 64-sample transform = bin 64 of a 512-sample transform
    const frequency = (8 * SAMPLE_RATE) / 64
    const signal = makeSine(64, frequency, SAMPLE_RATE)

    const unpadded = new (FFT as any)(64, SAMPLE_RATE, 'hann', undefined).calculateSpectrum(signal)

    const frame = new Float32Array(512)
    frame.set(signal)
    const padded = new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 64).calculateSpectrum(frame)

    // Without the bufferSize / windowLength window scaling this would be 8x (-18 dB) off
    expect(padded.length).toBe(256)
    expect(padded[64]).toBeCloseTo(unpadded[8], 5)
  })

  it('produces finite, correctly sized output for non-linear scales with a padded FFT', () => {
    const fftSamples = 64
    const fftSize = 512
    const frame = new Float32Array(fftSize)
    frame.set(makeSine(fftSamples, 1000, SAMPLE_RATE))
    const spectrum = new (FFT as any)(fftSize, SAMPLE_RATE, 'hann', undefined, fftSamples).calculateSpectrum(frame)

    for (const scale of SCALES) {
      const filterBank = createSparseFilterBankForScale(scale, fftSize / 2, fftSize, SAMPLE_RATE)!
      const mapped = applySparseFilterBank(spectrum, filterBank)
      expect(mapped.length).toBe(fftSize / 2)
      expect(Array.from(mapped).every(Number.isFinite)).toBe(true)
    }
  })

  it('masks stale samples beyond the window with the zeroed window tail', () => {
    const signal = makeSine(64, 1000, SAMPLE_RATE)
    const fft = new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 64)

    const cleanFrame = new Float32Array(512)
    cleanFrame.set(signal)
    const staleFrame = new Float32Array(512).fill(0.5)
    staleFrame.set(signal)

    expect(Array.from(fft.calculateSpectrum(staleFrame))).toEqual(Array.from(fft.calculateSpectrum(cleanFrame)))
  })

  it('throws when windowLength exceeds the buffer size', () => {
    expect(() => new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 1024)).toThrow()
  })

  it('throws when windowLength is shorter than two samples', () => {
    // Window formulas divide by (windowLength - 1): a one-sample window would yield NaN spectra
    expect(() => new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 1)).toThrow()
  })

  it('rejects explicit invalid windowLength values instead of coercing them', () => {
    expect(() => new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 0)).toThrow()
    expect(() => new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, NaN)).toThrow()
    expect(() => new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, 80.5)).toThrow()
    expect(() => new (FFT as any)(512, SAMPLE_RATE, 'hann', undefined, -64)).toThrow()
  })
})

describe('FFT window construction', () => {
  it('honors an explicit blackman alpha of 0 instead of coercing it to the default', () => {
    const explicitZero = new (FFT as any)(64, 8000, 'blackman', 0)
    const defaulted = new (FFT as any)(64, 8000, 'blackman', undefined)
    expect(explicitZero.windowValues[10]).not.toBe(defaulted.windowValues[10])
  })
})
