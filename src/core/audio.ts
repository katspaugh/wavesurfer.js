/**
 * Pure functions for audio data processing
 * All functions are pure - no side effects, deterministic output
 */

/**
 * Extract peaks from AudioBuffer channel data
 */
export function extractPeaks(params: {
  channelData: Float32Array
  maxLength: number
  precision?: number
}): number[] {
  const { channelData, maxLength, precision = 10_000 } = params

  const peaks: number[] = []
  const sampleSize = channelData.length / maxLength

  for (let i = 0; i < maxLength; i++) {
    const start = Math.floor(i * sampleSize)
    const end = Math.ceil((i + 1) * sampleSize)
    const slice = channelData.slice(start, end)

    let max = 0
    for (let j = 0; j < slice.length; j++) {
      const value = Math.abs(slice[j])
      if (value > Math.abs(max)) {
        max = slice[j]
      }
    }

    peaks.push(Math.round(max * precision) / precision)
  }

  return peaks
}

/**
 * Normalize channel data to [-1, 1] range
 */
export function normalizeChannelData<T extends Array<Float32Array | number[]>>(
  channelData: T
): T {
  const firstChannel = channelData[0]
  if (!firstChannel || firstChannel.length === 0) return channelData

  // Check if normalization is needed
  const needsNormalization = firstChannel.some((n) => Math.abs(n) > 1)
  if (!needsNormalization) return channelData

  // Find the maximum absolute value across all samples
  const length = firstChannel.length
  let max = 0
  for (let i = 0; i < length; i++) {
    const absValue = Math.abs(firstChannel[i])
    if (absValue > max) max = absValue
  }

  if (max === 0) return channelData

  // Normalize all channels
  const normalized = channelData.map((channel) => {
    if (channel instanceof Float32Array) {
      const normalizedChannel = new Float32Array(channel.length)
      for (let i = 0; i < channel.length; i++) {
        normalizedChannel[i] = channel[i] / max
      }
      return normalizedChannel
    } else {
      return channel.map((value) => value / max)
    }
  }) as T

  return normalized
}

/**
 * Calculate the maximum absolute value in a channel
 */
export function getChannelMax(channelData: Float32Array | number[]): number {
  let max = 0
  for (let i = 0; i < channelData.length; i++) {
    const absValue = Math.abs(channelData[i])
    if (absValue > max) max = absValue
  }
  return max
}

/**
 * Resample channel data to a different length
 */
export function resampleChannelData(
  channelData: Float32Array | number[],
  targetLength: number
): number[] {
  if (channelData.length === targetLength) {
    return Array.from(channelData)
  }

  const result: number[] = []
  const ratio = channelData.length / targetLength

  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.ceil((i + 1) * ratio)

    // Get the maximum absolute value in this range
    let max = 0
    let maxValue = 0
    for (let j = start; j < end && j < channelData.length; j++) {
      const value = channelData[j]
      const absValue = Math.abs(value)
      if (absValue > max) {
        max = absValue
        maxValue = value
      }
    }

    result.push(maxValue)
  }

  return result
}

/**
 * Merge multiple channel data arrays into stereo (2 channels max)
 */
export function mergeToStereo(channels: Array<Float32Array | number[]>): [Float32Array, Float32Array] {
  if (channels.length === 0) {
    return [new Float32Array(0), new Float32Array(0)]
  }

  const left = channels[0]
  const right = channels[1] ?? channels[0]

  return [
    left instanceof Float32Array ? left : Float32Array.from(left),
    right instanceof Float32Array ? right : Float32Array.from(right),
  ]
}

/**
 * Calculate RMS (Root Mean Square) for a channel segment
 */
export function calculateRMS(channelData: Float32Array | number[], start: number, end: number): number {
  let sum = 0
  const length = Math.min(end, channelData.length) - start

  for (let i = start; i < end && i < channelData.length; i++) {
    sum += channelData[i] * channelData[i]
  }

  return Math.sqrt(sum / length)
}

/**
 * Check if audio data contains actual audio (not silence)
 */
export function hasAudioData(channelData: Float32Array | number[], threshold: number = 0.001): boolean {
  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]) > threshold) {
      return true
    }
  }
  return false
}

/**
 * Convert decibels to linear gain
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * Convert linear gain to decibels
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 0.000001))
}
