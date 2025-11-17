/**
 * Pure audio processing functions
 *
 * These functions are pure: they have no side effects and always return
 * the same output for the same input. They can be easily tested and
 * used in Web Workers.
 */

// ============================================================================
// Peak Extraction
// ============================================================================

/**
 * Find the maximum absolute value in a sample array
 * Pure function - no side effects
 */
function findPeak(samples: Float32Array): number {
  let max = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i])
    if (abs > max) max = abs
  }
  return max
}

/**
 * Extract peak values from a single channel
 * Pure function - no side effects
 */
function extractChannelPeaks(channelData: Float32Array, numberOfSamples: number): Float32Array {
  const peaks = new Float32Array(numberOfSamples)
  const blockSize = Math.floor(channelData.length / numberOfSamples)

  if (blockSize === 0) {
    // If we have more samples requested than data points, just copy what we have
    for (let i = 0; i < Math.min(numberOfSamples, channelData.length); i++) {
      peaks[i] = Math.abs(channelData[i])
    }
    return peaks
  }

  for (let i = 0; i < numberOfSamples; i++) {
    const start = i * blockSize
    const end = start + blockSize
    peaks[i] = findPeak(channelData.subarray(start, end))
  }

  return peaks
}

/**
 * Extract peak values from an audio buffer
 * Pure function - no side effects
 *
 * @param buffer - Audio buffer to extract peaks from
 * @param numberOfSamples - Number of peak samples to extract per channel
 * @returns Array of peak arrays, one per channel
 */
export function extractPeaks(buffer: AudioBuffer, numberOfSamples: number): Float32Array[] {
  const channels: Float32Array[] = []
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(extractChannelPeaks(buffer.getChannelData(i), numberOfSamples))
  }
  return channels
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Find the maximum absolute value across all channels
 * Pure function - no side effects
 */
function findMaxPeak(peaks: Float32Array[]): number {
  let max = 0
  for (const channel of peaks) {
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i])
      if (abs > max) max = abs
    }
  }
  return max
}

/**
 * Normalize peak values to a maximum of 1.0
 * Pure function - no side effects
 *
 * @param peaks - Array of peak arrays to normalize
 * @param maxPeak - Optional maximum peak value to normalize to (defaults to actual max)
 * @returns New normalized peak arrays (does not mutate input)
 */
export function normalizeAudioData(peaks: Float32Array[], maxPeak?: number): Float32Array[] {
  const actualMax = maxPeak ?? findMaxPeak(peaks)
  if (actualMax === 0) return peaks

  return peaks.map((channel) => {
    const normalized = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      normalized[i] = channel[i] / actualMax
    }
    return normalized
  })
}

// ============================================================================
// Waveform Point Calculation
// ============================================================================

export interface WaveformPoint {
  x: number
  y: number
  height: number
}

export interface WaveformPointOptions {
  barWidth?: number
  barGap?: number
  barAlign?: 'top' | 'bottom'
  vScale?: number
}

/**
 * Calculate waveform render points from peak data
 * Pure function - no side effects
 *
 * @param peaks - Peak values for a single channel
 * @param width - Width of the waveform in pixels
 * @param height - Height of the waveform in pixels
 * @param options - Rendering options
 * @returns Array of points to render
 */
export function calculateWaveformPoints(
  peaks: Float32Array,
  width: number,
  height: number,
  options: WaveformPointOptions = {},
): WaveformPoint[] {
  const { barWidth, barGap = 0, barAlign, vScale = 1 } = options
  const points: WaveformPoint[] = []

  if (barWidth) {
    // Bar rendering mode
    const barSpacing = barWidth + barGap
    const numberOfBars = Math.floor(width / barSpacing)
    const halfHeight = height / 2

    for (let i = 0; i < numberOfBars && i < peaks.length; i++) {
      const peak = peaks[i] * vScale
      const barHeight = peak * height

      let y: number
      if (barAlign === 'top') {
        y = 0
      } else if (barAlign === 'bottom') {
        y = height - barHeight
      } else {
        // Center alignment
        y = halfHeight - barHeight / 2
      }

      points.push({
        x: i * barSpacing,
        y,
        height: barHeight,
      })
    }
  } else {
    // Line rendering mode
    const halfHeight = height / 2
    const samplesPerPixel = peaks.length / width

    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel)
      const peak = peaks[sampleIndex] * vScale
      const barHeight = peak * height

      points.push({
        x,
        y: halfHeight - barHeight / 2,
        height: barHeight,
      })
    }
  }

  return points
}

// ============================================================================
// Multi-Channel Data
// ============================================================================

export interface ChannelRenderData {
  peaks: Float32Array
  color: string
  height: number
  offset: number
}

export interface SplitChannelOptions {
  totalHeight: number
  defaultColor: string
  channelColors?: string[]
  overlay?: boolean
}

/**
 * Calculate channel offsets for multi-channel rendering
 * Pure function - no side effects
 */
function calculateChannelOffset(channelIndex: number, numberOfChannels: number, totalHeight: number): number {
  const channelHeight = totalHeight / numberOfChannels
  return channelIndex * channelHeight
}

/**
 * Calculate channel height for multi-channel rendering
 * Pure function - no side effects
 */
function calculateChannelHeight(numberOfChannels: number, totalHeight: number): number {
  return totalHeight / numberOfChannels
}

/**
 * Split audio buffer data into channel render data
 * Pure function - no side effects
 *
 * @param buffer - Audio buffer with channel data
 * @param options - Rendering options
 * @returns Array of channel render data
 */
export function splitChannelData(buffer: AudioBuffer, options: SplitChannelOptions): ChannelRenderData[] {
  const { totalHeight, defaultColor, channelColors, overlay } = options
  const numberOfChannels = buffer.numberOfChannels
  const channelHeight = calculateChannelHeight(numberOfChannels, totalHeight)

  const channels: ChannelRenderData[] = []

  for (let i = 0; i < numberOfChannels; i++) {
    const peaks = buffer.getChannelData(i)
    const color = channelColors?.[i] || defaultColor
    const offset = overlay ? 0 : calculateChannelOffset(i, numberOfChannels, totalHeight)

    channels.push({
      peaks,
      color,
      height: channelHeight,
      offset,
    })
  }

  return channels
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract channel data from an AudioBuffer as Float32Arrays
 * Pure function - no side effects
 */
export function extractChannelData(audioBuffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = []
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i))
  }
  return channels
}

/**
 * Find the maximum absolute value in channel data
 * Pure function - no side effects
 */
export function findMaxAmplitude(channelData: Array<Float32Array | number[]>): number {
  const firstChannel = channelData[0]
  if (!firstChannel) return 0

  let max = 0
  const length = firstChannel.length
  for (let i = 0; i < length; i++) {
    const absN = Math.abs(firstChannel[i])
    if (absN > max) max = absN
  }
  return max
}

/**
 * Check if channel data needs normalization (values outside -1..1)
 * Pure function - no side effects
 */
export function needsNormalization(channelData: Array<Float32Array | number[]>): boolean {
  const firstChannel = channelData[0]
  if (!firstChannel) return false
  return firstChannel.some((n) => n > 1 || n < -1)
}

/**
 * Normalize channel data to -1..1 range
 * Pure function - returns new normalized data without mutating input
 */
export function normalizeChannelData(channelData: Array<Float32Array | number[]>): Array<Float32Array | number[]> {
  if (!needsNormalization(channelData)) {
    return channelData
  }

  const max = findMaxAmplitude(channelData)
  if (max === 0) return channelData

  return channelData.map((channel) => {
    const normalized = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      normalized[i] = channel[i] / max
    }
    return normalized
  })
}
