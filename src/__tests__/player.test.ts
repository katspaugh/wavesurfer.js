import MediaElementPlayer from '../media-element-player.js'

class TestPlayer extends MediaElementPlayer {
  public setSource(url: string) {
    this.setSrc(url)
  }

  public replaceMedia(element: HTMLMediaElement) {
    this.setMediaElement(element)
  }

  public dispose() {
    this.destroy()
  }
}

describe('MediaElementPlayer', () => {
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
    const player = new MediaElementPlayer({ media })
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
    const player = new MediaElementPlayer({ media })
    const promise = player.play()
    player.pause()
    rejectPlay(abort)
    await expect(promise).resolves.toBeUndefined()
  })

  test('volume and muted', () => {
    const media = createMedia()
    const player = new MediaElementPlayer({ media })
    player.setVolume(0.5)
    expect(player.getVolume()).toBe(0.5)
    player.setMuted(true)
    expect(player.getMuted()).toBe(true)
  })

  test('setTime clamps to duration', () => {
    const media = createMedia()
    Object.defineProperty(media, 'duration', { configurable: true, value: 10 })
    const player = new MediaElementPlayer({ media })
    player.setTime(-1)
    expect(player.getCurrentTime()).toBe(0)
    player.setTime(11)
    expect(player.getCurrentTime()).toBe(10)
  })

  test('defers a seek until canplay without assigning currentTime during loadedmetadata', () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    const assignedTimes: number[] = []
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        assignedTimes.push(value)
        currentTime = value
      },
    })

    const player = new MediaElementPlayer({ media })
    player.setTime(10)
    expect(assignedTimes).toEqual([])
    expect(player.getCurrentTime()).toBe(10)

    media.dispatchEvent(new Event('loadedmetadata'))
    expect(assignedTimes).toEqual([])

    readyState = 3
    media.dispatchEvent(new Event('canplay'))
    expect(assignedTimes).toEqual([10])
    expect(currentTime).toBe(10)
  })

  test('applies only the latest seek requested before canplay', () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })

    const player = new MediaElementPlayer({ media })
    player.setTime(10)
    player.setTime(20)
    readyState = 3
    media.dispatchEvent(new Event('canplay'))

    expect(currentTime).toBe(20)
  })

  test('does not overwrite an external seek made before canplay', () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })

    const player = new MediaElementPlayer({ media })
    player.setTime(10)
    currentTime = 20
    media.dispatchEvent(new Event('seeking'))
    readyState = 3
    media.dispatchEvent(new Event('canplay'))

    expect(currentTime).toBe(20)
  })

  test('applies a pending seek before play when the media is already playable', async () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })
    media.play.mockImplementation(async () => {
      expect(currentTime).toBe(10)
    })

    const player = new MediaElementPlayer({ media })
    player.setTime(10)
    readyState = 3

    await player.play()

    expect(currentTime).toBe(10)
  })

  test('applies a pending seek when play advances the media to canplay', async () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })
    media.play.mockImplementation(async () => {
      readyState = 3
      media.dispatchEvent(new Event('canplay'))
      expect(currentTime).toBe(10)
    })

    const player = new MediaElementPlayer({ media })
    player.setTime(10)

    await player.play()
    expect(currentTime).toBe(10)
  })

  test('sets currentTime immediately when the media can play', () => {
    const media = createMedia()
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, value: 3 })
    Object.defineProperty(media, 'currentTime', { configurable: true, value: 0, writable: true })

    const player = new MediaElementPlayer({ media })
    player.setTime(10)

    expect(media.currentTime).toBe(10)
  })

  test('clears a pending seek when the source changes', () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })

    const player = new TestPlayer({ media })
    player.setTime(10)
    player.setSource('https://example.com/replacement.mp3')
    readyState = 3
    media.dispatchEvent(new Event('canplay'))

    expect(currentTime).toBe(0)
    expect(player.getCurrentTime()).toBe(0)
  })

  test('clears a pending seek when the media element changes', () => {
    const media = createMedia()
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, value: 0 })
    const replacement = createMedia()
    Object.defineProperty(replacement, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(replacement, 'readyState', { configurable: true, value: 3 })
    Object.defineProperty(replacement, 'currentTime', { configurable: true, value: 0, writable: true })

    const player = new TestPlayer({ media })
    player.setTime(10)
    player.replaceMedia(replacement)
    replacement.dispatchEvent(new Event('canplay'))

    expect(replacement.currentTime).toBe(0)
    expect(player.getCurrentTime()).toBe(0)
  })

  test('clears a pending seek when the player is destroyed', () => {
    const media = createMedia()
    let currentTime = 0
    let readyState = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 100 })
    Object.defineProperty(media, 'readyState', { configurable: true, get: () => readyState })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })

    const player = new TestPlayer({ media })
    player.setTime(10)
    player.dispose()
    readyState = 3
    media.dispatchEvent(new Event('canplay'))

    expect(currentTime).toBe(0)
    expect(player.getCurrentTime()).toBe(0)
  })

  test("the playbackRate 'canplay' listener does not survive destroy with external media", () => {
    const media = createMedia()
    let playbackRate = 1
    Object.defineProperty(media, 'playbackRate', {
      configurable: true,
      get: () => playbackRate,
      set: (value: number) => {
        playbackRate = value
      },
    })

    const player = new MediaElementPlayer({ media, playbackRate: 2 })
    player.destroy()

    // The external media element outlives the player; the one-shot 'canplay'
    // playbackRate listener must have been torn down with mediaScope.
    media.dispatchEvent(new Event('canplay'))
    expect(playbackRate).toBe(1)
  })

  test('setSinkId uses media method', async () => {
    const media = createMedia()
    const player = new MediaElementPlayer({ media })
    await player.setSinkId('id')
    expect(media.setSinkId).toHaveBeenCalledWith('id')
  })

  describe('reactive signals', () => {
    test('exposes isPlayingSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.isPlayingSignal).toBeDefined()
      expect(player.isPlayingSignal.value).toBe(false)
    })

    test('exposes currentTimeSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.currentTimeSignal).toBeDefined()
      expect(player.currentTimeSignal.value).toBe(0)
    })

    test('exposes durationSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.durationSignal).toBeDefined()
      expect(typeof player.durationSignal.value).toBe('number')
    })

    test('exposes volumeSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.volumeSignal).toBeDefined()
      expect(typeof player.volumeSignal.value).toBe('number')
    })

    test('exposes mutedSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.mutedSignal).toBeDefined()
      expect(typeof player.mutedSignal.value).toBe('boolean')
    })

    test('exposes playbackRateSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.playbackRateSignal).toBeDefined()
      expect(typeof player.playbackRateSignal.value).toBe('number')
    })

    test('exposes seekingSignal', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.seekingSignal).toBeDefined()
      expect(player.seekingSignal.value).toBe(false)
    })

    test('isPlayingSignal updates on play event', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.isPlayingSignal.value).toBe(false)
      media.dispatchEvent(new Event('play'))
      expect(player.isPlayingSignal.value).toBe(true)
    })

    test('isPlayingSignal updates on pause event', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      media.dispatchEvent(new Event('play'))
      expect(player.isPlayingSignal.value).toBe(true)
      media.dispatchEvent(new Event('pause'))
      expect(player.isPlayingSignal.value).toBe(false)
    })

    test('isPlayingSignal updates on ended event', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      media.dispatchEvent(new Event('play'))
      expect(player.isPlayingSignal.value).toBe(true)
      media.dispatchEvent(new Event('ended'))
      expect(player.isPlayingSignal.value).toBe(false)
    })

    test('currentTimeSignal updates on timeupdate event', () => {
      const media = createMedia()
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 5.5, writable: true })
      const player = new MediaElementPlayer({ media })
      expect(player.currentTimeSignal.value).toBe(0)
      media.dispatchEvent(new Event('timeupdate'))
      expect(player.currentTimeSignal.value).toBe(5.5)
    })

    test('durationSignal updates on durationchange event', () => {
      const media = createMedia()
      Object.defineProperty(media, 'duration', { configurable: true, value: 120.5, writable: true })
      const player = new MediaElementPlayer({ media })
      media.dispatchEvent(new Event('durationchange'))
      expect(player.durationSignal.value).toBe(120.5)
    })

    test('seekingSignal updates on seeking and seeked events', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      expect(player.seekingSignal.value).toBe(false)
      media.dispatchEvent(new Event('seeking'))
      expect(player.seekingSignal.value).toBe(true)
      media.dispatchEvent(new Event('seeked'))
      expect(player.seekingSignal.value).toBe(false)
    })

    test('volumeSignal and mutedSignal update on volumechange event', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      Object.defineProperty(media, 'volume', { configurable: true, value: 0.7, writable: true })
      Object.defineProperty(media, 'muted', { configurable: true, value: true, writable: true })
      media.dispatchEvent(new Event('volumechange'))
      expect(player.volumeSignal.value).toBe(0.7)
      expect(player.mutedSignal.value).toBe(true)
    })

    test('playbackRateSignal updates on ratechange event', () => {
      const media = createMedia()
      const player = new MediaElementPlayer({ media })
      Object.defineProperty(media, 'playbackRate', { configurable: true, value: 1.5, writable: true })
      media.dispatchEvent(new Event('ratechange'))
      expect(player.playbackRateSignal.value).toBe(1.5)
    })
  })
})

describe('stopAt', () => {
  beforeEach(() => {
    // Deterministic rAF so the stop-at watcher's frames can be flushed by hand
    let id = 0
    const pending = new Map<number, FrameRequestCallback>()
    ;(global as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      pending.set(++id, cb)
      return id
    }
    ;(global as any).cancelAnimationFrame = (i: number) => pending.delete(i)
    ;(global as any).__flushFrames = (n = 1) => {
      for (let k = 0; k < n; k++) {
        const cbs = [...pending.values()]
        pending.clear()
        cbs.forEach((cb) => cb(performance.now()))
      }
    }
  })

  const createPlayingMedia = () => {
    const media = document.createElement('audio') as HTMLMediaElement & { play: jest.Mock; pause: jest.Mock }
    media.play = jest.fn().mockResolvedValue(undefined)
    media.pause = jest.fn()
    let currentTime = 0
    Object.defineProperty(media, 'duration', { configurable: true, value: 10 })
    Object.defineProperty(media, 'readyState', { configurable: true, value: 3 })
    Object.defineProperty(media, 'paused', { configurable: true, value: false })
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
    })
    return media
  }

  test('the rAF watcher pauses and clamps to the stop position when playback overshoots it', () => {
    const media = createPlayingMedia()
    const player = new MediaElementPlayer({ media })

    player.stopAt(5)
    media.currentTime = 5.02
    ;(global as any).__flushFrames(1)

    expect(media.pause).toHaveBeenCalled()
    expect(media.currentTime).toBe(5)
    player.destroy()
  })

  test("the 'timeupdate' bridge enforces the stop too (rAF is suspended in hidden tabs)", () => {
    const media = createPlayingMedia()
    const player = new MediaElementPlayer({ media })

    player.stopAt(5)
    media.currentTime = 6
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.pause).toHaveBeenCalled()
    expect(media.currentTime).toBe(5)
    player.destroy()
  })

  test('a pause cancels the scheduled stop', () => {
    const media = createPlayingMedia()
    const player = new MediaElementPlayer({ media })

    player.stopAt(5)
    media.dispatchEvent(new Event('pause'))
    media.currentTime = 6
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.pause).not.toHaveBeenCalled()
    expect(media.currentTime).toBe(6)
    player.destroy()
  })

  test('an explicit seek cancels the scheduled stop', () => {
    const media = createPlayingMedia()
    const player = new MediaElementPlayer({ media })

    player.stopAt(5)
    player.setTime(1)
    media.currentTime = 6
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.pause).not.toHaveBeenCalled()
    player.destroy()
  })

  test('setting a new source cancels the scheduled stop', () => {
    const media = createPlayingMedia()
    const player = new MediaElementPlayer({ media })

    player.stopAt(5)
    player.setSrc('https://example.com/next.mp3')
    media.currentTime = 6
    media.dispatchEvent(new Event('timeupdate'))

    expect(media.pause).not.toHaveBeenCalled()
    player.destroy()
  })
})

describe('setTime before metadata', () => {
  test('defers the exact requested time instead of NaN when duration is unknown', () => {
    const media = document.createElement('audio')
    // No src: readyState 0, duration NaN -- the pre-metadata state
    expect(Number.isNaN(media.duration)).toBe(true)
    const player = new MediaElementPlayer({ media })

    player.setTime(10)

    // Clamping against NaN duration used to poison the deferred seek
    // (Math.min(10, NaN) === NaN), so getCurrentTime() returned NaN and the
    // canplay handler later assigned media.currentTime = NaN (a TypeError).
    expect(player.getCurrentTime()).toBe(10)

    player.destroy()
  })

  test('still clamps against a known finite duration', () => {
    const media = document.createElement('audio')
    Object.defineProperty(media, 'duration', { configurable: true, value: 5 })
    Object.defineProperty(media, 'readyState', { configurable: true, value: 4 })
    const player = new MediaElementPlayer({ media })

    player.setTime(10)
    expect(player.getCurrentTime()).toBe(5)

    player.destroy()
  })
})
