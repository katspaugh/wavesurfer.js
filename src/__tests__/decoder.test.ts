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
})
