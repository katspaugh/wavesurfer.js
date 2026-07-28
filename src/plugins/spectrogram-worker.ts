/**
 * Web Worker for Windowed Spectrogram Plugin
 * Handles FFT calculations for frequency analysis
 */

// The actual FFT/filter-bank/autoGain loop lives in the shared, pure computeFrequencies
// module so it can't drift from the main-thread copies; this file only adapts the worker
// message protocol (startTime/endTime/splitChannels) to that module's params shape.
import { computeFrequencies } from '../spectrogram-frequencies.js'

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
 * Calculate frequency data for audio channels.
 *
 * This adapts the worker's message protocol (a time range plus a splitChannels flag over
 * the full-length channel buffers) to the shared computeFrequencies module's contract,
 * which expects each channel already sliced to the exact sample range to analyze. The
 * slicing below is via subarray - a zero-copy view - so it changes neither the values
 * seen by the FFT nor the frame count.
 */
function calculateFrequencies(audioChannels: Float32Array[], options: WorkerMessage['options']): Uint8Array[][] {
  const { startTime, endTime, sampleRate, splitChannels } = options

  const startSample = Math.floor(startTime * sampleRate)
  const endSample = Math.floor(endTime * sampleRate)
  const channelCount = splitChannels ? audioChannels.length : 1
  const channels: Float32Array[] = []
  for (let c = 0; c < channelCount; c++) {
    channels.push(audioChannels[c].subarray(startSample, endSample))
  }

  return computeFrequencies(channels, {
    fftSamples: options.fftSamples,
    fftSize: options.fftSize,
    windowFunc: options.windowFunc,
    alpha: options.alpha,
    noverlap: options.noverlap,
    scale: options.scale,
    gainDB: options.gainDB,
    rangeDB: options.rangeDB,
    preEmphasis: options.preEmphasis,
    autoGain: options.autoGain,
    autoGainBufferBudgetBytes: options.autoGainBufferBudgetBytes,
    sampleRate,
  })
}
