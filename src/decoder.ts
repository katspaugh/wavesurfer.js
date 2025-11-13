// ============================================================================
// Pure Functions - Audio Data Processing
// ============================================================================
// These functions are pure: given the same input, they always return the same
// output without side effects. They can be easily tested and run in workers.

/**
 * Extract channel data from an AudioBuffer
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
 * Check if channel data needs normalization
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

// ============================================================================
// Side-Effecting Functions - Audio Context Operations
// ============================================================================
// These functions have side effects (create AudioContext, mutate data).
// They use the pure functions above for data processing.

/** Decode an array buffer into an audio buffer */
async function decode(audioData: ArrayBuffer, sampleRate: number): Promise<AudioBuffer> {
  const audioCtx = new AudioContext({ sampleRate })
  try {
    return await audioCtx.decodeAudioData(audioData)
  } finally {
    // Ensure AudioContext is always closed, even on synchronous errors
    audioCtx.close()
  }
}

/**
 * Normalize peaks to -1..1 (mutates in place for backward compatibility)
 * @deprecated Use normalizeChannelData() for pure function version
 */
function normalize<T extends Array<Float32Array | number[]>>(channelData: T): T {
  if (!needsNormalization(channelData)) {
    return channelData
  }

  const max = findMaxAmplitude(channelData)
  if (max === 0) return channelData

  for (const channel of channelData) {
    for (let i = 0; i < channel.length; i++) {
      channel[i] /= max
    }
  }
  return channelData
}

/** Create an audio buffer from pre-decoded audio data */
function createBuffer(channelData: Array<Float32Array | number[]>, duration: number): AudioBuffer {
  // Validate inputs
  if (!channelData || channelData.length === 0) {
    throw new Error('channelData must be a non-empty array')
  }
  if (duration <= 0) {
    throw new Error('duration must be greater than 0')
  }

  // If a single array of numbers is passed, make it an array of arrays
  if (typeof channelData[0] === 'number') channelData = [channelData as unknown as number[]]

  // Validate channel data after conversion
  if (!channelData[0] || channelData[0].length === 0) {
    throw new Error('channelData must contain non-empty channel arrays')
  }

  // Normalize to -1..1
  normalize(channelData)

  // Convert to Float32Array for consistency
  const float32Channels = channelData.map((channel) =>
    channel instanceof Float32Array ? channel : Float32Array.from(channel),
  )

  return {
    duration,
    length: float32Channels[0].length,
    sampleRate: float32Channels[0].length / duration,
    numberOfChannels: float32Channels.length,
    getChannelData: (i: number) => {
      const channel = float32Channels[i]
      if (!channel) {
        throw new Error(`Channel ${i} not found`)
      }
      return channel
    },
    copyFromChannel: AudioBuffer.prototype.copyFromChannel,
    copyToChannel: AudioBuffer.prototype.copyToChannel,
  } as AudioBuffer
}

const Decoder = {
  decode,
  createBuffer,
}

export default Decoder
