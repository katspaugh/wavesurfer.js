/**
 * Web Worker for Windowed Spectrogram Plugin
 * Handles FFT calculations for frequency analysis
 */

// Import centralized FFT functionality
import FFT, { createSparseFilterBankForScale, applySparseFilterBank } from '../fft.js'

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
    splitChannels,
  } = options

  const startSample = Math.floor(startTime * sampleRate)
  const endSample = Math.floor(endTime * sampleRate)
  const channels = splitChannels ? audioChannels.length : 1
  const fftLength = fftSize ?? fftSamples

  // Initialize FFT (reuse if possible for performance); the window covers fftSamples samples,
  // zero-padded up to fftLength
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

  for (let c = 0; c < channels; c++) {
    const channelData = audioChannels[c]
    const channelFreq: Uint8Array[] = []

    for (let sample = startSample; sample + fftSamples < endSample; sample += hopSize) {
      frame.set(channelData.subarray(sample, sample + fftSamples))
      let spectrum = fft.calculateSpectrum(frame)

      // Apply filter bank if specified (same as main thread)
      if (filterBank) {
        spectrum = applySparseFilterBank(spectrum, filterBank)
      }

      // Convert to uint8 color indices
      const freqBins = new Uint8Array(spectrum.length)
      const gainPlusRange = gainDB + rangeDB

      for (let j = 0; j < spectrum.length; j++) {
        const magnitude = spectrum[j] > 1e-12 ? spectrum[j] : 1e-12
        const valueDB = 20 * Math.log10(magnitude)

        if (valueDB < -gainPlusRange) {
          freqBins[j] = 0
        } else if (valueDB > -gainDB) {
          freqBins[j] = 255
        } else {
          freqBins[j] = Math.round(((valueDB + gainDB) / rangeDB) * 255)
        }
      }
      channelFreq.push(freqBins)
    }
    frequencies.push(channelFreq)
  }

  return frequencies
}
