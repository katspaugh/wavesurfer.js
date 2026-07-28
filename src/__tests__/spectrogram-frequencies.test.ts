import {
  computeFrequencies,
  FrequencyParams,
  __getFFTCacheStatsForTests,
  __resetFFTCacheForTests,
} from '../spectrogram-frequencies.js'
import FFT, {
  createSparseFilterBankForScale,
  applySparseFilterBank,
  magnitudesToColorIndices,
  magnitudesToDb,
  dbToColorIndices,
  createPreEmphasisTilt,
  getBinFrequencies,
  SILENCE_FLOOR_DB,
  AUTO_GAIN_BUFFER_BUDGET_BYTES,
} from '../fft.js'

/**
 * Oracle: a verbatim port of `calculateFrequencies` from src/plugins/spectrogram-worker.ts,
 * taken before that loop was deleted and replaced with a call into computeFrequencies. This
 * pins down the pre-refactor reference behavior so the new shared module can be checked
 * against it, instead of against itself.
 */
type OracleOptions = {
  startTime: number
  endTime: number
  sampleRate: number
  fftSamples: number
  fftSize?: number
  windowFunc: string
  alpha?: number
  noverlap: number
  scale: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  gainDB: number
  rangeDB: number
  preEmphasis?: number
  autoGain?: boolean
  autoGainBufferBudgetBytes?: number
  splitChannels: boolean
}

function oracleCalculateFrequencies(audioChannels: Float32Array[], options: OracleOptions): Uint8Array[][] {
  const {
    startTime,
    endTime,
    sampleRate,
    fftSamples,
    fftSize,
    windowFunc,
    alpha,
    noverlap,
    scale,
    gainDB,
    rangeDB,
    preEmphasis,
    autoGain,
    autoGainBufferBudgetBytes,
    splitChannels,
  } = options

  const startSample = Math.floor(startTime * sampleRate)
  const endSample = Math.floor(endTime * sampleRate)
  const channels = splitChannels ? audioChannels.length : 1
  const fftLength = fftSize ?? fftSamples

  const fft = new (FFT as any)(fftLength, sampleRate, windowFunc, alpha, fftSamples)

  const numFilters = fftLength / 2
  const filterBank = createSparseFilterBankForScale(scale, numFilters, fftLength, sampleRate)

  let actualNoverlap = noverlap || Math.max(0, Math.round(fftSamples * 0.5))
  const maxOverlap = Math.floor(fftSamples / 2)
  actualNoverlap = Math.min(actualNoverlap, maxOverlap)
  const minHopSize = Math.max(64, Math.ceil(fftSamples * 0.25))
  const hopSize = Math.max(minHopSize, fftSamples - actualNoverlap)

  const frequencies: Uint8Array[][] = []
  const frame = new Float32Array(fftLength)

  const tilt = preEmphasis
    ? createPreEmphasisTilt(preEmphasis, getBinFrequencies(filterBank, fftLength, sampleRate))
    : null

  const computeSpectrum = (channelData: Float32Array, sample: number): Float32Array => {
    frame.set(channelData.subarray(sample, sample + fftSamples))
    let spectrum = fft.calculateSpectrum(frame)
    if (filterBank) {
      spectrum = applySparseFilterBank(spectrum, filterBank)
    }
    return spectrum
  }

  if (!autoGain) {
    for (let c = 0; c < channels; c++) {
      const channelData = audioChannels[c]
      const channelFreq: Uint8Array[] = []
      for (let sample = startSample; sample + fftSamples < endSample; sample += hopSize) {
        channelFreq.push(magnitudesToColorIndices(computeSpectrum(channelData, sample), -gainDB, rangeDB, tilt))
      }
      frequencies.push(channelFreq)
    }
    return frequencies
  }

  const bins = fftLength / 2
  const span = endSample - startSample
  const frameCount = span > fftSamples ? Math.floor((span - fftSamples - 1) / hopSize) + 1 : 0
  const estimatedBytes = frameCount * bins * 4 * channels
  const budgetBytes = autoGainBufferBudgetBytes ?? AUTO_GAIN_BUFFER_BUDGET_BYTES
  let maxDb = -Infinity

  if (estimatedBytes < budgetBytes) {
    const dbFrames: Float32Array[][] = []
    for (let c = 0; c < channels; c++) {
      const channelData = audioChannels[c]
      const channelDb: Float32Array[] = []
      for (let sample = startSample; sample + fftSamples < endSample; sample += hopSize) {
        const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt)
        for (let i = 0; i < db.length; i++) {
          if (db[i] > maxDb) maxDb = db[i]
        }
        channelDb.push(db)
      }
      dbFrames.push(channelDb)
    }
    const silent = maxDb < SILENCE_FLOOR_DB
    for (const channelDb of dbFrames) {
      frequencies.push(
        channelDb.map((db) => (silent ? new Uint8Array(db.length) : dbToColorIndices(db, maxDb, rangeDB))),
      )
    }
    return frequencies
  }

  const dbScratch = new Float32Array(bins)
  for (let c = 0; c < channels; c++) {
    const channelData = audioChannels[c]
    for (let sample = startSample; sample + fftSamples < endSample; sample += hopSize) {
      const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt, dbScratch)
      for (let i = 0; i < db.length; i++) {
        if (db[i] > maxDb) maxDb = db[i]
      }
    }
  }
  const silent = maxDb < SILENCE_FLOOR_DB
  for (let c = 0; c < channels; c++) {
    const channelData = audioChannels[c]
    const channelFreq: Uint8Array[] = []
    for (let sample = startSample; sample + fftSamples < endSample; sample += hopSize) {
      if (silent) {
        channelFreq.push(new Uint8Array(bins))
      } else {
        const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt, dbScratch)
        channelFreq.push(dbToColorIndices(db, maxDb, rangeDB))
      }
    }
    frequencies.push(channelFreq)
  }
  return frequencies
}

function expectEqualFrequencies(actual: Uint8Array[][], expected: Uint8Array[][]) {
  expect(actual.length).toBe(expected.length)
  actual.forEach((channel, c) => {
    expect(channel.length).toBe(expected[c].length)
    channel.forEach((frame, i) => {
      expect(Array.from(frame)).toEqual(Array.from(expected[c][i]))
    })
  })
}

const SAMPLE_RATE = 8000

/** A sine at `freqHz`, long enough for several FFT frames */
function makeSine(length: number, freqHz: number, sampleRate = SAMPLE_RATE): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate)
  }
  return signal
}

describe('computeFrequencies oracle equivalence (pre-refactor worker loop)', () => {
  const cases: Array<{
    name: string
    params: Omit<FrequencyParams, 'sampleRate'>
    oracleExtra?: Partial<OracleOptions>
  }> = [
    {
      name: 'linear scale, no autoGain',
      params: { fftSamples: 256, scale: 'linear', noverlap: 128, gainDB: 20, rangeDB: 80 },
    },
    {
      name: 'mel scale, no autoGain',
      params: { fftSamples: 256, scale: 'mel', noverlap: 128, gainDB: 20, rangeDB: 80 },
    },
    { name: 'bark scale', params: { fftSamples: 256, scale: 'bark', noverlap: 128, gainDB: 20, rangeDB: 80 } },
    { name: 'erb scale', params: { fftSamples: 256, scale: 'erb', noverlap: 128, gainDB: 20, rangeDB: 80 } },
    {
      name: 'logarithmic scale',
      params: { fftSamples: 256, scale: 'logarithmic', noverlap: 128, gainDB: 20, rangeDB: 80 },
    },
    {
      name: 'autoGain within budget',
      params: { fftSamples: 256, scale: 'linear', noverlap: 128, gainDB: 20, rangeDB: 80, autoGain: true },
    },
    {
      name: 'autoGain over budget (forced tiny budget)',
      params: {
        fftSamples: 256,
        scale: 'linear',
        noverlap: 128,
        gainDB: 20,
        rangeDB: 80,
        autoGain: true,
        autoGainBufferBudgetBytes: 1,
      },
    },
    {
      name: 'preEmphasis tilt applied',
      params: { fftSamples: 256, scale: 'mel', noverlap: 128, gainDB: 20, rangeDB: 80, preEmphasis: 6 },
    },
    {
      name: 'explicit alpha for gauss window',
      params: {
        fftSamples: 256,
        scale: 'linear',
        noverlap: 128,
        gainDB: 20,
        rangeDB: 80,
        windowFunc: 'gauss',
        alpha: 0.4,
      },
    },
    {
      name: 'zero-padded fftSize > fftSamples',
      params: { fftSamples: 200, fftSize: 256, scale: 'linear', noverlap: 100, gainDB: 20, rangeDB: 80 },
    },
    {
      name: 'noverlap: 0 is treated as unset (falsy re-fallback quirk preserved)',
      params: { fftSamples: 256, scale: 'linear', noverlap: 0, gainDB: 20, rangeDB: 80 },
    },
    {
      name: 'noverlap: null falls back same as 0/undefined',
      params: { fftSamples: 256, scale: 'linear', noverlap: null, gainDB: 20, rangeDB: 80 },
    },
  ]

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const signal = makeSine(4000, 1000)
    const params: FrequencyParams = { ...testCase.params, sampleRate: SAMPLE_RATE }

    const actual = computeFrequencies([signal], params)
    const expected = oracleCalculateFrequencies([signal], {
      startTime: 0,
      endTime: signal.length / SAMPLE_RATE,
      sampleRate: SAMPLE_RATE,
      fftSamples: params.fftSamples,
      fftSize: params.fftSize ?? undefined,
      windowFunc: params.windowFunc ?? 'hann',
      alpha: params.alpha,
      noverlap: params.noverlap ?? 0,
      scale: params.scale ?? 'linear',
      gainDB: params.gainDB ?? 20,
      rangeDB: params.rangeDB ?? 80,
      preEmphasis: params.preEmphasis ?? undefined,
      autoGain: params.autoGain,
      autoGainBufferBudgetBytes: params.autoGainBufferBudgetBytes,
      splitChannels: true,
      ...testCase.oracleExtra,
    })

    expectEqualFrequencies(actual, expected)
  })

  it('matches the oracle across multiple channels with independent content', () => {
    const signalA = makeSine(4000, 1000)
    const signalB = makeSine(4000, 2000)
    const params: FrequencyParams = {
      fftSamples: 256,
      scale: 'mel',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    }

    const actual = computeFrequencies([signalA, signalB], params)
    const expected = oracleCalculateFrequencies([signalA, signalB], {
      startTime: 0,
      endTime: signalA.length / SAMPLE_RATE,
      sampleRate: SAMPLE_RATE,
      fftSamples: 256,
      windowFunc: 'hann',
      noverlap: 128,
      scale: 'mel',
      gainDB: 20,
      rangeDB: 80,
      splitChannels: true,
    })

    expectEqualFrequencies(actual, expected)
  })

  it('matches the oracle when the caller pre-slices a sample range via subarray', () => {
    // The worker sliced [startSample, endSample) out of a full-length channel using
    // startTime/endTime; computeFrequencies instead expects the caller to pass an
    // already-sliced view. A subarray is a zero-copy view over the same buffer, so this
    // should be numerically identical to the oracle's startTime/endTime range.
    const fullSignal = makeSine(8000, 1000)
    const startTime = 0.25
    const endTime = 0.75
    const startSample = Math.floor(startTime * SAMPLE_RATE)
    const endSample = Math.floor(endTime * SAMPLE_RATE)
    const sliced = fullSignal.subarray(startSample, endSample)

    const params: FrequencyParams = {
      fftSamples: 256,
      scale: 'linear',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    }
    const actual = computeFrequencies([sliced], params)

    const expected = oracleCalculateFrequencies([fullSignal], {
      startTime,
      endTime,
      sampleRate: SAMPLE_RATE,
      fftSamples: 256,
      windowFunc: 'hann',
      noverlap: 128,
      scale: 'linear',
      gainDB: 20,
      rangeDB: 80,
      splitChannels: true,
    })

    expectEqualFrequencies(actual, expected)
  })
})

describe('computeFrequencies golden values', () => {
  it('produces the expected shape (channels x frames x bins) and locates the sine peak bin', () => {
    const fftSamples = 256
    const freqHz = 1000
    const signal = makeSine(4096, freqHz)

    const result = computeFrequencies([signal], {
      fftSamples,
      scale: 'linear',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    })

    // Shape: one channel
    expect(result.length).toBe(1)
    const frames = result[0]
    expect(frames.length).toBeGreaterThan(0)

    const bins = fftSamples / 2
    const expectedBin = Math.round((freqHz * fftSamples) / SAMPLE_RATE)

    for (const frame of frames) {
      // Each frame has fftSamples/2 bins (linear scale has no filter bank)
      expect(frame.length).toBe(bins)

      // The loudest bin in every frame should be at (or immediately next to) the sine's bin
      let peakBin = 0
      let peakValue = -1
      for (let i = 0; i < frame.length; i++) {
        if (frame[i] > peakValue) {
          peakValue = frame[i]
          peakBin = i
        }
      }
      expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(1)
    }
  })

  it('produces one output array per input channel', () => {
    const signalA = makeSine(2048, 500)
    const signalB = makeSine(2048, 1500)
    const signalC = makeSine(2048, 3000)

    const result = computeFrequencies([signalA, signalB, signalC], {
      fftSamples: 128,
      scale: 'mel',
      noverlap: 64,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    })

    expect(result.length).toBe(3)
    result.forEach((channel) => expect(channel.length).toBeGreaterThan(0))
  })

  it('returns an empty channel when the signal is shorter than one FFT window', () => {
    const shortSignal = makeSine(100, 1000)

    const result = computeFrequencies([shortSignal], {
      fftSamples: 256,
      scale: 'linear',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    })

    expect(result.length).toBe(1)
    expect(result[0].length).toBe(0)
  })

  it('produces a blank (all-zero) grid for digital silence under autoGain', () => {
    const silence = new Float32Array(4096)

    const result = computeFrequencies([silence], {
      fftSamples: 256,
      scale: 'linear',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      autoGain: true,
      sampleRate: SAMPLE_RATE,
    })

    expect(result[0].length).toBeGreaterThan(0)
    for (const frame of result[0]) {
      expect(Array.from(frame).every((v) => v === 0)).toBe(true)
    }
  })

  it('produces a blank (all-zero) grid for digital silence under autoGain on the over-budget path', () => {
    // Forcing autoGainBufferBudgetBytes down to 1 byte pushes computeFrequencies past the
    // "keep dB frames between passes" branch into the "only track the max, recompute for
    // quantization" branch - this is a second, separately-implemented silent-output path
    // (see the `if (silent) { channelFreq.push(new Uint8Array(bins)) }` arm) that the
    // in-budget silence test above never exercises.
    const silence = new Float32Array(4096)

    const result = computeFrequencies([silence], {
      fftSamples: 256,
      scale: 'linear',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      autoGain: true,
      autoGainBufferBudgetBytes: 1,
      sampleRate: SAMPLE_RATE,
    })

    expect(result[0].length).toBeGreaterThan(0)
    for (const frame of result[0]) {
      expect(Array.from(frame).every((v) => v === 0)).toBe(true)
    }
  })

  it('reuses a cached FFT instance for repeated identical params without changing output', () => {
    // Two back-to-back calls with different fftSamples must not interfere with each
    // other's output, as they would if the cache key omitted any FFT-construction param.
    __resetFFTCacheForTests()
    const signalSmall = makeSine(2048, 1000)
    const signalLarge = makeSine(2048, 1000)

    const resultSmall = computeFrequencies([signalSmall], {
      fftSamples: 128,
      scale: 'linear',
      noverlap: 64,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    })
    const resultLarge = computeFrequencies([signalLarge], {
      fftSamples: 256,
      scale: 'linear',
      noverlap: 128,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    })
    const resultSmallAgain = computeFrequencies([signalSmall], {
      fftSamples: 128,
      scale: 'linear',
      noverlap: 64,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    })

    expect(resultSmall[0][0].length).toBe(64)
    expect(resultLarge[0][0].length).toBe(128)
    expectEqualFrequencies(resultSmall, resultSmallAgain)
  })

  it('constructs one FFT per distinct param set, not per call', () => {
    __resetFFTCacheForTests()
    const signal = makeSine(2048, 1000)
    const params: FrequencyParams = {
      fftSamples: 128,
      scale: 'linear',
      noverlap: 64,
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    }

    computeFrequencies([signal], params)
    computeFrequencies([signal], params)
    expect(__getFFTCacheStatsForTests()).toEqual({ size: 1, constructions: 1 })

    // A third call with a different fftSamples must construct (and cache) a second instance
    computeFrequencies([signal], { ...params, fftSamples: 256, noverlap: 128 })
    expect(__getFFTCacheStatsForTests()).toEqual({ size: 2, constructions: 2 })
  })

  it('evicts the oldest cache entry once the cache exceeds its capacity', () => {
    __resetFFTCacheForTests()
    const signal = makeSine(2048, 1000)
    const baseParams: Omit<FrequencyParams, 'fftSamples' | 'noverlap'> = {
      scale: 'linear',
      gainDB: 20,
      rangeDB: 80,
      sampleRate: SAMPLE_RATE,
    }

    // Five distinct fftSamples values, one more than the cache's capacity of four
    const fftSamplesValues = [64, 128, 256, 512, 1024]
    for (const fftSamples of fftSamplesValues) {
      computeFrequencies([signal], { ...baseParams, fftSamples, noverlap: Math.floor(fftSamples / 2) })
    }

    const stats = __getFFTCacheStatsForTests()
    expect(stats.constructions).toBe(5)
    expect(stats.size).toBeLessThanOrEqual(4)

    // Re-running the very first (now-evicted) config must still produce a correct result,
    // and must construct a new FFT instance rather than serving a wrong cached one
    const resultAfterEviction = computeFrequencies([signal], {
      ...baseParams,
      fftSamples: 64,
      noverlap: 32,
    })
    expect(resultAfterEviction[0][0].length).toBe(32)
    expect(__getFFTCacheStatsForTests().constructions).toBe(6)
  })
})
