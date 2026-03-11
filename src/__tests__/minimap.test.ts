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

  wrapperParent.appendChild(wrapper)

  return {
    ...emitter,
    options: { dragToSeek },
    getCurrentTime: jest.fn(() => 12),
    getDecodedData: jest.fn(() => ({
      duration: 30,
      numberOfChannels: 1,
      getChannelData: jest.fn(() => channelData),
    })),
    getDuration: jest.fn(() => 30),
    getRenderer: jest.fn(() => renderer),
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
})
