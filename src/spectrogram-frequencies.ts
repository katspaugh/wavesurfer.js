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
 * Pure with respect to output: every scratch buffer (frame, dB scratch) is owned by a
 * single call, so concurrent callers never share mutable state that could change what a
 * call returns. The one exception is a small, correctly-keyed FFT instance cache (see
 * `getOrCreateFFT` below) - that state is a pure performance optimization and cannot
 * itself change a call's output, unlike the worker's old unkeyed `let fft` global, which
 * could silently reuse a stale instance if params changed shape without also changing
 * `bufferSize`/`windowLength`.
 */

import FFT from './fft.js'
import {
  createSparseFilterBankForScale,
  applySparseFilterBank,
  magnitudesToColorIndices,
  magnitudesToDb,
  dbToColorIndices,
  createPreEmphasisTilt,
  getBinFrequencies,
  SILENCE_FLOOR_DB,
  AUTO_GAIN_BUFFER_BUDGET_BYTES,
} from './spectrogram-render-utils.js'

/**
 * Bounded, keyed cache of FFT instances, reused across `computeFrequencies` calls.
 *
 * Why this is safe: `FFT.calculateSpectrum` allocates fresh `real`/`imag`/`spectrum`
 * buffers on every call and never reads a previous call's output back in - the only
 * fields it mutates on `this` (`peak`/`peakBand`) are write-only running-max bookkeeping
 * that nothing in this module (or the wider codebase) reads. So two calls through the
 * same FFT instance with the same params are deterministic and independent; only the
 * expensive one-time setup (window/sin/cos/bit-reversal tables) is being reused.
 *
 * Why it's keyed: every argument that affects the precomputed tables (bufferSize,
 * sampleRate, windowFunc, alpha, windowLength) is part of the key, so two calls that
 * differ in any of them always get distinct instances - this is what makes the cache
 * safe in a way the worker's old unkeyed `let fft` (matched only on bufferSize/
 * windowLength) was not: that global could reuse a stale instance built with a
 * different windowFunc/alpha/sampleRate if a caller changed those without also
 * changing the size.
 *
 * Capped at a handful of entries with FIFO eviction (oldest insertion dropped first) -
 * plugins only cycle through a small number of distinct FFT configurations (typically
 * one, occasionally two during a live option change), so this bounds memory without
 * needing real LRU bookkeeping.
 */
const FFT_CACHE_MAX_ENTRIES = 4
const fftCache = new Map<string, FFT>()
// Test-only: total FFT instances constructed since the process started (or since the
// last __resetFFTCacheForTests() call). Never read by production code.
let fftConstructionCount = 0

function fftCacheKey(
  fftLength: number,
  sampleRate: number,
  windowFunc: string | undefined,
  alpha: number | undefined,
  windowLength: number,
): string {
  return `${fftLength}|${sampleRate}|${windowFunc}|${alpha}|${windowLength}`
}

function getOrCreateFFT(
  fftLength: number,
  sampleRate: number,
  windowFunc: string | undefined,
  alpha: number | undefined,
  windowLength: number,
): FFT {
  const key = fftCacheKey(fftLength, sampleRate, windowFunc, alpha, windowLength)
  const cached = fftCache.get(key)
  if (cached) return cached

  // `fft.ts` is `@ts-nocheck` (its runtime `FFT` is a plain constructor function, untyped) with a
  // separate `declare class FFT` bolted on purely for callers' benefit - that declared class has
  // no usable construct signature TS can see through from here, so `new FFT(...)` doesn't
  // type-check as-is. Cast to `any` just to invoke the constructor; the function's own `: FFT`
  // return annotation immediately re-establishes the declared type for everything downstream.
  const fft = new (FFT as any)(fftLength, sampleRate, windowFunc, alpha, windowLength)
  fftConstructionCount++

  if (fftCache.size >= FFT_CACHE_MAX_ENTRIES) {
    // Map iteration order is insertion order, so the first key is the oldest entry
    const oldestKey = fftCache.keys().next().value
    if (oldestKey !== undefined) fftCache.delete(oldestKey)
  }
  fftCache.set(key, fft)
  return fft
}

/**
 * Test-only introspection into the FFT cache; not part of the public contract.
 * @internal
 */
export function __getFFTCacheStatsForTests(): { size: number; constructions: number } {
  return { size: fftCache.size, constructions: fftConstructionCount }
}

/**
 * Test-only: clears the FFT cache and resets the construction counter.
 * @internal
 */
export function __resetFFTCacheForTests(): void {
  fftCache.clear()
  fftConstructionCount = 0
}

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
   * Frame overlap in samples, honored up to fftSamples - 1 (the hop size always stays >= 1
   * sample, so values >= fftSamples are clamped to fftSamples - 1). A falsy value (0, null, or
   * undefined) falls back to round(fftSamples * 0.5) - this mirrors the worker's original
   * behavior, where an explicit 0 is indistinguishable from "not set".
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
 * channel from index 0 to its full length. All scratch buffers (the analysis frame, the
 * autoGain dB scratch) are owned by a single call and never shared; the only thing shared
 * across calls is the bounded, correctly-keyed FFT instance cache described above
 * `getOrCreateFFT`, which cannot change a call's output.
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

  // FFT instance from the bounded, keyed cache (see getOrCreateFFT above) - the window
  // covers fftSamples samples, zero-padded up to fftLength. Alpha passes through
  // untouched so FFT's per-window defaults and the explicit blackman alpha: 0 semantics
  // match.
  const fft = getOrCreateFFT(fftLength, sampleRate, windowFunc, alpha, fftSamples)

  // Create filter bank based on scale using the centralized function
  const numFilters = fftLength / 2
  const filterBank = createSparseFilterBankForScale(scale, numFilters, fftLength, sampleRate)

  // Calculate hop size; integer arithmetic so non-power-of-two windows cannot produce
  // fractional frame starts. noverlap is honored as documented ("must be < fftSamples"):
  // the only clamp is to fftSamples - 1, keeping the hop at >= 1 sample so the frame loop
  // always advances. (The historical silent 50% cap and 64-sample hop floor contradicted
  // that contract, quietly halving the requested overlap.)
  let actualNoverlap = noverlap || Math.max(0, Math.round(fftSamples * 0.5))
  actualNoverlap = Math.min(actualNoverlap, fftSamples - 1)
  const hopSize = Math.max(1, fftSamples - actualNoverlap)

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
  // Callers are expected to pass equal-length channels (all sliced from one buffer, as
  // every current caller does) - frameCount is taken as the max across channels so a
  // ragged input still produces a safe (not undersized) memory-budget estimate, but the
  // per-channel frame loops below still stop at each channel's own length.
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
