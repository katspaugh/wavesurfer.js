import Player from '../player.js'

interface Events {
  [key: string]: unknown[]
}

describe('Player', () => {
  const createMedia = () => {
    const media = document.createElement('audio') as HTMLMediaElement & {
      play: jest.Mock
      pause: jest.Mock
      setSinkId?: jest.Mock
    }
    media.play = jest.fn().mockResolvedValue(undefined)
    media.pause = jest.fn()
    ;(media as any).setSinkId = jest.fn().mockResolvedValue(undefined)
    return media
  }

  test('play and pause', async () => {
    const media = createMedia()
    const player = new Player<Events>({ media })
    await player.play()
    expect(media.play).toHaveBeenCalled()
    player.pause()
    expect(media.pause).toHaveBeenCalled()
  })

  test('pause before play promise resolves does not reject', async () => {
    const abort = new DOMException('interrupted', 'AbortError')
    let rejectPlay: (reason?: unknown) => void = () => undefined
    const media = createMedia()
    media.play = jest.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectPlay = reject
        }),
    )
    const player = new Player<Events>({ media })
    const promise = player.play()
    player.pause()
    rejectPlay(abort)
    await expect(promise).resolves.toBeUndefined()
  })

  test('volume and muted', () => {
    const media = createMedia()
    const player = new Player<Events>({ media })
    player.setVolume(0.5)
    expect(player.getVolume()).toBe(0.5)
    player.setMuted(true)
    expect(player.getMuted()).toBe(true)
  })

  test('setTime clamps to duration', () => {
    const media = createMedia()
    Object.defineProperty(media, 'duration', { configurable: true, value: 10 })
    const player = new Player<Events>({ media })
    player.setTime(-1)
    expect(player.getCurrentTime()).toBe(0)
    player.setTime(11)
    expect(player.getCurrentTime()).toBe(10)
  })

  test('setSinkId uses media method', async () => {
    const media = createMedia()
    const player = new Player<Events>({ media })
    await player.setSinkId('id')
    expect(media.setSinkId).toHaveBeenCalledWith('id')
  })

  describe('reactive signals', () => {
    test('exposes isPlayingSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.isPlayingSignal).toBeDefined()
      expect(player.isPlayingSignal.value).toBe(false)
    })

    test('exposes currentTimeSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.currentTimeSignal).toBeDefined()
      expect(player.currentTimeSignal.value).toBe(0)
    })

    test('exposes durationSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.durationSignal).toBeDefined()
      expect(typeof player.durationSignal.value).toBe('number')
    })

    test('exposes volumeSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.volumeSignal).toBeDefined()
      expect(typeof player.volumeSignal.value).toBe('number')
    })

    test('exposes mutedSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.mutedSignal).toBeDefined()
      expect(typeof player.mutedSignal.value).toBe('boolean')
    })

    test('exposes playbackRateSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.playbackRateSignal).toBeDefined()
      expect(typeof player.playbackRateSignal.value).toBe('number')
    })

    test('exposes seekingSignal', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.seekingSignal).toBeDefined()
      expect(player.seekingSignal.value).toBe(false)
    })

    test('isPlayingSignal updates on play event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.isPlayingSignal.value).toBe(false)
      media.dispatchEvent(new Event('play'))
      expect(player.isPlayingSignal.value).toBe(true)
    })

    test('isPlayingSignal updates on pause event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      media.dispatchEvent(new Event('play'))
      expect(player.isPlayingSignal.value).toBe(true)
      media.dispatchEvent(new Event('pause'))
      expect(player.isPlayingSignal.value).toBe(false)
    })

    test('isPlayingSignal updates on ended event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      media.dispatchEvent(new Event('play'))
      expect(player.isPlayingSignal.value).toBe(true)
      media.dispatchEvent(new Event('ended'))
      expect(player.isPlayingSignal.value).toBe(false)
    })

    test('currentTimeSignal updates on timeupdate event', () => {
      const media = createMedia()
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 5.5, writable: true })
      const player = new Player<Events>({ media })
      expect(player.currentTimeSignal.value).toBe(0)
      media.dispatchEvent(new Event('timeupdate'))
      expect(player.currentTimeSignal.value).toBe(5.5)
    })

    test('durationSignal updates on durationchange event', () => {
      const media = createMedia()
      Object.defineProperty(media, 'duration', { configurable: true, value: 120.5, writable: true })
      const player = new Player<Events>({ media })
      media.dispatchEvent(new Event('durationchange'))
      expect(player.durationSignal.value).toBe(120.5)
    })

    test('seekingSignal updates on seeking and seeked events', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.seekingSignal.value).toBe(false)
      media.dispatchEvent(new Event('seeking'))
      expect(player.seekingSignal.value).toBe(true)
      media.dispatchEvent(new Event('seeked'))
      expect(player.seekingSignal.value).toBe(false)
    })

    test('volumeSignal and mutedSignal update on volumechange event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      Object.defineProperty(media, 'volume', { configurable: true, value: 0.7, writable: true })
      Object.defineProperty(media, 'muted', { configurable: true, value: true, writable: true })
      media.dispatchEvent(new Event('volumechange'))
      expect(player.volumeSignal.value).toBe(0.7)
      expect(player.mutedSignal.value).toBe(true)
    })

    test('playbackRateSignal updates on ratechange event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      Object.defineProperty(media, 'playbackRate', { configurable: true, value: 1.5, writable: true })
      media.dispatchEvent(new Event('ratechange'))
      expect(player.playbackRateSignal.value).toBe(1.5)
    })
  })
})
