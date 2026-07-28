/**
 * Shared frequency-computation module for the spectrogram plugins.
 *
 * This is the single source of truth for turning raw audio samples into the
 * per-channel, per-frame Uint8Array color-index grids the spectrogram
 * plugins draw. It was extracted from three near-identical copies of the
 * same loop (the worker, the main-thread plugin, and the windowed plugin's
 * main-thread fallback) to stop them drifting apart. The worker's copy was
 * the most complete of the three (it alone had both the autoGain budget
 * strategies and the noverlap re-fallback), so it is the behavioral
 * reference this module reproduces exactly.
 *
 * Pure by design: every FFT instance and scratch buffer is owned by a
 * single call, so concurrent callers (e.g. the worker handling requests
 * back-to-back) never share mutable state.
 */

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
} from './fft.js'

export type FrequencyParams = {
  /** FFT window size in samples: the number of samples per analysis frame before zero-padding. */
  fftSamples: number
  /** Zero-padded FFT length; must be >= fftSamples. Defaults to fftSamples when omitted or null. */
  fftSize?: number | null
  /** Window function name (see fft.ts). Undefined defers to FFT's own default ('hann'). */
  windowFunc?: string
  /** Shape parameter used only by the 'blackman' and 'gauss' window functions. */
  alpha?: number
  /**
   * Frame overlap in samples. A falsy value (0, null, or undefined) falls back to
   * round(fftSamples * 0.5) - this mirrors the worker's original behavior, where an
   * explicit 0 is indistinguishable from "not set".
   */
  noverlap?: number | null
  /** Frequency axis scale used to build the filter bank. */
  scale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  /** dB floor (as a positive attenuation) above which color intensity starts ramping up from 0. */
  gainDB?: number
  /** dB span mapped from color index 0 to 255. */
  rangeDB?: number
  /** Praat-style high-frequency pre-emphasis tilt in dB/octave; 0, undefined, or null disables it. */
  preEmphasis?: number | null
  /** Praat-style autoscaling: the white point is the loudest bin across the whole spectrogram. */
  autoGain?: boolean
  /** Overrides the autoGain transient-memory budget in bytes (used by tests). */
  autoGainBufferBudgetBytes?: number
  /** Audio sample rate in Hz. */
  sampleRate: number
}

/**
 * Computes the color-index spectrogram grid for one or more audio channels.
 *
 * `channels` should already contain exactly the channel data (and sample range, via
 * `Float32Array.subarray`) the caller wants analyzed - this function always walks each
 * channel from index 0 to its full length. It owns its FFT instance and all scratch
 * buffers for the duration of the call; nothing is cached or shared across calls.
 */
export function computeFrequencies(channels: Float32Array[], params: FrequencyParams): Uint8Array[][] {
  const {
    fftSamples,
    fftSize,
    windowFunc,
    alpha,
    noverlap,
    scale = 'mel',
    gainDB = 20,
    rangeDB = 80,
    preEmphasis,
    autoGain,
    autoGainBufferBudgetBytes,
    sampleRate,
  } = params

  const fftLength = fftSize ?? fftSamples

  // Fresh FFT instance per call (no module-global mutable state); the window covers
  // fftSamples samples, zero-padded up to fftLength. Alpha passes through untouched so
  // FFT's per-window defaults and the explicit blackman alpha: 0 semantics match.
  const fft = new (FFT as any)(fftLength, sampleRate, windowFunc, alpha, fftSamples)

  // Create filter bank based on scale using the centralized function
  const numFilters = fftLength / 2
  const filterBank = createSparseFilterBankForScale(scale, numFilters, fftLength, sampleRate)

  // Calculate hop size; integer arithmetic so non-power-of-two windows cannot produce
  // fractional frame starts
  let actualNoverlap = noverlap || Math.max(0, Math.round(fftSamples * 0.5))
  const maxOverlap = Math.floor(fftSamples / 2)
  actualNoverlap = Math.min(actualNoverlap, maxOverlap)
  const minHopSize = Math.max(64, Math.ceil(fftSamples * 0.25))
  const hopSize = Math.max(minHopSize, fftSamples - actualNoverlap)

  const frequencies: Uint8Array[][] = []

  // One reused frame buffer; the zero tail beyond fftSamples doubles as the FFT padding
  const frame = new Float32Array(fftLength)

  // Optional Praat display pre-emphasis, precomputed per output row
  const tilt = preEmphasis
    ? createPreEmphasisTilt(preEmphasis, getBinFrequencies(filterBank, fftLength, sampleRate))
    : null

  const computeSpectrum = (channelData: Float32Array, sample: number): Float32Array => {
    frame.set(channelData.subarray(sample, sample + fftSamples))
    let spectrum = fft.calculateSpectrum(frame)

    // Apply filter bank if specified
    if (filterBank) {
      spectrum = applySparseFilterBank(spectrum, filterBank)
    }
    return spectrum
  }

  if (!autoGain) {
    for (let c = 0; c < channels.length; c++) {
      const channelData = channels[c]
      const channelFreq: Uint8Array[] = []

      for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
        // Convert to uint8 color indices
        channelFreq.push(magnitudesToColorIndices(computeSpectrum(channelData, sample), -gainDB, rangeDB, tilt))
      }
      frequencies.push(channelFreq)
    }
    return frequencies
  }

  // autoGain (Praat-style autoscaling): the white point is the loudest bin of the whole
  // spectrogram, found after pre-emphasis, shared across channels. Two strategies bound the
  // transient memory: below the budget the dB frames are kept between the two passes; above
  // it only the maximum is tracked and the spectra are recomputed for quantization.
  const bins = fftLength / 2
  let frameCount = 0
  for (const channelData of channels) {
    const span = channelData.length
    frameCount = Math.max(frameCount, span > fftSamples ? Math.floor((span - fftSamples - 1) / hopSize) + 1 : 0)
  }
  const estimatedBytes = frameCount * bins * 4 * channels.length
  const budgetBytes = autoGainBufferBudgetBytes ?? AUTO_GAIN_BUFFER_BUDGET_BYTES
  let maxDb = -Infinity

  if (estimatedBytes < budgetBytes) {
    const dbFrames: Float32Array[][] = []
    for (let c = 0; c < channels.length; c++) {
      const channelData = channels[c]
      const channelDb: Float32Array[] = []
      for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
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

  // Over budget: pass 1 tracks only the maximum with one reused dB frame
  const dbScratch = new Float32Array(bins)
  for (let c = 0; c < channels.length; c++) {
    const channelData = channels[c]
    for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
      const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt, dbScratch)
      for (let i = 0; i < db.length; i++) {
        if (db[i] > maxDb) maxDb = db[i]
      }
    }
  }
  const silent = maxDb < SILENCE_FLOOR_DB
  for (let c = 0; c < channels.length; c++) {
    const channelData = channels[c]
    const channelFreq: Uint8Array[] = []
    for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
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
