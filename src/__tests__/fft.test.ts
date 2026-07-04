import FFT, {
  applyFilterBank,
  applySparseFilterBank,
  createFilterBankForScale,
  createSparseFilterBankForScale,
} from '../fft.js'

const SCALES = ['mel', 'logarithmic', 'bark', 'erb'] as const

/** Deterministic pseudo-random spectrum (LCG) so parity failures are reproducible */
function makeSpectrum(length: number, seed = 1): Float32Array {
  const spectrum = new Float32Array(length)
  let state = seed
  for (let i = 0; i < length; i++) {
    state = (state * 48271) % 2147483647
    spectrum[i] = state / 2147483647
  }
  return spectrum
}

function makeSine(length: number, frequency: number, sampleRate: number): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return signal
}

describe('sparse filter bank', () => {
  it.each(SCALES)('produces byte-identical output to the dense filter bank for %s scale', (scale) => {
    for (const [fftSamples, sampleRate] of [
      [512, 44100],
      [512, 16000],
      [1024, 48000],
      [64, 8000],
    ]) {
      const numFilters = fftSamples / 2
      const dense = createFilterBankForScale(scale, numFilters, fftSamples, sampleRate)
      const sparse = createSparseFilterBankForScale(scale, numFilters, fftSamples, sampleRate)
      const spectrum = makeSpectrum(fftSamples / 2)

      const denseOut = applyFilterBank(spectrum, dense!)
      const sparseOut = applySparseFilterBank(spectrum, sparse!)

      expect(sparseOut.length).toBe(denseOut.length)
      expect(Array.from(sparseOut)).toEqual(Array.from(denseOut))
    }
  })

  it('returns null for linear scale, like the dense variant', () => {
    expect(createSparseFilterBankForScale('linear', 256, 512, 44100)).toBeNull()
    expect(createFilterBankForScale('linear', 256, 512, 44100)).toBeNull()
  })

  it.each(SCALES)('stores exactly one two-tap entry per output row for %s scale', (scale) => {
    const numFilters = 256
    const sparse = createSparseFilterBankForScale(scale, numFilters, 512, 44100)!

    expect(sparse.length).toBe(numFilters)
    for (const { lo, weightLo, weightHi, centerHz } of sparse) {
      expect(Number.isInteger(lo)).toBe(true)
      expect(Number.isFinite(weightLo)).toBe(true)
      expect(Number.isFinite(weightHi)).toBe(true)
      expect(Number.isFinite(centerHz)).toBe(true)
    }
  })

  it.each(SCALES)('stores monotonically increasing center frequencies up to Nyquist for %s scale', (scale) => {
    const sampleRate = 44100
    const sparse = createSparseFilterBankForScale(scale, 256, 512, sampleRate)!

    for (let i = 1; i < sparse.length; i++) {
      expect(sparse[i].centerHz).toBeGreaterThan(sparse[i - 1].centerHz)
    }
    expect(sparse[0].centerHz).toBeGreaterThanOrEqual(0)
    expect(sparse[sparse.length - 1].centerHz).toBeLessThanOrEqual(sampleRate / 2)
  })
})

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
