import {
  setupStateEventEmission,
  setupSignalEventEmission,
  setupDebouncedEventEmission,
  setupConditionalEventEmission,
} from '../state-event-emitter'
import { createWaveSurferState } from '../../state/wavesurfer-state'
import { signal } from '../store'

describe('state-event-emitter', () => {
  let emitter: { emit: jest.Mock }

  beforeEach(() => {
    emitter = { emit: jest.fn() }
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('setupStateEventEmission', () => {
    it('should emit play event when isPlaying becomes true', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      // Initial state triggers pause (isPlaying starts false)
      expect(emitter.emit).toHaveBeenCalledWith('pause')

      emitter.emit.mockClear()

      actions.setPlaying(true)
      expect(emitter.emit).toHaveBeenCalledWith('play')

      cleanup()
    })

    it('should emit pause event when isPlaying becomes false', () => {
      const { state, actions } = createWaveSurferState()
      actions.setPlaying(true)

      emitter.emit.mockClear()

      const cleanup = setupStateEventEmission(state, emitter)

      actions.setPlaying(false)
      expect(emitter.emit).toHaveBeenCalledWith('pause')

      cleanup()
    })

    it('should emit timeupdate when currentTime changes', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      actions.setCurrentTime(42)
      expect(emitter.emit).toHaveBeenCalledWith('timeupdate', 42)

      cleanup()
    })

    it('should emit audioprocess when playing and time changes', () => {
      const { state, actions } = createWaveSurferState()
      actions.setPlaying(true)

      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      actions.setCurrentTime(10)

      expect(emitter.emit).toHaveBeenCalledWith('timeupdate', 10)
      expect(emitter.emit).toHaveBeenCalledWith('audioprocess', 10)

      cleanup()
    })

    it('should not emit audioprocess when paused', () => {
      const { state, actions } = createWaveSurferState()
      actions.setPlaying(false)

      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      actions.setCurrentTime(10)

      expect(emitter.emit).toHaveBeenCalledWith('timeupdate', 10)
      expect(emitter.emit).not.toHaveBeenCalledWith('audioprocess', expect.anything())

      cleanup()
    })

    it('should emit seeking event when isSeeking becomes true', () => {
      const { state, actions } = createWaveSurferState()
      actions.setCurrentTime(50)

      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      actions.setSeeking(true)
      expect(emitter.emit).toHaveBeenCalledWith('seeking', 50)

      cleanup()
    })

    it('should emit ready event when state becomes ready', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      // Set duration and audio buffer to make state ready
      actions.setDuration(100)
      // Create a mock AudioBuffer since jsdom doesn't support it
      const mockAudioBuffer = {
        duration: 100,
        length: 44100,
        sampleRate: 44100,
        numberOfChannels: 2,
      } as AudioBuffer
      actions.setAudioBuffer(mockAudioBuffer)

      expect(emitter.emit).toHaveBeenCalledWith('ready', 100)

      cleanup()
    })

    it('should only emit ready event once', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      // Make ready
      actions.setDuration(100)
      const mockAudioBuffer = {
        duration: 100,
        length: 44100,
        sampleRate: 44100,
        numberOfChannels: 2,
      } as AudioBuffer
      actions.setAudioBuffer(mockAudioBuffer)

      const readyCallCount = emitter.emit.mock.calls.filter((call) => call[0] === 'ready').length

      emitter.emit.mockClear()

      // Change duration again
      actions.setDuration(150)

      // Should not emit ready again
      expect(emitter.emit).not.toHaveBeenCalledWith('ready', expect.anything())

      expect(readyCallCount).toBe(1)

      cleanup()
    })

    it('should emit zoom event when zoom changes', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      actions.setZoom(2)
      expect(emitter.emit).toHaveBeenCalledWith('zoom', 2)

      cleanup()
    })

    it('should not emit zoom event for zoom=0', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      emitter.emit.mockClear()

      actions.setZoom(0)
      expect(emitter.emit).not.toHaveBeenCalledWith('zoom', 0)

      cleanup()
    })

    it('should cleanup all subscriptions', () => {
      const { state, actions } = createWaveSurferState()
      const cleanup = setupStateEventEmission(state, emitter)

      cleanup()

      emitter.emit.mockClear()

      // These should not trigger events after cleanup
      actions.setPlaying(true)
      actions.setCurrentTime(42)
      actions.setZoom(2)

      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })

  describe('setupSignalEventEmission', () => {
    it('should emit custom events from signal changes', () => {
      const volumeSignal = signal(1)

      const cleanup = setupSignalEventEmission(volumeSignal, emitter, (vol) => ['volume', vol])

      // Initial emission
      expect(emitter.emit).toHaveBeenCalledWith('volume', 1)

      emitter.emit.mockClear()

      volumeSignal.set(0.5)
      expect(emitter.emit).toHaveBeenCalledWith('volume', 0.5)

      cleanup()
    })

    it('should cleanup subscription', () => {
      const testSignal = signal(0)
      const cleanup = setupSignalEventEmission(testSignal, emitter, (val) => ['test', val])

      cleanup()

      emitter.emit.mockClear()

      testSignal.set(1)
      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })

  describe('setupDebouncedEventEmission', () => {
    it('should debounce event emission', () => {
      const scrollSignal = signal(0)

      const cleanup = setupDebouncedEventEmission(scrollSignal, emitter, (pos) => ['scroll', pos], 100)

      // Initial emission should be debounced
      emitter.emit.mockClear()

      scrollSignal.set(10)
      expect(emitter.emit).not.toHaveBeenCalled()

      scrollSignal.set(20)
      expect(emitter.emit).not.toHaveBeenCalled()

      scrollSignal.set(30)
      expect(emitter.emit).not.toHaveBeenCalled()

      // Fast forward time
      jest.advanceTimersByTime(100)

      // Should emit only the last value
      expect(emitter.emit).toHaveBeenCalledTimes(1)
      expect(emitter.emit).toHaveBeenCalledWith('scroll', 30)

      cleanup()
    })

    it('should restart debounce timer on each change', () => {
      const testSignal = signal(0)

      const cleanup = setupDebouncedEventEmission(testSignal, emitter, (val) => ['test', val], 100)

      emitter.emit.mockClear()

      testSignal.set(1)
      jest.advanceTimersByTime(50)

      testSignal.set(2)
      jest.advanceTimersByTime(50)

      // Should not have emitted yet (timer restarted)
      expect(emitter.emit).not.toHaveBeenCalled()

      jest.advanceTimersByTime(50)

      // Now should emit
      expect(emitter.emit).toHaveBeenCalledWith('test', 2)

      cleanup()
    })

    it('should cleanup pending timeout', () => {
      const testSignal = signal(0)

      const cleanup = setupDebouncedEventEmission(testSignal, emitter, (val) => ['test', val], 100)

      emitter.emit.mockClear()

      testSignal.set(1)

      cleanup()

      jest.advanceTimersByTime(100)

      // Should not emit after cleanup
      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })

  describe('setupConditionalEventEmission', () => {
    it('should only emit when condition is true', () => {
      const stateSignal = signal(0)

      const cleanup = setupConditionalEventEmission(
        stateSignal,
        emitter,
        (val) => val > 5,
        (val) => ['threshold', val],
      )

      emitter.emit.mockClear()

      stateSignal.set(3)
      expect(emitter.emit).not.toHaveBeenCalled()

      stateSignal.set(7)
      expect(emitter.emit).toHaveBeenCalledWith('threshold', 7)

      cleanup()
    })

    it('should re-evaluate condition on each change', () => {
      const testSignal = signal(false)

      const cleanup = setupConditionalEventEmission(
        testSignal,
        emitter,
        (val) => val === true,
        () => ['activated'],
      )

      emitter.emit.mockClear()

      testSignal.set(false)
      expect(emitter.emit).not.toHaveBeenCalled()

      testSignal.set(true)
      expect(emitter.emit).toHaveBeenCalledWith('activated')

      emitter.emit.mockClear()

      testSignal.set(false)
      expect(emitter.emit).not.toHaveBeenCalled()

      cleanup()
    })

    it('should cleanup subscription', () => {
      const testSignal = signal(0)

      const cleanup = setupConditionalEventEmission(
        testSignal,
        emitter,
        (val: number) => val > 0,
        (val) => ['test', val],
      )

      cleanup()

      emitter.emit.mockClear()

      testSignal.set(10)
      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })
})
