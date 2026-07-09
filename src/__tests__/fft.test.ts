import FFT, {
  applyFilterBank,
  applySparseFilterBank,
  createFilterBankForScale,
  createSparseFilterBankForScale,
  magnitudesToColorIndices,
  magnitudesToDb,
  dbToColorIndices,
  createPreEmphasisTilt,
  getBinFrequencies,
  SILENCE_FLOOR_DB,
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

describe('magnitudesToColorIndices', () => {
  /** The exact inline loop this helper replaced in all three plugins */
  function legacyLoop(spectrum: Float32Array, gainDB: number, rangeDB: number): Uint8Array {
    const freqBins = new Uint8Array(spectrum.length)
    const gainPlusRange = gainDB + rangeDB
    for (let j = 0; j < spectrum.length; j++) {
      const magnitude = spectrum[j] > 1e-12 ? spectrum[j] : 1e-12
      const valueDB = 20 * Math.log10(magnitude)
      if (valueDB <= -gainPlusRange) {
        freqBins[j] = 0
      } else if (valueDB >= -gainDB) {
        freqBins[j] = 255
      } else {
        freqBins[j] = Math.round(((valueDB + gainPlusRange) / rangeDB) * 255)
      }
    }
    return freqBins
  }

  const dbToMagnitude = (db: number) => Math.pow(10, db / 20)

  it('is byte-identical to the reference loop, including boundary values', () => {
    const gainDB = 20
    const rangeDB = 80
    // Magnitudes spanning silence, the 1e-12 floor, the full ramp, both clip branches, and
    // values just around the -gainDB white point
    const values: number[] = [0, 1e-15, 1e-12, 2e-12, 1]
    for (let db = -140; db <= 20; db += 0.37) {
      values.push(dbToMagnitude(db))
    }
    for (const db of [-100.001, -100, -99.999, -20.2, -20.157, -20.1, -20.001, -20, -19.999]) {
      values.push(dbToMagnitude(db))
    }
    const spectrum = Float32Array.from(values)

    expect(Array.from(magnitudesToColorIndices(spectrum, -gainDB, rangeDB))).toEqual(
      Array.from(legacyLoop(spectrum, gainDB, rangeDB)),
    )
  })

  it('is byte-identical to the reference loop across gain/range combinations on a real spectrum', () => {
    const signal = makeSine(512, 1000, 16000)
    const spectrum = new (FFT as any)(512, 16000, 'hann', undefined).calculateSpectrum(signal)

    for (const [gainDB, rangeDB] of [
      [20, 80],
      [0, 40],
      [40, 120],
      [-10, 60],
    ]) {
      expect(Array.from(magnitudesToColorIndices(spectrum, -gainDB, rangeDB))).toEqual(
        Array.from(legacyLoop(spectrum, gainDB, rangeDB)),
      )
    }
  })

  it('rejects invalid whiteDb and rangeDB values', () => {
    const spectrum = new Float32Array(4)
    expect(() => magnitudesToColorIndices(spectrum, NaN, 80)).toThrow(TypeError)
    expect(() => magnitudesToColorIndices(spectrum, -20, 0)).toThrow(TypeError)
    expect(() => magnitudesToColorIndices(spectrum, -20, -80)).toThrow(TypeError)
    expect(() => magnitudesToColorIndices(spectrum, -20, NaN)).toThrow(TypeError)
    expect(() => magnitudesToColorIndices(spectrum, Infinity, 80)).toThrow(TypeError)
  })
})

describe('preEmphasis tilt and autoGain helpers', () => {
  it('computes the Praat tilt: -6/0/+6 dB at 500/1000/2000 Hz for preEmphasis 6', () => {
    const tilt = createPreEmphasisTilt(6, [500, 1000, 2000])
    expect(tilt[0]).toBeCloseTo(-6, 10)
    expect(tilt[1]).toBeCloseTo(0, 10)
    expect(tilt[2]).toBeCloseTo(6, 10)
  })

  it('sends the DC bin toward -infinity instead of NaN (the 1e-308 guard)', () => {
    const tilt = createPreEmphasisTilt(6, [0, 1000])
    expect(Number.isFinite(tilt[0])).toBe(true)
    expect(tilt[0]).toBeLessThan(-6000)
  })

  it('rejects non-finite preEmphasis', () => {
    expect(() => createPreEmphasisTilt(NaN, [1000])).toThrow(TypeError)
    expect(() => createPreEmphasisTilt(Infinity, [1000])).toThrow(TypeError)
  })

  it('derives bin frequencies from linear bins or the sparse scale rows', () => {
    const linear = getBinFrequencies(null, 512, 16000)
    expect(linear.length).toBe(256)
    expect(linear[0]).toBe(0)
    expect(linear[64]).toBe((64 * 16000) / 512)

    const bank = createSparseFilterBankForScale('mel', 256, 512, 16000)!
    const scaled = getBinFrequencies(bank, 512, 16000)
    expect(Array.from(scaled)).toEqual(bank.map((filter) => filter.centerHz))
  })

  it('rejects a tilt whose length does not match the spectrum', () => {
    const spectrum = new Float32Array(8)
    const tilt = createPreEmphasisTilt(6, [1000])
    expect(() => magnitudesToColorIndices(spectrum, -20, 80, tilt)).toThrow(TypeError)
    expect(() => magnitudesToDb(spectrum, tilt)).toThrow(TypeError)
  })

  it('reuses the out buffer in magnitudesToDb when shapes match', () => {
    const spectrum = Float32Array.from([1, 0.1, 0.01])
    const out = new Float32Array(3)
    expect(magnitudesToDb(spectrum, null, out)).toBe(out)
    expect(out[0]).toBeCloseTo(0, 5)
    expect(out[1]).toBeCloseTo(-20, 4)
  })

  it('maps the exact white point to 255 in dbToColorIndices (autoGain semantics)', () => {
    const db = Float32Array.from([-10, -30, -90, -200])
    const indices = dbToColorIndices(db, -10, 80)
    expect(indices[0]).toBe(255) // valueDB === whiteDb -> 255, not the wrapped 0
    expect(indices[3]).toBe(0) // below whiteDb - rangeDB
    expect(indices[1]).toBeGreaterThan(0)
    expect(indices[1]).toBeLessThan(255)
    expect(indices[1]).toBeGreaterThan(indices[2])
  })

  it('rejects invalid whiteDb/rangeDB in dbToColorIndices', () => {
    const db = new Float32Array(4)
    expect(() => dbToColorIndices(db, NaN, 80)).toThrow(TypeError)
    expect(() => dbToColorIndices(db, -20, 0)).toThrow(TypeError)
    expect(() => dbToColorIndices(db, -20, -1)).toThrow(TypeError)
  })

  it('exports a silence floor far below real signal levels', () => {
    expect(SILENCE_FLOOR_DB).toBe(-180)
  })

  it('honors an explicit blackman alpha of 0 instead of coercing it to the default', () => {
    const explicitZero = new (FFT as any)(64, 8000, 'blackman', 0)
    const defaulted = new (FFT as any)(64, 8000, 'blackman', undefined)
    expect(explicitZero.windowValues[10]).not.toBe(defaulted.windowValues[10])
  })
})
