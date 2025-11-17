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

  describe('reactive streams', () => {
    test('exposes isPlaying$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.isPlaying$).toBeDefined()
      expect(player.isPlaying$.value).toBe(false)
    })

    test('exposes currentTime$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.currentTime$).toBeDefined()
      expect(player.currentTime$.value).toBe(0)
    })

    test('exposes duration$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.duration$).toBeDefined()
      expect(typeof player.duration$.value).toBe('number')
    })

    test('exposes volume$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.volume$).toBeDefined()
      expect(typeof player.volume$.value).toBe('number')
    })

    test('exposes muted$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.muted$).toBeDefined()
      expect(typeof player.muted$.value).toBe('boolean')
    })

    test('exposes playbackRate$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.playbackRate$).toBeDefined()
      expect(typeof player.playbackRate$.value).toBe('number')
    })

    test('exposes seeking$ stream', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.seeking$).toBeDefined()
      expect(player.seeking$.value).toBe(false)
    })

    test('isPlaying$ updates on play event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.isPlaying$.value).toBe(false)
      media.dispatchEvent(new Event('play'))
      expect(player.isPlaying$.value).toBe(true)
    })

    test('isPlaying$ updates on pause event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      media.dispatchEvent(new Event('play'))
      expect(player.isPlaying$.value).toBe(true)
      media.dispatchEvent(new Event('pause'))
      expect(player.isPlaying$.value).toBe(false)
    })

    test('isPlaying$ updates on ended event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      media.dispatchEvent(new Event('play'))
      expect(player.isPlaying$.value).toBe(true)
      media.dispatchEvent(new Event('ended'))
      expect(player.isPlaying$.value).toBe(false)
    })

    test('currentTime$ updates on timeupdate event', () => {
      const media = createMedia()
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 5.5, writable: true })
      const player = new Player<Events>({ media })
      expect(player.currentTime$.value).toBe(0)
      media.dispatchEvent(new Event('timeupdate'))
      expect(player.currentTime$.value).toBe(5.5)
    })

    test('duration$ updates on durationchange event', () => {
      const media = createMedia()
      Object.defineProperty(media, 'duration', { configurable: true, value: 120.5, writable: true })
      const player = new Player<Events>({ media })
      media.dispatchEvent(new Event('durationchange'))
      expect(player.duration$.value).toBe(120.5)
    })

    test('seeking$ updates on seeking and seeked events', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      expect(player.seeking$.value).toBe(false)
      media.dispatchEvent(new Event('seeking'))
      expect(player.seeking$.value).toBe(true)
      media.dispatchEvent(new Event('seeked'))
      expect(player.seeking$.value).toBe(false)
    })

    test('volume$ and muted$ update on volumechange event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      Object.defineProperty(media, 'volume', { configurable: true, value: 0.7, writable: true })
      Object.defineProperty(media, 'muted', { configurable: true, value: true, writable: true })
      media.dispatchEvent(new Event('volumechange'))
      expect(player.volume$.value).toBe(0.7)
      expect(player.muted$.value).toBe(true)
    })

    test('playbackRate$ updates on ratechange event', () => {
      const media = createMedia()
      const player = new Player<Events>({ media })
      Object.defineProperty(media, 'playbackRate', { configurable: true, value: 1.5, writable: true })
      media.dispatchEvent(new Event('ratechange'))
      expect(player.playbackRate$.value).toBe(1.5)
    })
  })
})
