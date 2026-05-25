import PitchPlugin from '../plugins/pitch.js'

describe('PitchPlugin', () => {
  const createAudioParam = () => ({
    setTargetAtTime: jest.fn(),
    cancelScheduledValues: jest.fn(),
  })

  const createWebAudioWs = () => {
    const pitchSemitones = createAudioParam()
    const playbackRate = createAudioParam()

    const soundTouchNode = {
      pitchSemitones,
      playbackRate,
      connect: jest.fn(),
      disconnect: jest.fn(),
    }

    const SoundTouchNode = class {
      static register = jest.fn().mockResolvedValue(undefined)

      pitchSemitones = pitchSemitones
      playbackRate = playbackRate
      connect = soundTouchNode.connect
      disconnect = soundTouchNode.disconnect
    }

    const audioContext = {
      destination: {},
      audioWorklet: {
        addModule: jest.fn().mockResolvedValue(undefined),
      },
    }

    const gainNode = {
      context: audioContext,
      connect: jest.fn(),
      disconnect: jest.fn(),
    }

    const ws = {
      getMediaElement: jest.fn(() => ({ getGainNode: () => gainNode })),
      setPlaybackRate: jest.fn(),
    }

    return { ws, gainNode, audioContext, soundTouchNode, pitchSemitones, playbackRate, SoundTouchNode }
  }

  const flush = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('applies initial semitones via SoundTouch and keeps playback speed at 1x', async () => {
    const { ws, SoundTouchNode, pitchSemitones } = createWebAudioWs()
    const plugin = PitchPlugin.create({ semitones: 12, soundTouchModule: { SoundTouchNode } as any })

    ;(plugin as any)._init(ws)
    await flush()

    expect(SoundTouchNode.register).toHaveBeenCalled()
    expect(ws.setPlaybackRate).toHaveBeenCalledWith(1)
    expect(pitchSemitones.setTargetAtTime).toHaveBeenCalledWith(12, expect.any(Number), expect.any(Number))
  })

  test('setSemitones updates SoundTouch pitchSemitones without changing speed', async () => {
    const { ws, SoundTouchNode, pitchSemitones } = createWebAudioWs()
    const plugin = PitchPlugin.create({ soundTouchModule: { SoundTouchNode } as any })
    ;(plugin as any)._init(ws)
    await flush()

    ws.setPlaybackRate.mockClear()
    pitchSemitones.setTargetAtTime.mockClear()
    plugin.setSemitones(7)

    expect(ws.setPlaybackRate).toHaveBeenCalledTimes(1)
    expect(ws.setPlaybackRate).toHaveBeenCalledWith(1)
    expect(pitchSemitones.setTargetAtTime).toHaveBeenCalledWith(7, expect.any(Number), expect.any(Number))
  })

  test('setCents converts cents to semitones', async () => {
    const { ws, SoundTouchNode } = createWebAudioWs()
    const plugin = PitchPlugin.create({ soundTouchModule: { SoundTouchNode } as any })
    ;(plugin as any)._init(ws)
    await flush()

    ws.setPlaybackRate.mockClear()
    plugin.setCents(300)

    expect(plugin.getSemitones()).toBeCloseTo(3, 6)
    expect(plugin.getRate()).toBeCloseTo(Math.pow(2, 3 / 12), 6)
  })

  test('setRate converts playback rate to semitones', async () => {
    const { ws, SoundTouchNode } = createWebAudioWs()
    const plugin = PitchPlugin.create({ soundTouchModule: { SoundTouchNode } as any })
    ;(plugin as any)._init(ws)
    await flush()

    ws.setPlaybackRate.mockClear()
    plugin.setRate(1.5)

    expect(plugin.getSemitones()).toBeCloseTo(12 * Math.log2(1.5), 6)
    expect(plugin.getRate()).toBeCloseTo(1.5, 6)
  })

  test('clamps semitones by configured min/max', async () => {
    const { ws, SoundTouchNode } = createWebAudioWs()
    const plugin = PitchPlugin.create({ minSemitones: -12, maxSemitones: 12, soundTouchModule: { SoundTouchNode } as any })
    ;(plugin as any)._init(ws)
    await flush()

    plugin.setSemitones(24)
    expect(plugin.getSemitones()).toBe(12)

    plugin.setSemitones(-24)
    expect(plugin.getSemitones()).toBe(-12)
  })

  test('emits an error if backend is not WebAudio', async () => {
    const { SoundTouchNode } = createWebAudioWs()
    const plugin = PitchPlugin.create({ soundTouchModule: { SoundTouchNode } as any })
    const errorHandler = jest.fn()
    plugin.on('error', errorHandler)

    ;(plugin as any)._init({ getMediaElement: () => ({}) })
    await flush()

    expect(errorHandler).toHaveBeenCalledTimes(1)
  })

  test('registers processor only once per context and URL', async () => {
    const shared = createWebAudioWs()
    const module = { SoundTouchNode: shared.SoundTouchNode } as any

    const pluginA = PitchPlugin.create({ soundTouchModule: module })
    ;(pluginA as any)._init(shared.ws)
    await flush()

    const pluginB = PitchPlugin.create({ soundTouchModule: module })
    ;(pluginB as any)._init(shared.ws)
    await flush()

    expect(shared.SoundTouchNode.register).toHaveBeenCalledTimes(1)
  })
})