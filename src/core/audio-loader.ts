/**
 * Pure audio loading functions
 *
 * These functions handle audio loading without side effects.
 * They return data that the shell (WaveSurfer) can use to update state.
 */

import { extractPeaks } from './audio-processing.js'

export interface AudioData {
  buffer: AudioBuffer
  peaks: Array<Float32Array>
  duration: number
  url: string
}

export interface AudioLoadOptions {
  url: string
  blob?: Blob
  peaks?: Array<Float32Array>
  duration?: number
  sampleRate: number
  numberOfSamples?: number
  mimeType?: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
  fetchParams?: RequestInit
}

/**
 * Fetch a blob with progress tracking
 * Pure function except for network I/O
 */
async function fetchWithProgress(
  url: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
  fetchParams?: RequestInit,
): Promise<Blob> {
  const response = await fetch(url, { ...fetchParams, signal })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    // If streaming not supported, fallback to blob
    return response.blob()
  }

  const contentLength = +(response.headers.get('Content-Length') ?? 0)

  let receivedLength = 0
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    chunks.push(value)
    receivedLength += value.length

    if (contentLength && onProgress) {
      onProgress((receivedLength / contentLength) * 100)
    }
  }

  // Combine chunks into blob
  return new Blob(chunks as BlobPart[])
}

/**
 * Decode audio data to AudioBuffer
 * Pure function except for AudioContext usage
 */
async function decodeAudioData(arrayBuffer: ArrayBuffer, sampleRate: number): Promise<AudioBuffer> {
  const audioCtx = new AudioContext({ sampleRate })
  try {
    return await audioCtx.decodeAudioData(arrayBuffer)
  } finally {
    audioCtx.close()
  }
}

/**
 * Create a mock AudioBuffer from pre-decoded peaks
 * Pure function - creates buffer without decoding
 */
function createBufferFromPeaks(peaks: Array<Float32Array>, duration: number, sampleRate: number): AudioBuffer {
  const numberOfChannels = peaks.length
  const length = Math.floor(duration * sampleRate)

  const audioCtx = new AudioContext({ sampleRate })
  const buffer = audioCtx.createBuffer(numberOfChannels, length, sampleRate)

  // Fill buffer with expanded peak data
  for (let i = 0; i < numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i)
    const channelPeaks = peaks[i]
    const samplesPerPeak = Math.floor(length / channelPeaks.length)

    for (let j = 0; j < channelPeaks.length; j++) {
      const start = j * samplesPerPeak
      const end = Math.min(start + samplesPerPeak, length)
      const peak = channelPeaks[j]

      for (let k = start; k < end; k++) {
        channelData[k] = peak
      }
    }
  }

  audioCtx.close()
  return buffer
}

/**
 * Load and decode audio from various sources
 * Pure async function - returns data without mutating external state
 *
 * @param options - Audio loading options
 * @returns Audio data ready for rendering
 *
 * @example
 * ```typescript
 * const audioData = await loadAudio({
 *   url: '/audio.mp3',
 *   sampleRate: 8000,
 *   numberOfSamples: 1000,
 *   onProgress: (percent) => console.log(`Loading: ${percent}%`)
 * })
 * // audioData contains { buffer, peaks, duration, url }
 * ```
 */
export async function loadAudio(options: AudioLoadOptions): Promise<AudioData> {
  const { url, sampleRate, numberOfSamples = 1000 } = options
  let { blob, peaks } = options
  const { duration } = options

  // If we have pre-decoded peaks and duration, create buffer from them
  if (peaks && duration) {
    const buffer = createBufferFromPeaks(peaks, duration, sampleRate)
    return {
      buffer,
      peaks,
      duration,
      url,
    }
  }

  // Fetch blob if needed
  if (!blob) {
    blob = await fetchWithProgress(url, options.onProgress, options.signal, options.fetchParams)
  }

  // Override MIME type if provided
  if (options.mimeType) {
    blob = new Blob([blob], { type: options.mimeType })
  }

  // Decode audio
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = await decodeAudioData(arrayBuffer, sampleRate)

  // Extract peaks
  peaks = extractPeaks(buffer, numberOfSamples)

  return {
    buffer,
    peaks,
    duration: buffer.duration,
    url,
  }
}

/**
 * Load audio from a media element
 * Pure function - extracts data without side effects
 *
 * @param media - Media element with loaded audio
 * @param sampleRate - Target sample rate
 * @param numberOfSamples - Number of peak samples to extract
 * @returns Audio data ready for rendering
 */
export async function loadAudioFromMediaElement(
  media: HTMLMediaElement,
  sampleRate: number,
  numberOfSamples: number = 1000,
): Promise<AudioData> {
  // This requires getting the audio buffer from the media element
  // which typically requires Web Audio API MediaElementSource
  // For now, we'll return a placeholder that indicates we should use
  // the media element directly without decoding

  const duration = media.duration
  const url = media.currentSrc || media.src

  // Create empty peaks as placeholder
  const numberOfChannels = 2 // Assume stereo
  const peaks: Float32Array[] = []
  for (let i = 0; i < numberOfChannels; i++) {
    peaks.push(new Float32Array(numberOfSamples))
  }

  // Create a mock buffer
  const buffer = createBufferFromPeaks(peaks, duration, sampleRate)

  return {
    buffer,
    peaks,
    duration,
    url,
  }
}
