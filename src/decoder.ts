import { needsNormalization, findMaxAmplitude } from './core/audio-processing.js'

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

/** Normalize peaks to -1..1 (mutates input for backwards compatibility) */
function normalize<T extends Array<Float32Array | number[]>>(channelData: T): T {
  if (!needsNormalization(channelData)) {
    return channelData
  }

  const max = findMaxAmplitude(channelData)
  if (max === 0) return channelData

  // Mutate channels in place for backwards compatibility
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
