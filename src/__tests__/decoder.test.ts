import Decoder from '../decoder.js'

describe('Decoder', () => {
  const originalAudioContext = global.AudioContext
  const audioBuffer = {} as AudioBuffer
  const decodeAudioData = jest.fn()
  const close = jest.fn()
  let state: AudioContextState

  beforeEach(() => {
    state = 'running'
    decodeAudioData.mockReset().mockResolvedValue(audioBuffer)
    close.mockReset().mockResolvedValue(undefined)

    global.AudioContext = jest.fn().mockImplementation(() => ({
      decodeAudioData,
      close,
      get state() {
        return state
      },
    }))
  })

  afterAll(() => {
    global.AudioContext = originalAudioContext
  })

  test('closes an active AudioContext after decoding', async () => {
    const result = await Decoder.decode(new ArrayBuffer(0), 8_000)

    expect(result).toBe(audioBuffer)
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('does not close an AudioContext that is already closed', async () => {
    state = 'closed'

    await expect(Decoder.decode(new ArrayBuffer(0), 8_000)).resolves.toBe(audioBuffer)
    expect(close).not.toHaveBeenCalled()
  })

  describe('createBuffer normalization', () => {
    test('normalizes all channels by the global max across channels, not channel 0 alone', () => {
      const buffer = Decoder.createBuffer(
        [
          [1, 2],
          [4, -1],
        ],
        2,
      )

      // Global max is 4 (in channel 1); scaling by channel 0's max (2) would
      // leave channel 1 outside -1..1.
      expect(Array.from(buffer.getChannelData(0))).toEqual([0.25, 0.5])
      expect(Array.from(buffer.getChannelData(1))).toEqual([1, -0.25])
    })

    test('normalizes when only a non-first channel exceeds -1..1', () => {
      const buffer = Decoder.createBuffer(
        [
          [0.5, -0.5],
          [2, 1],
        ],
        2,
      )

      // Channel 0 is within range; deciding from channel 0 alone would skip
      // normalization entirely and leave channel 1 out of range.
      expect(Array.from(buffer.getChannelData(0))).toEqual([0.25, -0.25])
      expect(Array.from(buffer.getChannelData(1))).toEqual([1, 0.5])
    })

    test('does not mutate the caller-owned peaks arrays', () => {
      const channel0 = [1, 2]
      const channel1 = Float32Array.from([4, -1])

      Decoder.createBuffer([channel0, channel1], 2)

      expect(channel0).toEqual([1, 2])
      expect(Array.from(channel1)).toEqual([4, -1])
    })

    test('leaves data already within -1..1 unscaled', () => {
      const buffer = Decoder.createBuffer([[0.5, -1, 0.25]], 3)
      expect(Array.from(buffer.getChannelData(0))).toEqual([0.5, -1, 0.25])
    })
  })

  describe('createBuffer copyFromChannel/copyToChannel', () => {
    test('copyFromChannel copies channel data into the destination', () => {
      const buffer = Decoder.createBuffer([[0, 0.25, 0.5, 0.75]], 1)
      const destination = new Float32Array(4)

      buffer.copyFromChannel(destination, 0)

      expect(Array.from(destination)).toEqual([0, 0.25, 0.5, 0.75])
    })

    test('copyFromChannel respects bufferOffset and the shorter of the two lengths', () => {
      const buffer = Decoder.createBuffer([[0, 0.25, 0.5, 0.75]], 1)

      const short = new Float32Array(2)
      buffer.copyFromChannel(short, 0, 1)
      expect(Array.from(short)).toEqual([0.25, 0.5])

      const long = new Float32Array(4)
      buffer.copyFromChannel(long, 0, 2)
      // Only the two remaining frames are copied; the rest stays untouched
      expect(Array.from(long)).toEqual([0.5, 0.75, 0, 0])
    })

    test('copyToChannel writes the source into the channel at bufferOffset', () => {
      const buffer = Decoder.createBuffer([[0, 0, 0, 0]], 1)

      buffer.copyToChannel(Float32Array.from([0.25, 0.5]), 0, 1)

      expect(Array.from(buffer.getChannelData(0))).toEqual([0, 0.25, 0.5, 0])
    })

    test('copyToChannel truncates a source longer than the remaining channel space', () => {
      const buffer = Decoder.createBuffer([[0, 0, 0]], 1)

      buffer.copyToChannel(Float32Array.from([0.25, 0.5, 0.75]), 0, 2)

      expect(Array.from(buffer.getChannelData(0))).toEqual([0, 0, 0.25])
    })

    test('copyFromChannel and copyToChannel throw for a missing channel', () => {
      const buffer = Decoder.createBuffer([[0, 0]], 1)

      expect(() => buffer.copyFromChannel(new Float32Array(2), 1)).toThrow(/Channel 1/)
      expect(() => buffer.copyToChannel(new Float32Array(2), 1)).toThrow(/Channel 1/)
    })
  })
})
