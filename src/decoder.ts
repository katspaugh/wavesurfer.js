/** Decode an array buffer into an audio buffer */
async function decode(audioData: ArrayBuffer, sampleRate: number): Promise<AudioBuffer> {
  const audioCtx = new AudioContext({ sampleRate })
  try {
    return await audioCtx.decodeAudioData(audioData)
  } finally {
    // Ensure AudioContext is always closed, even on synchronous errors
    if (audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => undefined)
    }
  }
}

/**
 * Normalize peaks to -1..1.
 * Decides from and scales by the GLOBAL max across all channels (scaling by
 * channel 0's max alone could leave other channels outside -1..1), and never
 * mutates the caller-owned input arrays: when scaling is needed, scaled copies
 * are returned instead.
 */
function normalize(channelData: Array<Float32Array | number[]>): Array<Float32Array | number[]> {
  let max = 0
  for (const channel of channelData) {
    for (let i = 0; i < channel.length; i++) {
      const absN = Math.abs(channel[i])
      if (absN > max) max = absN
    }
  }
  if (max <= 1) return channelData

  return channelData.map((channel) => {
    const scaled = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      scaled[i] = channel[i] / max
    }
    return scaled
  })
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

  // Normalize to -1..1 (returns scaled copies when scaling is needed --
  // the caller-owned arrays are never mutated)
  const normalizedChannels = normalize(channelData)

  // Convert to Float32Array for consistency
  const float32Channels = normalizedChannels.map((channel) =>
    channel instanceof Float32Array ? channel : Float32Array.from(channel),
  )

  const getChannelData = (i: number) => {
    const channel = float32Channels[i]
    if (!channel) {
      throw new Error(`Channel ${i} not found`)
    }
    return channel
  }

  return {
    duration,
    length: float32Channels[0].length,
    sampleRate: float32Channels[0].length / duration,
    numberOfChannels: float32Channels.length,
    getChannelData,
    // Real implementations per AudioBuffer semantics (the previous borrowed
    // AudioBuffer.prototype methods threw "Illegal invocation" on this plain
    // object): copy min(available, requested) frames, honoring the offset.
    copyFromChannel: (destination: Float32Array, channelNumber: number, bufferOffset = 0) => {
      const channel = getChannelData(channelNumber)
      const start = Math.max(0, bufferOffset)
      const frameCount = Math.max(0, Math.min(destination.length, channel.length - start))
      destination.set(channel.subarray(start, start + frameCount))
    },
    copyToChannel: (source: Float32Array, channelNumber: number, bufferOffset = 0) => {
      const channel = getChannelData(channelNumber)
      const start = Math.max(0, bufferOffset)
      const frameCount = Math.max(0, Math.min(source.length, channel.length - start))
      channel.set(source.subarray(0, frameCount), start)
    },
  } as AudioBuffer
}

const Decoder = {
  decode,
  createBuffer,
}

export default Decoder
