jest.mock('../wavesurfer.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}))

import MinimapPlugin from '../plugins/minimap.js'
import WaveSurfer from '../wavesurfer.js'

type Listener = (...args: any[]) => void

const createEmitter = () => {
  const listeners = new Map<string, Set<Listener>>()

  return {
    on: jest.fn((event: string, listener: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }

      listeners.get(event)!.add(listener)
      return () => listeners.get(event)?.delete(listener)
    }),
    emit: (event: string, ...args: any[]) => {
      listeners.get(event)?.forEach((listener) => listener(...args))
    },
  }
}

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
})
