/**
 * Web Worker for Windowed Spectrogram Plugin
 * Handles FFT calculations for frequency analysis
 */

// Import centralized FFT functionality
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

// Global FFT instance (reused for performance)
let fft: FFT | null = null

interface WorkerMessage {
  type: string
  id: string
  audioData: Float32Array[]
  options: {
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
    /** Internal: overrides the autoGain transient-memory budget (used by tests) */
    autoGainBufferBudgetBytes?: number
    splitChannels: boolean
  }
}

interface WorkerResponse {
  type: string
  id: string
  result?: Uint8Array[][]
  error?: string
}

// Worker message handler
self.onmessage = function (e: MessageEvent<WorkerMessage>) {
  const { type, id, audioData, options } = e.data

  if (type === 'calculateFrequencies') {
    try {
      const result = calculateFrequencies(audioData, options)
      const response: WorkerResponse = {
        type: 'frequenciesResult',
        id: id,
        result: result,
      }
      self.postMessage(response)
    } catch (error) {
      const response: WorkerResponse = {
        type: 'frequenciesResult',
        id: id,
        error: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(response)
    }
  }
}

/**
 * Calculate frequency data for audio channels
 */
function calculateFrequencies(audioChannels: Float32Array[], options: WorkerMessage['options']): Uint8Array[][] {
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

  // Initialize FFT (reuse if possible for performance); the window covers fftSamples samples,
  // zero-padded up to fftLength. Alpha passes through untouched so FFT's per-window defaults
  // and the explicit blackman alpha: 0 semantics match the main thread
  if (!fft || fft.bufferSize !== fftLength || fft.windowLength !== fftSamples) {
    fft = new (FFT as any)(fftLength, sampleRate, windowFunc, alpha, fftSamples)
  }

  // Create filter bank based on scale using centralized function
  const numFilters = fftLength / 2 // Same as main thread
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

  // Optional Praat display pre-emphasis, precomputed per output row (same as main thread)
  const tilt = preEmphasis
    ? createPreEmphasisTilt(preEmphasis, getBinFrequencies(filterBank, fftLength, sampleRate))
    : null

  const computeSpectrum = (channelData: Float32Array, sample: number): Float32Array => {
    frame.set(channelData.subarray(sample, sample + fftSamples))
    let spectrum = fft.calculateSpectrum(frame)

    // Apply filter bank if specified (same as main thread)
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
        // Convert to uint8 color indices
        channelFreq.push(magnitudesToColorIndices(computeSpectrum(channelData, sample), -gainDB, rangeDB, tilt))
      }
      frequencies.push(channelFreq)
    }
    return frequencies
  }

  // autoGain (Praat-style autoscaling): the white point is the loudest bin of the whole
  // spectrogram, found after pre-emphasis, shared across channels. Two strategies bound the
  // transient memory - see the main thread implementation for details.
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

  // Over budget: pass 1 tracks only the maximum with one reused dB frame
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
