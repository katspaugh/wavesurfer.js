jest.mock('../wavesurfer.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}))

import MinimapPlugin from '../plugins/minimap.js'
import WaveSurfer from '../wavesurfer.js'
import { createEmitter } from './helpers/create-emitter.js'

const createMiniWaveSurfer = (duration = 30) => {
  const emitter = createEmitter()
  const renderer = { renderProgress: jest.fn() }

  return {
    ...emitter,
    destroy: jest.fn(() => emitter.emit('destroy')),
    getDuration: jest.fn(() => duration),
    getRenderer: jest.fn(() => renderer),
    setTime: jest.fn(),
    renderer,
  }
}

const createMainWaveSurfer = (dragToSeek: boolean | { debounceTime: number } = true) => {
  const emitter = createEmitter()
  const wrapperParent = document.createElement('div')
  const wrapper = document.createElement('div')
  const renderer = { renderProgress: jest.fn() }
  const channelData = new Float32Array([0, 1, -1])
  let scroll = 0
  let width = 200
  let wrapperWidth = 500

  Object.defineProperty(wrapper, 'clientWidth', {
    configurable: true,
    get: () => wrapperWidth,
  })

  wrapperParent.appendChild(wrapper)

  return {
    ...emitter,
    __setScroll: (value: number) => {
      scroll = value
    },
    __setWidth: (value: number) => {
      width = value
    },
    __setWrapperWidth: (value: number) => {
      wrapperWidth = value
    },
    options: { dragToSeek },
    getCurrentTime: jest.fn(() => 12),
    getDecodedData: jest.fn(() => ({
      duration: 30,
      numberOfChannels: 1,
      getChannelData: jest.fn(() => channelData),
    })),
    getDuration: jest.fn(() => 30),
    getRenderer: jest.fn(() => renderer),
    getScroll: jest.fn(() => scroll),
    getWidth: jest.fn(() => width),
    getWrapper: jest.fn(() => wrapper),
    isPlaying: jest.fn(() => false),
    seekTo: jest.fn(),
    renderer,
  }
}

const createMock = WaveSurfer.create as jest.Mock

const createInitializedMinimap = async () => {
  const miniWaveSurfer = createMiniWaveSurfer()
  const mainWaveSurfer = createMainWaveSurfer()

  createMock.mockReturnValue(miniWaveSurfer)

  const plugin = MinimapPlugin.create({ height: 20 })
  plugin._init(mainWaveSurfer as any)
  await Promise.resolve()

  return { plugin, miniWaveSurfer, mainWaveSurfer }
}

describe('MinimapPlugin', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  test('renders the minimap from peaks without sharing the main media element', async () => {
    const miniWaveSurfer = createMiniWaveSurfer()
    const mainWaveSurfer = createMainWaveSurfer()

    createMock.mockReturnValue(miniWaveSurfer)

    const plugin = MinimapPlugin.create({ height: 20 })
    plugin._init(mainWaveSurfer as any)
    await Promise.resolve()

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        container: expect.any(HTMLElement),
        duration: 30,
        media: undefined,
        url: undefined,
      }),
    )
    expect(createMock.mock.calls[0][0].peaks).toEqual([new Float32Array([0, 1, -1])])

    mainWaveSurfer.emit('timeupdate', 5)
    expect(miniWaveSurfer.setTime).toHaveBeenLastCalledWith(5)

    mainWaveSurfer.emit('drag', 0.25)
    expect(miniWaveSurfer.renderer.renderProgress).toHaveBeenCalledWith(0.25, false)
  })

  test('syncs the main waveform immediately when interacting with the minimap', async () => {
    jest.useFakeTimers()

    const miniWaveSurfer = createMiniWaveSurfer()
    const mainWaveSurfer = createMainWaveSurfer(true)

    createMock.mockReturnValue(miniWaveSurfer)

    const plugin = MinimapPlugin.create({ dragToSeek: true })
    plugin._init(mainWaveSurfer as any)
    await Promise.resolve()

    miniWaveSurfer.emit('click', 0.5, 0.1)
    expect(mainWaveSurfer.seekTo).toHaveBeenCalledWith(0.5)

    miniWaveSurfer.emit('drag', 0.75)
    expect(mainWaveSurfer.renderer.renderProgress).toHaveBeenCalledWith(0.75, false)

    jest.advanceTimersByTime(200)
    expect(mainWaveSurfer.seekTo).toHaveBeenLastCalledWith(0.75)
  })

  test('keeps the overlay contained while redraw and scroll updates are catching up during zoom-out', async () => {
    const miniWaveSurfer = createMiniWaveSurfer()
    const mainWaveSurfer = createMainWaveSurfer()

    createMock.mockReturnValue(miniWaveSurfer)

    const plugin = MinimapPlugin.create({ height: 20 })
    plugin._init(mainWaveSurfer as any)
    await Promise.resolve()

    const minimapContainer = createMock.mock.calls[0][0].container as HTMLElement
    const overlay = minimapContainer.querySelector('[part="minimap-overlay"]') as HTMLElement

    expect(overlay.style.transition).toBe('left 100ms ease-out, width 100ms ease-out')

    mainWaveSurfer.__setScroll(180)
    mainWaveSurfer.emit('redraw')
    mainWaveSurfer.emit('scroll', 10.8, 22.8, 180, 380)

    mainWaveSurfer.__setScroll(300)
    mainWaveSurfer.__setWrapperWidth(400)
    mainWaveSurfer.emit('redraw')

    expect(overlay.style.left).toBe('75%')
    expect(overlay.style.width).toBe('25%')

    mainWaveSurfer.__setScroll(200)
    mainWaveSurfer.emit('scroll', 15, 30, 200, 400)

    expect(overlay.style.left).toBe('50%')
    expect(overlay.style.width).toBe('50%')
  })

  test('does not re-emit destroy when the nested wavesurfer is recreated', async () => {
    const { plugin, mainWaveSurfer } = await createInitializedMinimap()
    const onDestroy = jest.fn()
    plugin.on('destroy', onDestroy)
    // `destroyMinimap()` is now a private setup-closure, not an instance
    // method — drive the same recreate-the-nested-wavesurfer path through
    // its public trigger (a 'decode' event) instead of poking a private
    // internal directly. Same observable assertion as before.
    mainWaveSurfer.emit('decode', 30)
    await Promise.resolve()
    expect(onDestroy).not.toHaveBeenCalled()
  })

  describe('placement and styling', () => {
    afterEach(() => {
      document.body.innerHTML = ''
    })

    const attachMainWaveSurfer = () => {
      const mainWaveSurfer = createMainWaveSurfer()
      const host = document.createElement('div')
      const wrapperParent = mainWaveSurfer.getWrapper().parentElement as HTMLElement
      host.appendChild(wrapperParent)
      document.body.appendChild(host)
      createMock.mockReturnValue(createMiniWaveSurfer())
      return { mainWaveSurfer, wrapperParent }
    }

    test('inserts the minimap right after the main waveform container by default', () => {
      const { mainWaveSurfer, wrapperParent } = attachMainWaveSurfer()

      MinimapPlugin.create()._init(mainWaveSurfer as any)

      expect(wrapperParent.nextElementSibling?.getAttribute('part')).toBe('minimap')
    })

    test('honors insertPosition', () => {
      const { mainWaveSurfer, wrapperParent } = attachMainWaveSurfer()

      MinimapPlugin.create({ insertPosition: 'beforebegin' })._init(mainWaveSurfer as any)

      expect(wrapperParent.previousElementSibling?.getAttribute('part')).toBe('minimap')
      expect(wrapperParent.nextElementSibling).toBeNull()
    })

    test('appends the minimap to a container element', () => {
      const { mainWaveSurfer, wrapperParent } = attachMainWaveSurfer()
      const target = document.createElement('section')
      document.body.appendChild(target)

      MinimapPlugin.create({ container: target })._init(mainWaveSurfer as any)

      expect(target.lastElementChild?.getAttribute('part')).toBe('minimap')
      expect(wrapperParent.nextElementSibling).toBeNull()
    })

    test('appends the minimap to a container given as a selector', () => {
      const { mainWaveSurfer } = attachMainWaveSurfer()
      const target = document.createElement('div')
      target.id = 'minimap-target'
      document.body.appendChild(target)

      MinimapPlugin.create({ container: '#minimap-target' })._init(mainWaveSurfer as any)

      expect(target.querySelector('[part="minimap"]')).not.toBeNull()
    })

    test('silently leaves the minimap detached when the container selector matches nothing', async () => {
      const { mainWaveSurfer, wrapperParent } = attachMainWaveSurfer()

      expect(() => MinimapPlugin.create({ container: '#does-not-exist' })._init(mainWaveSurfer as any)).not.toThrow()
      await Promise.resolve()

      expect(document.querySelector('[part="minimap"]')).toBeNull()
      expect(wrapperParent.nextElementSibling).toBeNull()
      // The nested wavesurfer is still created, inside the detached minimap wrapper.
      const minimapWrapper = createMock.mock.calls[0][0].container as HTMLElement
      expect(minimapWrapper.getAttribute('part')).toBe('minimap')
      expect(minimapWrapper.isConnected).toBe(false)
    })

    test('uses the default overlay color and honors overlayColor', () => {
      const { mainWaveSurfer } = attachMainWaveSurfer()

      MinimapPlugin.create()._init(mainWaveSurfer as any)
      MinimapPlugin.create({ container: document.body, overlayColor: 'red' })._init(mainWaveSurfer as any)

      const overlays = document.querySelectorAll<HTMLElement>('[part="minimap-overlay"]')
      expect(overlays).toHaveLength(2)
      expect(overlays[0].style.backgroundColor).toBe('rgba(100, 100, 100, 0.1)')
      expect(overlays[1].style.backgroundColor).toBe('red')
    })

    test('passes its own options to the nested wavesurfer with the default height', async () => {
      const { mainWaveSurfer } = attachMainWaveSurfer()

      MinimapPlugin.create({ waveColor: 'blue' })._init(mainWaveSurfer as any)
      await Promise.resolve()

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ height: 50, waveColor: 'blue', minPxPerSec: 0, fillParent: true }),
      )
    })

    test('removes the minimap from the DOM and destroys the nested wavesurfer on destroy', async () => {
      const { mainWaveSurfer, wrapperParent } = attachMainWaveSurfer()
      const miniWaveSurfer = createMiniWaveSurfer()
      createMock.mockReturnValue(miniWaveSurfer)

      const plugin = MinimapPlugin.create()
      plugin._init(mainWaveSurfer as any)
      await Promise.resolve()

      plugin.destroy()

      expect(wrapperParent.nextElementSibling).toBeNull()
      expect(miniWaveSurfer.destroy).toHaveBeenCalledTimes(1)
    })
  })

  describe('initialization', () => {
    test('does not create the nested wavesurfer before the audio is decoded', async () => {
      const mainWaveSurfer = createMainWaveSurfer()
      mainWaveSurfer.getDecodedData.mockReturnValue(null as any)

      MinimapPlugin.create()._init(mainWaveSurfer as any)
      await Promise.resolve()

      expect(createMock).not.toHaveBeenCalled()
    })

    test('does not create the nested wavesurfer when destroyed before the init microtask runs', async () => {
      const mainWaveSurfer = createMainWaveSurfer()
      createMock.mockReturnValue(createMiniWaveSurfer())

      const plugin = MinimapPlugin.create()
      plugin._init(mainWaveSurfer as any)
      plugin.destroy()
      await Promise.resolve()

      expect(createMock).not.toHaveBeenCalled()
    })

    test('passes one peaks array per decoded channel', async () => {
      const mainWaveSurfer = createMainWaveSurfer()
      const left = new Float32Array([0.1])
      const right = new Float32Array([0.2])
      mainWaveSurfer.getDecodedData.mockReturnValue({
        duration: 30,
        numberOfChannels: 2,
        getChannelData: jest.fn((i: number) => (i === 0 ? left : right)),
      } as any)
      createMock.mockReturnValue(createMiniWaveSurfer())

      MinimapPlugin.create()._init(mainWaveSurfer as any)
      await Promise.resolve()

      expect(createMock.mock.calls[0][0].peaks).toEqual([left, right])
    })

    test('recreates the nested wavesurfer on decode, destroying the previous one', async () => {
      const { mainWaveSurfer, miniWaveSurfer } = await createInitializedMinimap()
      const nextMini = createMiniWaveSurfer()
      createMock.mockReturnValue(nextMini)

      mainWaveSurfer.emit('decode', 30)

      expect(miniWaveSurfer.destroy).toHaveBeenCalledTimes(1)
      expect(createMock).toHaveBeenCalledTimes(2)

      // Events from the old instance are no longer handled; the new one is wired up.
      miniWaveSurfer.emit('click', 0.1, 0)
      expect(mainWaveSurfer.seekTo).not.toHaveBeenCalled()
      nextMini.emit('click', 0.2, 0)
      expect(mainWaveSurfer.seekTo).toHaveBeenCalledWith(0.2)
    })
  })

  describe('position sync', () => {
    test('sets the initial minimap time from the main waveform', async () => {
      const { miniWaveSurfer } = await createInitializedMinimap()

      expect(miniWaveSurfer.setTime).toHaveBeenCalledWith(12)
    })

    test('renders progress directly while the nested wavesurfer has no duration yet', async () => {
      const miniWaveSurfer = createMiniWaveSurfer(0)
      const mainWaveSurfer = createMainWaveSurfer()
      createMock.mockReturnValue(miniWaveSurfer)

      MinimapPlugin.create()._init(mainWaveSurfer as any)
      await Promise.resolve()

      mainWaveSurfer.emit('timeupdate', 6)

      expect(miniWaveSurfer.setTime).not.toHaveBeenCalled()
      expect(miniWaveSurfer.renderer.renderProgress).toHaveBeenLastCalledWith(6 / 30, false)
    })

    test('passes the main playing state when rendering minimap progress', async () => {
      const { miniWaveSurfer, mainWaveSurfer } = await createInitializedMinimap()
      mainWaveSurfer.isPlaying.mockReturnValue(true)

      mainWaveSurfer.emit('drag', 0.4)

      expect(miniWaveSurfer.renderer.renderProgress).toHaveBeenLastCalledWith(0.4, true)
    })

    test('does not sync while the main waveform has no duration', async () => {
      const { miniWaveSurfer, mainWaveSurfer } = await createInitializedMinimap()
      miniWaveSurfer.setTime.mockClear()
      mainWaveSurfer.getDuration.mockReturnValue(0)

      mainWaveSurfer.emit('timeupdate', 6)

      expect(miniWaveSurfer.setTime).not.toHaveBeenCalled()
      expect(miniWaveSurfer.renderer.renderProgress).not.toHaveBeenCalled()
    })

    test('ignores main waveform drags and time updates before the minimap exists', () => {
      const mainWaveSurfer = createMainWaveSurfer()

      MinimapPlugin.create()._init(mainWaveSurfer as any)

      expect(() => {
        mainWaveSurfer.emit('drag', 0.4)
        mainWaveSurfer.emit('timeupdate', 6)
      }).not.toThrow()
    })

    test('re-syncs the position and emits ready when the nested wavesurfer is ready', async () => {
      const { plugin, miniWaveSurfer, mainWaveSurfer } = await createInitializedMinimap()
      const onReady = jest.fn()
      plugin.on('ready', onReady)
      miniWaveSurfer.setTime.mockClear()
      mainWaveSurfer.getCurrentTime.mockReturnValue(7)

      miniWaveSurfer.emit('ready')

      expect(miniWaveSurfer.setTime).toHaveBeenCalledWith(7)
      expect(onReady).toHaveBeenCalledTimes(1)
    })

    test('syncs to 0 on ready when the main current time is not a number yet', async () => {
      const { miniWaveSurfer, mainWaveSurfer } = await createInitializedMinimap()
      miniWaveSurfer.setTime.mockClear()
      mainWaveSurfer.getCurrentTime.mockReturnValue(NaN)

      miniWaveSurfer.emit('ready')

      expect(miniWaveSurfer.setTime).toHaveBeenCalledWith(0)
    })
  })

  describe('events', () => {
    test('re-emits click and drag from the nested wavesurfer', async () => {
      const { plugin, miniWaveSurfer } = await createInitializedMinimap()
      const onClick = jest.fn()
      const onDrag = jest.fn()
      plugin.on('click', onClick)
      plugin.on('drag', onDrag)

      miniWaveSurfer.emit('click', 0.3, 0.6)
      miniWaveSurfer.emit('drag', 0.4)

      expect(onClick).toHaveBeenCalledWith(0.3, 0.6)
      expect(onDrag).toHaveBeenCalledWith(0.4)
    })

    test.each([
      ['timeupdate', [3]],
      ['seeking', [4]],
      ['dblclick', [0.1, 0.2]],
      ['interaction', []],
    ])('forwards %s from the nested wavesurfer', async (event, args) => {
      const { plugin, miniWaveSurfer } = await createInitializedMinimap()
      const listener = jest.fn()
      plugin.on(event as any, listener)

      miniWaveSurfer.emit(event, ...args)

      expect(listener).toHaveBeenCalledWith(...args)
    })
  })

  describe('drag to seek', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    const initWith = async (dragToSeek: unknown, playing = false) => {
      const miniWaveSurfer = createMiniWaveSurfer()
      const mainWaveSurfer = createMainWaveSurfer()
      mainWaveSurfer.isPlaying.mockReturnValue(playing)
      createMock.mockReturnValue(miniWaveSurfer)

      const plugin = MinimapPlugin.create({ dragToSeek } as any)
      plugin._init(mainWaveSurfer as any)
      await Promise.resolve()

      return { plugin, miniWaveSurfer, mainWaveSurfer }
    }

    test('uses a custom debounceTime', async () => {
      const { miniWaveSurfer, mainWaveSurfer } = await initWith({ debounceTime: 50 })

      miniWaveSurfer.emit('drag', 0.6)
      jest.advanceTimersByTime(49)
      expect(mainWaveSurfer.seekTo).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(mainWaveSurfer.seekTo).toHaveBeenCalledWith(0.6)
    })

    test('falls back to 200ms when the dragToSeek object has no debounceTime', async () => {
      const { miniWaveSurfer, mainWaveSurfer } = await initWith({})

      miniWaveSurfer.emit('drag', 0.6)
      jest.advanceTimersByTime(199)
      expect(mainWaveSurfer.seekTo).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(mainWaveSurfer.seekTo).toHaveBeenCalledWith(0.6)
    })

    test.each([
      ['dragToSeek is off', undefined, false],
      ['the main waveform is playing', true, true],
    ])('seeks without a debounce when %s', async (_label, dragToSeek, playing) => {
      const { miniWaveSurfer, mainWaveSurfer } = await initWith(dragToSeek, playing)

      miniWaveSurfer.emit('drag', 0.6)
      expect(mainWaveSurfer.renderer.renderProgress).toHaveBeenCalledWith(0.6, playing)
      jest.advanceTimersByTime(0)

      expect(mainWaveSurfer.seekTo).toHaveBeenCalledWith(0.6)
    })

    test('only seeks to the latest position when drags arrive within the debounce window', async () => {
      const { miniWaveSurfer, mainWaveSurfer } = await initWith(true)

      miniWaveSurfer.emit('drag', 0.2)
      jest.advanceTimersByTime(100)
      miniWaveSurfer.emit('drag', 0.3)
      jest.advanceTimersByTime(200)

      expect(mainWaveSurfer.seekTo).toHaveBeenCalledTimes(1)
      expect(mainWaveSurfer.seekTo).toHaveBeenCalledWith(0.3)
    })

    test('cancels a pending debounced seek on destroy', async () => {
      const { plugin, miniWaveSurfer, mainWaveSurfer } = await initWith(true)

      miniWaveSurfer.emit('drag', 0.2)
      plugin.destroy()
      jest.advanceTimersByTime(500)

      expect(mainWaveSurfer.seekTo).not.toHaveBeenCalled()
    })
  })

  describe('overlay', () => {
    const getOverlay = () =>
      (createMock.mock.calls[0][0].container as HTMLElement).querySelector('[part="minimap-overlay"]') as HTMLElement

    test('does not move the overlay while the main waveform has no duration', async () => {
      const { mainWaveSurfer } = await createInitializedMinimap()
      mainWaveSurfer.getDuration.mockReturnValue(0)

      mainWaveSurfer.emit('redraw')
      mainWaveSurfer.emit('scroll', 5, 10, 0, 0)

      expect(getOverlay().style.left).toBe('0px')
      expect(getOverlay().style.width).toBe('')
    })

    test('covers the whole minimap when the main wrapper has no width yet', async () => {
      const { mainWaveSurfer } = await createInitializedMinimap()
      mainWaveSurfer.__setWrapperWidth(0)

      mainWaveSurfer.emit('redraw')

      expect(getOverlay().style.left).toBe('0%')
      expect(getOverlay().style.width).toBe('100%')
    })

    test('clamps scroll ranges that fall outside the audio', async () => {
      const { mainWaveSurfer } = await createInitializedMinimap()

      mainWaveSurfer.emit('scroll', -5, 45, 0, 0)
      expect(getOverlay().style.left).toBe('0%')
      expect(getOverlay().style.width).toBe('100%')

      // An end before the start collapses to an empty overlay at the start.
      mainWaveSurfer.emit('scroll', 15, 10, 0, 0)
      expect(getOverlay().style.left).toBe('50%')
      expect(getOverlay().style.width).toBe('0%')
    })
  })
})
