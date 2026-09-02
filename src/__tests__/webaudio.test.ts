import WebAudioPlayer from '../webaudio.js'

// Mock Web Audio API
function createMockAudioContext() {
  let _currentTime = 0
  const gainNode = {
    gain: { value: 1 },
    connect: jest.fn(),
    disconnect: jest.fn(),
  }

  let bufferSourceOnended: (() => void) | null = null
  const bufferSource = {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    get onended() {
      return bufferSourceOnended
    },
    set onended(fn: (() => void) | null) {
      bufferSourceOnended = fn
    },
  }

  const audioContext = {
    get currentTime() {
      return _currentTime
    },
    set currentTime(v: number) {
      _currentTime = v
    },
    sampleRate: 44100,
    destination: {},
    createGain: jest.fn(() => gainNode),
    createBufferSource: jest.fn(() => bufferSource),
    decodeAudioData: jest.fn(),
  } as unknown as AudioContext & { currentTime: number }

  return {
    audioContext,
    gainNode,
    bufferSource,
    triggerOnended: () => {
      if (bufferSourceOnended) bufferSourceOnended()
    },
  }
}

function createMockBuffer(duration: number) {
  return { duration, numberOfChannels: 1, getChannelData: jest.fn(() => new Float32Array(0)) } as unknown as AudioBuffer
}

describe('WebAudioPlayer', () => {
  describe('audio session playback mode', () => {
    const originalAudioSession = Object.getOwnPropertyDescriptor(navigator, 'audioSession')

    afterEach(() => {
      if (originalAudioSession) {
        Object.defineProperty(navigator, 'audioSession', originalAudioSession)
      } else {
        delete (navigator as Navigator & { audioSession?: unknown }).audioSession
      }
      jest.restoreAllMocks()
    })

    test('sets navigator.audioSession.type to playback when available', () => {
      const { audioContext } = createMockAudioContext()
      const audioSession = { type: 'ambient' }
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: audioSession })

      new WebAudioPlayer(audioContext)

      expect(audioSession.type).toBe('playback')
    })

    test('warns when setting navigator.audioSession.type fails', () => {
      const { audioContext } = createMockAudioContext()
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const audioSession = {
        get type() {
          return 'ambient'
        },
        set type(_value: string) {
          throw new Error('nope')
        },
      }
      Object.defineProperty(navigator, 'audioSession', { configurable: true, value: audioSession })

      new WebAudioPlayer(audioContext)

      expect(warnSpy).toHaveBeenCalledWith(
        'Setting navigator.audioSession.type failed:',
        expect.objectContaining({ message: 'nope' }),
      )
    })
  })

  describe('onended and finish event', () => {
    test('emits ended when buffer finishes naturally at duration', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Play
      audioContext.currentTime = 100
      player.play()

      // Simulate natural end: audioContext.currentTime has advanced by exactly the duration
      audioContext.currentTime = 110 // 100 + 10 seconds of audio
      triggerOnended()

      expect(endedSpy).toHaveBeenCalledTimes(1)
    })

    test('emits ended when buffer finishes naturally and currentTime is slightly less than duration due to float precision', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Play
      audioContext.currentTime = 100
      player.play()

      // Simulate natural end with slight floating-point imprecision
      // currentTime would be 0 + (109.999 - 100) * 1 = 9.999, which is < 10 (duration)
      audioContext.currentTime = 109.999
      triggerOnended()

      expect(endedSpy).toHaveBeenCalledTimes(1)
    })

    test('does not emit ended when paused programmatically (far from end)', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Play
      audioContext.currentTime = 100
      player.play()

      // Advance to mid-playback
      audioContext.currentTime = 105

      // User pauses (sets this.paused = true synchronously)
      player.pause()

      // onended fires asynchronously after stop()
      triggerOnended()

      expect(endedSpy).not.toHaveBeenCalled()
    })

    test('preserves the current playback position before stopping the buffer', () => {
      const { audioContext, bufferSource } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      ;(player as any).buffer = createMockBuffer(10)

      audioContext.currentTime = 100
      player.play()
      audioContext.currentTime = 105

      const currentTimeDuringStop = jest.fn(() => player.currentTime)
      bufferSource.stop.mockImplementation(currentTimeDuringStop)
      player.pause()

      expect(currentTimeDuringStop).toHaveReturnedWith(5)
      expect(player.currentTime).toBe(5)
    })

    test('does not emit ended when stopAt stops before end of audio', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Play
      audioContext.currentTime = 100
      player.play()

      // Stop at 5 seconds
      audioContext.currentTime = 100
      player.stopAt(5)

      // Simulate buffer stopping at 5 seconds
      audioContext.currentTime = 105
      triggerOnended()

      // Should NOT emit ended because currentTime (5) is far from duration (10)
      expect(endedSpy).not.toHaveBeenCalled()
    })

    test('emits ended when currentTime slightly exceeds duration', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Play
      audioContext.currentTime = 100
      player.play()

      // Simulate natural end: audioContext has advanced slightly past the duration
      audioContext.currentTime = 110.005
      triggerOnended()

      expect(endedSpy).toHaveBeenCalledTimes(1)
    })

    test('emits ended with non-default playback rate', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Set playback rate to 2x
      ;(player as any)._playbackRate = 2

      // Play
      audioContext.currentTime = 100
      player.play()

      // At 2x, 10s audio takes 5s real time
      // currentTime = 0 + (104.999 - 100) * 2 = 9.998, which is < 10 but within tolerance
      audioContext.currentTime = 104.999
      triggerOnended()

      expect(endedSpy).toHaveBeenCalledTimes(1)
    })

    test('stopAt schedules the stop scaled by playback rate', () => {
      const { audioContext, bufferSource } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      ;(player as any).buffer = createMockBuffer(10)
      ;(player as any)._playbackRate = 2

      audioContext.currentTime = 100
      player.play()

      // At 2x rate, stopping at media time 5 takes only 2.5s of real time
      player.stopAt(5)

      expect(bufferSource.stop).toHaveBeenCalledWith(102.5)
    })

    test('stopAt reports exactly the stop position after the buffer ends', () => {
      const { audioContext, bufferSource } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      ;(player as any).buffer = createMockBuffer(10)

      audioContext.currentTime = 100
      player.play()
      player.stopAt(5)

      // The 'ended' event fires with some latency after the actual stop
      audioContext.currentTime = 105.03
      const endedListener = bufferSource.addEventListener.mock.calls.find(([type]) => type === 'ended')?.[1]
      endedListener?.()

      expect(player.currentTime).toBe(5)
    })

    test('does not emit ended when currentTime is beyond tolerance threshold from duration', () => {
      const { audioContext, triggerOnended } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const endedSpy = jest.fn()
      player.on('ended', endedSpy)

      // Set up buffer
      ;(player as any).buffer = createMockBuffer(10)

      // Play
      audioContext.currentTime = 100
      player.play()

      // Simulate stopAt scenario where currentTime is 0.02s before duration (beyond 0.01s tolerance)
      // currentTime = 0 + (109.98 - 100) * 1 = 9.98, duration - currentTime = 0.02 >= 0.01
      audioContext.currentTime = 109.98
      triggerOnended()

      expect(endedSpy).not.toHaveBeenCalled()
    })
  })

  describe('error event', () => {
    const originalFetch = global.fetch

    afterEach(() => {
      global.fetch = originalFetch
    })

    test('emits error when fetch fails', async () => {
      const { audioContext } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const onError = jest.fn()
      player.on('error', onError)
      global.fetch = jest.fn().mockResolvedValue({ status: 404, statusText: 'Not Found' } as Response)
      player.src = 'http://example.com/missing.mp3'
      await new Promise((r) => setTimeout(r, 0))
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })

    test('clears a stale error when a new source is set', async () => {
      const { audioContext } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      global.fetch = jest.fn().mockRejectedValue(new Error('network'))
      player.src = 'http://example.com/bad.mp3'
      await new Promise((r) => setTimeout(r, 0))
      expect(player.error).toBeInstanceOf(Error)

      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response)
      player.src = 'http://example.com/good.mp3'
      expect(player.error).toBeNull()
    })

    test('changing src aborts the previous in-flight fetch', () => {
      const { audioContext } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const signals: AbortSignal[] = []
      global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
        signals.push(init?.signal as AbortSignal)
        return new Promise(() => undefined) // never settles
      })

      player.src = 'http://x/a.mp3'
      player.src = 'http://x/b.mp3'

      expect(signals).toHaveLength(2)
      expect(signals[0].aborted).toBe(true)
      expect(signals[1].aborted).toBe(false)
    })

    test('destroy aborts the in-flight src fetch', () => {
      const { audioContext } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const signals: AbortSignal[] = []
      global.fetch = jest.fn().mockImplementation((_url: string, init?: RequestInit) => {
        signals.push(init?.signal as AbortSignal)
        return new Promise(() => undefined) // never settles
      })

      player.src = 'http://x/a.mp3'
      player.destroy()

      expect(signals[0].aborted).toBe(true)
    })

    test('a stale fetch does not apply its decoded buffer when the same URL was set again (A -> B -> A)', async () => {
      const { audioContext } = createMockAudioContext()
      ;(audioContext.decodeAudioData as jest.Mock).mockResolvedValue(createMockBuffer(1))
      const player = new WebAudioPlayer(audioContext)
      const onCanplay = jest.fn()
      player.on('canplay', onCanplay)

      const resolvers: Array<(response: Response) => void> = []
      global.fetch = jest.fn().mockImplementation(() => new Promise<Response>((res) => resolvers.push(res)))

      player.src = 'http://x/a.mp3'
      player.src = 'http://x/b.mp3'
      player.src = 'http://x/a.mp3' // back to A: fetch #3 owns the src now

      // Fetch #1 (the stale request for A) resolves first. A URL-equality guard
      // alone would let it through, since currentSrc is A again -- only a
      // per-assignment generation check rejects it.
      resolvers[0]({
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response)
      await new Promise((r) => setTimeout(r, 0))

      expect(onCanplay).not.toHaveBeenCalled()
      expect((player as any).buffer).toBeNull()
    })

    test('a stale decode does not apply after destroy', async () => {
      const { audioContext } = createMockAudioContext()
      ;(audioContext.decodeAudioData as jest.Mock).mockResolvedValue(createMockBuffer(1))
      const player = new WebAudioPlayer(audioContext)
      const onCanplay = jest.fn()
      player.on('canplay', onCanplay)

      let resolveFetch: (response: Response) => void = () => undefined
      global.fetch = jest.fn().mockImplementation(() => new Promise<Response>((res) => (resolveFetch = res)))

      player.src = 'http://x/a.mp3'
      player.destroy()

      resolveFetch({
        status: 200,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response)
      await new Promise((r) => setTimeout(r, 0))

      expect(onCanplay).not.toHaveBeenCalled()
      expect((player as any).buffer).toBeNull()
    })

    test('does not emit error for a fetch that lost the race to a newer src', async () => {
      const { audioContext } = createMockAudioContext()
      const player = new WebAudioPlayer(audioContext)
      const onError = jest.fn()
      player.on('error', onError)
      let rejectFirst: (e: Error) => void = () => undefined
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() => new Promise((_, rej) => (rejectFirst = rej)))
        .mockImplementationOnce(() => new Promise(() => undefined))
      player.src = 'http://x/a.mp3'
      player.src = 'http://x/b.mp3' // supersedes a.mp3
      rejectFirst(new Error('network'))
      await new Promise((r) => setTimeout(r, 0))
      expect(onError).not.toHaveBeenCalled() // stale failure must be silent
    })
  })
})

describe('suspended AudioContext', () => {
  test('play() resumes a suspended AudioContext (autoplay policy would otherwise play silently)', async () => {
    const { audioContext } = createMockAudioContext()
    const resume = jest.fn().mockResolvedValue(undefined)
    Object.assign(audioContext, { state: 'suspended', resume })
    const player = new WebAudioPlayer(audioContext)
    ;(player as any).buffer = createMockBuffer(10)

    await player.play()

    expect(resume).toHaveBeenCalled()
  })

  test('play() does not call resume() on a running AudioContext', async () => {
    const { audioContext } = createMockAudioContext()
    const resume = jest.fn().mockResolvedValue(undefined)
    Object.assign(audioContext, { state: 'running', resume })
    const player = new WebAudioPlayer(audioContext)
    ;(player as any).buffer = createMockBuffer(10)

    await player.play()

    expect(resume).not.toHaveBeenCalled()
  })
})

describe('stopAt clamping', () => {
  test('stopAt with a time already in the past clamps the scheduled stop to now (no RangeError)', () => {
    const { audioContext, bufferSource } = createMockAudioContext()
    const player = new WebAudioPlayer(audioContext)
    ;(player as any).buffer = createMockBuffer(20)

    audioContext.currentTime = 100
    player.play()
    audioContext.currentTime = 110 // playback position is now 10

    // AudioScheduledSourceNode.stop() throws a RangeError for a negative
    // `when`; a real node also rejects times in the past relative to now.
    bufferSource.stop.mockImplementation((when?: number) => {
      if (when != null && when < audioContext.currentTime) {
        throw new RangeError('stop time must not be in the past')
      }
    })

    expect(() => player.stopAt(5)).not.toThrow()
    expect(bufferSource.stop).toHaveBeenCalledWith(110)
  })
})

describe('seeking events', () => {
  test('setting currentTime emits seeking followed by seeked (buffer seeks are instantaneous)', () => {
    const { audioContext } = createMockAudioContext()
    const player = new WebAudioPlayer(audioContext)
    const events: string[] = []
    player.on('seeking', () => events.push('seeking'))
    player.on('seeked', () => events.push('seeked'))
    player.on('timeupdate', () => events.push('timeupdate'))

    player.currentTime = 3

    // Without 'seeked', Player's seeking-state bridge (set on 'seeking',
    // cleared only on 'seeked') would stick to true forever.
    expect(events).toEqual(['seeking', 'seeked', 'timeupdate'])
  })
})
