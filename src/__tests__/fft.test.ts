import {
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
