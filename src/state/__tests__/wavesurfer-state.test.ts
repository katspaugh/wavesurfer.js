import { createWaveSurferState } from '../wavesurfer-state'

describe('WaveSurferState', () => {
  it('should create state with default values', () => {
    const { state } = createWaveSurferState()

    expect(state.currentTime.value).toBe(0)
    expect(state.duration.value).toBe(0)
    expect(state.isPlaying.value).toBe(false)
    expect(state.isPaused.value).toBe(true)
    expect(state.isSeeking.value).toBe(false)
    expect(state.volume.value).toBe(1)
    expect(state.playbackRate.value).toBe(1)
    expect(state.audioBuffer.value).toBeNull()
    expect(state.peaks.value).toBeNull()
    expect(state.url.value).toBe('')
    expect(state.zoom.value).toBe(0)
    expect(state.scrollPosition.value).toBe(0)
  })

  describe('actions', () => {
    it('should update currentTime', () => {
      const { state, actions } = createWaveSurferState()

      actions.setCurrentTime(10)
      expect(state.currentTime.value).toBe(10)
    })

    it('should clamp currentTime to duration', () => {
      const { state, actions } = createWaveSurferState()

      actions.setDuration(100)
      actions.setCurrentTime(150)

      expect(state.currentTime.value).toBe(100)
    })

    it('should not allow negative currentTime', () => {
      const { state, actions } = createWaveSurferState()

      actions.setCurrentTime(-10)
      expect(state.currentTime.value).toBe(0)
    })

    it('should update duration', () => {
      const { state, actions } = createWaveSurferState()

      actions.setDuration(120)
      expect(state.duration.value).toBe(120)
    })

    it('should not allow negative duration', () => {
      const { state, actions } = createWaveSurferState()

      actions.setDuration(-10)
      expect(state.duration.value).toBe(0)
    })

    it('should update isPlaying', () => {
      const { state, actions } = createWaveSurferState()

      actions.setPlaying(true)
      expect(state.isPlaying.value).toBe(true)

      actions.setPlaying(false)
      expect(state.isPlaying.value).toBe(false)
    })

    it('should update isSeeking', () => {
      const { state, actions } = createWaveSurferState()

      actions.setSeeking(true)
      expect(state.isSeeking.value).toBe(true)
    })

    it('should update volume', () => {
      const { state, actions } = createWaveSurferState()

      actions.setVolume(0.5)
      expect(state.volume.value).toBe(0.5)
    })

    it('should clamp volume between 0 and 1', () => {
      const { state, actions } = createWaveSurferState()

      actions.setVolume(-0.5)
      expect(state.volume.value).toBe(0)

      actions.setVolume(1.5)
      expect(state.volume.value).toBe(1)
    })

    it('should update playbackRate', () => {
      const { state, actions } = createWaveSurferState()

      actions.setPlaybackRate(2)
      expect(state.playbackRate.value).toBe(2)
    })

    it('should clamp playbackRate between 0.1 and 16', () => {
      const { state, actions } = createWaveSurferState()

      actions.setPlaybackRate(0.05)
      expect(state.playbackRate.value).toBe(0.1)

      actions.setPlaybackRate(20)
      expect(state.playbackRate.value).toBe(16)
    })

    it('should update audioBuffer', () => {
      const { state, actions } = createWaveSurferState()
      const buffer = { duration: 120 } as AudioBuffer

      actions.setAudioBuffer(buffer)
      expect(state.audioBuffer.value).toBe(buffer)
    })

    it('should update duration when audioBuffer is set', () => {
      const { state, actions } = createWaveSurferState()
      const buffer = { duration: 120 } as AudioBuffer

      actions.setAudioBuffer(buffer)
      expect(state.duration.value).toBe(120)
    })

    it('should update peaks', () => {
      const { state, actions } = createWaveSurferState()
      const peaks = [new Float32Array([1, 2, 3])]

      actions.setPeaks(peaks)
      expect(state.peaks.value).toBe(peaks)
    })

    it('should update url', () => {
      const { state, actions } = createWaveSurferState()

      actions.setUrl('/audio.mp3')
      expect(state.url.value).toBe('/audio.mp3')
    })

    it('should update zoom', () => {
      const { state, actions } = createWaveSurferState()

      actions.setZoom(100)
      expect(state.zoom.value).toBe(100)
    })

    it('should not allow negative zoom', () => {
      const { state, actions } = createWaveSurferState()

      actions.setZoom(-10)
      expect(state.zoom.value).toBe(0)
    })

    it('should update scrollPosition', () => {
      const { state, actions } = createWaveSurferState()

      actions.setScrollPosition(50)
      expect(state.scrollPosition.value).toBe(50)
    })

    it('should not allow negative scrollPosition', () => {
      const { state, actions } = createWaveSurferState()

      actions.setScrollPosition(-10)
      expect(state.scrollPosition.value).toBe(0)
    })
  })

  describe('computed values', () => {
    it('should compute isPaused from isPlaying', () => {
      const { state, actions } = createWaveSurferState()

      expect(state.isPaused.value).toBe(true)

      actions.setPlaying(true)
      expect(state.isPaused.value).toBe(false)

      actions.setPlaying(false)
      expect(state.isPaused.value).toBe(true)
    })

    it('should compute canPlay from audioBuffer', () => {
      const { state, actions } = createWaveSurferState()

      expect(state.canPlay.value).toBe(false)

      const buffer = { duration: 120 } as AudioBuffer
      actions.setAudioBuffer(buffer)
      expect(state.canPlay.value).toBe(true)

      actions.setAudioBuffer(null)
      expect(state.canPlay.value).toBe(false)
    })

    it('should compute isReady from canPlay and duration', () => {
      const { state, actions } = createWaveSurferState()

      expect(state.isReady.value).toBe(false)

      // Only buffer, no duration
      const buffer = { duration: 0 } as AudioBuffer
      actions.setAudioBuffer(buffer)
      expect(state.isReady.value).toBe(false)

      // Both buffer and duration
      actions.setDuration(120)
      expect(state.isReady.value).toBe(true)

      // Remove buffer
      actions.setAudioBuffer(null)
      expect(state.isReady.value).toBe(false)
    })

    it('should compute progress from currentTime', () => {
      const { state, actions } = createWaveSurferState()

      expect(state.progress.value).toBe(0)

      actions.setCurrentTime(50)
      expect(state.progress.value).toBe(50)
    })

    it('should compute progressPercent from currentTime and duration', () => {
      const { state, actions } = createWaveSurferState()

      expect(state.progressPercent.value).toBe(0)

      actions.setDuration(100)
      actions.setCurrentTime(25)
      expect(state.progressPercent.value).toBe(0.25)

      actions.setCurrentTime(50)
      expect(state.progressPercent.value).toBe(0.5)

      actions.setCurrentTime(100)
      expect(state.progressPercent.value).toBe(1)
    })

    it('should handle progressPercent with zero duration', () => {
      const { state, actions } = createWaveSurferState()

      actions.setDuration(0)
      actions.setCurrentTime(10)

      expect(state.progressPercent.value).toBe(0)
    })
  })

  describe('subscriptions', () => {
    it('should notify subscribers on state changes', () => {
      const { state, actions } = createWaveSurferState()
      const callback = jest.fn()

      state.isPlaying.subscribe(callback)
      actions.setPlaying(true)

      expect(callback).toHaveBeenCalledWith(true)
    })

    it('should notify computed value subscribers', () => {
      const { state, actions } = createWaveSurferState()
      const callback = jest.fn()

      state.progressPercent.subscribe(callback)

      actions.setDuration(100)
      actions.setCurrentTime(50)

      expect(callback).toHaveBeenCalledWith(0.5)
    })

    it('should work with multiple subscribers', () => {
      const { state, actions } = createWaveSurferState()
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      state.isPlaying.subscribe(callback1)
      state.isPlaying.subscribe(callback2)

      actions.setPlaying(true)

      expect(callback1).toHaveBeenCalledWith(true)
      expect(callback2).toHaveBeenCalledWith(true)
    })
  })

  describe('state isolation', () => {
    it('should create independent state instances', () => {
      const instance1 = createWaveSurferState()
      const instance2 = createWaveSurferState()

      instance1.actions.setCurrentTime(10)
      instance2.actions.setCurrentTime(20)

      expect(instance1.state.currentTime.value).toBe(10)
      expect(instance2.state.currentTime.value).toBe(20)
    })

    it('should not share state between instances', () => {
      const instance1 = createWaveSurferState()
      const instance2 = createWaveSurferState()

      instance1.actions.setPlaying(true)

      expect(instance1.state.isPlaying.value).toBe(true)
      expect(instance2.state.isPlaying.value).toBe(false)
    })
  })

  describe('complex state updates', () => {
    it('should handle multiple rapid updates', () => {
      const { state, actions } = createWaveSurferState()
      const values: number[] = []

      state.currentTime.subscribe((time) => values.push(time))

      // Start from 1 since 0 is the initial value (no change from initial)
      for (let i = 1; i < 100; i++) {
        actions.setCurrentTime(i)
      }

      expect(values).toHaveLength(99)
      expect(state.currentTime.value).toBe(99)
    })

    it('should maintain consistency across dependent computed values', () => {
      const { state, actions } = createWaveSurferState()

      actions.setDuration(100)
      actions.setCurrentTime(50)
      const buffer = { duration: 100 } as AudioBuffer
      actions.setAudioBuffer(buffer)

      expect(state.progressPercent.value).toBe(0.5)
      expect(state.canPlay.value).toBe(true)
      expect(state.isReady.value).toBe(true)

      actions.setCurrentTime(75)

      expect(state.progressPercent.value).toBe(0.75)
      expect(state.progress.value).toBe(75)
    })

    it('should handle state reset correctly', () => {
      const { state, actions } = createWaveSurferState()

      // Set some state
      actions.setDuration(100)
      actions.setCurrentTime(50)
      actions.setPlaying(true)
      actions.setVolume(0.5)

      // Reset
      actions.setCurrentTime(0)
      actions.setDuration(0)
      actions.setPlaying(false)
      actions.setVolume(1)

      expect(state.currentTime.value).toBe(0)
      expect(state.duration.value).toBe(0)
      expect(state.isPlaying.value).toBe(false)
      expect(state.volume.value).toBe(1)
    })
  })
})
