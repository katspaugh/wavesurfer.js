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
  describe('onended and finish event', () => {
    test('emits ended when buffer finishes naturally at duration', () => {
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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

    test('does not emit ended when stopAt stops before end of audio', () => {
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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

    test('does not emit ended when currentTime is beyond tolerance threshold from duration', () => {
      const { audioContext, bufferSource, triggerOnended } = createMockAudioContext()
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
})
