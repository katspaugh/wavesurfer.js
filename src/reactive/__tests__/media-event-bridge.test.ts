import { bridgeMediaEvents, bridgeMediaEventsWithHandler } from '../media-event-bridge'
import { createWaveSurferState } from '../../state/wavesurfer-state'

describe('media-event-bridge', () => {
  let media: HTMLMediaElement
  let actions: ReturnType<typeof createWaveSurferState>['actions']
  let state: ReturnType<typeof createWaveSurferState>['state']

  beforeEach(() => {
    media = document.createElement('audio')
    const stateAndActions = createWaveSurferState()
    actions = stateAndActions.actions
    state = stateAndActions.state
  })

  describe('bridgeMediaEvents', () => {
    it('should create a bridge and return cleanup function', () => {
      const cleanup = bridgeMediaEvents(media, actions)
      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('should update playing state on play event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      expect(state.isPlaying.value).toBe(false)

      media.dispatchEvent(new Event('play'))
      expect(state.isPlaying.value).toBe(true)

      cleanup()
    })

    it('should update playing state on pause event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      actions.setPlaying(true)
      expect(state.isPlaying.value).toBe(true)

      media.dispatchEvent(new Event('pause'))
      expect(state.isPlaying.value).toBe(false)

      cleanup()
    })

    it('should update playing state and time on ended event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      // Mock duration
      Object.defineProperty(media, 'duration', {
        value: 100,
        writable: true,
        configurable: true,
      })

      actions.setPlaying(true)
      actions.setDuration(100)

      media.dispatchEvent(new Event('ended'))

      expect(state.isPlaying.value).toBe(false)
      expect(state.currentTime.value).toBe(100)

      cleanup()
    })

    it('should update current time on timeupdate event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      Object.defineProperty(media, 'currentTime', {
        value: 42,
        writable: true,
        configurable: true,
      })

      media.dispatchEvent(new Event('timeupdate'))
      expect(state.currentTime.value).toBe(42)

      cleanup()
    })

    it('should update duration on durationchange event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      Object.defineProperty(media, 'duration', {
        value: 120,
        writable: true,
        configurable: true,
      })

      media.dispatchEvent(new Event('durationchange'))
      expect(state.duration.value).toBe(120)

      cleanup()
    })

    it('should update duration on loadedmetadata event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      Object.defineProperty(media, 'duration', {
        value: 150,
        writable: true,
        configurable: true,
      })

      media.dispatchEvent(new Event('loadedmetadata'))
      expect(state.duration.value).toBe(150)

      cleanup()
    })

    it('should not update duration if not finite', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      Object.defineProperty(media, 'duration', {
        value: Infinity,
        writable: true,
        configurable: true,
      })

      media.dispatchEvent(new Event('durationchange'))
      expect(state.duration.value).toBe(0) // Should remain initial value

      cleanup()
    })

    it('should update seeking state on seeking event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      expect(state.isSeeking.value).toBe(false)

      media.dispatchEvent(new Event('seeking'))
      expect(state.isSeeking.value).toBe(true)

      cleanup()
    })

    it('should update seeking state on seeked event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      actions.setSeeking(true)
      expect(state.isSeeking.value).toBe(true)

      media.dispatchEvent(new Event('seeked'))
      expect(state.isSeeking.value).toBe(false)

      cleanup()
    })

    it('should update volume on volumechange event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      Object.defineProperty(media, 'volume', {
        value: 0.5,
        writable: true,
        configurable: true,
      })

      media.dispatchEvent(new Event('volumechange'))
      expect(state.volume.value).toBe(0.5)

      cleanup()
    })

    it('should update playback rate on ratechange event', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      Object.defineProperty(media, 'playbackRate', {
        value: 1.5,
        writable: true,
        configurable: true,
      })

      media.dispatchEvent(new Event('ratechange'))
      expect(state.playbackRate.value).toBe(1.5)

      cleanup()
    })

    it('should cleanup all event listeners', () => {
      const addSpy = jest.spyOn(media, 'addEventListener')
      const removeSpy = jest.spyOn(media, 'removeEventListener')

      const cleanup = bridgeMediaEvents(media, actions)

      const addCallCount = addSpy.mock.calls.length
      expect(addCallCount).toBeGreaterThan(0)

      cleanup()

      expect(removeSpy).toHaveBeenCalledTimes(addCallCount)

      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it('should handle multiple events in sequence', () => {
      const cleanup = bridgeMediaEvents(media, actions)

      // Mock properties
      Object.defineProperty(media, 'duration', {
        value: 100,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(media, 'currentTime', {
        value: 0,
        writable: true,
        configurable: true,
      })

      // Simulate playback sequence
      media.dispatchEvent(new Event('loadedmetadata'))
      expect(state.duration.value).toBe(100)

      media.dispatchEvent(new Event('play'))
      expect(state.isPlaying.value).toBe(true)

      Object.defineProperty(media, 'currentTime', { value: 50 })
      media.dispatchEvent(new Event('timeupdate'))
      expect(state.currentTime.value).toBe(50)

      media.dispatchEvent(new Event('pause'))
      expect(state.isPlaying.value).toBe(false)

      cleanup()
    })
  })

  describe('bridgeMediaEventsWithHandler', () => {
    it('should call handler for media events', () => {
      const handler = jest.fn()
      const cleanup = bridgeMediaEventsWithHandler(media, handler)

      media.dispatchEvent(new Event('play'))
      expect(handler).toHaveBeenCalledWith('play', expect.any(Event))

      media.dispatchEvent(new Event('pause'))
      expect(handler).toHaveBeenCalledWith('pause', expect.any(Event))

      cleanup()
    })

    it('should handle multiple events', () => {
      const events: string[] = []
      const handler = (event: string) => {
        events.push(event)
      }

      const cleanup = bridgeMediaEventsWithHandler(media, handler)

      media.dispatchEvent(new Event('loadstart'))
      media.dispatchEvent(new Event('loadedmetadata'))
      media.dispatchEvent(new Event('canplay'))
      media.dispatchEvent(new Event('play'))

      expect(events).toContain('loadstart')
      expect(events).toContain('loadedmetadata')
      expect(events).toContain('canplay')
      expect(events).toContain('play')

      cleanup()
    })

    it('should cleanup all listeners', () => {
      const handler = jest.fn()
      const removeSpy = jest.spyOn(media, 'removeEventListener')

      const cleanup = bridgeMediaEventsWithHandler(media, handler)
      cleanup()

      expect(removeSpy.mock.calls.length).toBeGreaterThan(0)

      removeSpy.mockRestore()
    })
  })
})
