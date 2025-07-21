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
    let rejectPlay: (reason?: unknown) => void
    const media = createMedia()
    media.play = jest.fn(() => new Promise((_, reject) => {
      rejectPlay = reject
    }))
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
})
