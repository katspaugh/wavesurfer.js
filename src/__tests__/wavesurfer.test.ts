jest.mock('../renderer.js', () => {
  const { signal } = jest.requireActual('../reactive/store.js')
  let lastInstance: any
  class Renderer {
    options: any
    wrapper = document.createElement('div')
    renderProgress = jest.fn()
    on = jest.fn(() => () => undefined)
    setOptions = jest.fn()
    getWrapper = jest.fn(() => this.wrapper)
    getWidth = jest.fn(() => 100)
    getScroll = jest.fn(() => 0)
    setScroll = jest.fn()
    setScrollPercentage = jest.fn()
    render = jest.fn()
    zoom = jest.fn()
    exportImage = jest.fn(() => [])
    destroy = jest.fn()
    // Reactive streams
    click$ = signal(null)
    dblclick$ = signal(null)
    drag$ = signal(null)
    resize$ = signal(null)
    render$ = signal(null)
    rendered$ = signal(null)
    scrollStream = null
    constructor(options: any) {
      this.options = options
      lastInstance = this
    }
  }
  return { __esModule: true, default: Renderer, getLastInstance: () => lastInstance }
})

jest.mock('../decoder.js', () => {
  const createBuffer = jest.fn((data: any[], duration: number) => ({
    duration,
    numberOfChannels: data.length,
    getChannelData: (i: number) => Float32Array.from(data[i] as number[]),
  }))
  return { __esModule: true, default: { decode: jest.fn(), createBuffer } }
})
import WaveSurfer from '../wavesurfer.js'
import { BasePlugin } from '../base-plugin.js'
import * as RendererModule from '../renderer.js'
const getRenderer = (RendererModule as any).getLastInstance as () => any

const createMedia = () => {
  const media = document.createElement('audio') as HTMLMediaElement & { play: jest.Mock; pause: jest.Mock }
  media.play = jest.fn().mockResolvedValue(undefined)
  media.pause = jest.fn()
  Object.defineProperty(media, 'duration', { configurable: true, value: 100, writable: true })
  return media
}

const createWs = (opts: any = {}) => {
  const container = document.createElement('div')
  return WaveSurfer.create({ container, media: createMedia(), ...opts })
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('WaveSurfer public methods', () => {
  test('create returns instance', () => {
    const ws = createWs()
    expect(ws).toBeInstanceOf(WaveSurfer)
  })

  test('setOptions merges options and updates renderer', () => {
    const ws = createWs()
    ws.setOptions({ height: 200, audioRate: 2, mediaControls: true })
    const renderer = getRenderer()
    expect(ws.options.height).toBe(200)
    expect(renderer.setOptions).toHaveBeenCalledWith(ws.options)
    expect(ws.getPlaybackRate()).toBe(2)
    expect(ws.getMediaElement().controls).toBe(true)
  })

  test('registerPlugin adds and removes plugin', () => {
    const ws = createWs()
    class TestPlugin extends BasePlugin<{ destroy: [] }, {}> {}
    const plugin = new TestPlugin({})
    ws.registerPlugin(plugin)
    expect(ws.getActivePlugins()).toContain(plugin)
    plugin.destroy()
    expect(ws.getActivePlugins()).not.toContain(plugin)
  })

  test('wrapper and scroll helpers call renderer', () => {
    const ws = createWs()
    const renderer = getRenderer()
    ws.getWrapper()
    expect(renderer.getWrapper).toHaveBeenCalled()
    ws.getWidth()
    expect(renderer.getWidth).toHaveBeenCalled()
    ws.getScroll()
    expect(renderer.getScroll).toHaveBeenCalled()
    ws.setScroll(42)
    expect(renderer.setScroll).toHaveBeenCalledWith(42)
    jest.spyOn(ws, 'getDuration').mockReturnValue(10)
    ws.setScrollTime(5)
    expect(renderer.setScrollPercentage).toHaveBeenCalledWith(0.5)
  })

  test('load and loadBlob call loadAudio', async () => {
    const ws = createWs()
    const spy = jest.spyOn(ws as any, 'loadAudio').mockResolvedValue(undefined)
    await ws.load('url')
    expect(spy).toHaveBeenCalledWith('url', undefined, undefined, undefined)
    const blob = new Blob([])
    await ws.loadBlob(blob)
    expect(spy).toHaveBeenCalledWith('', blob, undefined, undefined)
  })

  test('zoom requires decoded data', () => {
    const ws = createWs()
    expect(() => ws.zoom(10)).toThrow()
    ;(ws as any).decodedData = { duration: 1 }
    ws.zoom(10)
    expect(getRenderer().zoom).toHaveBeenCalledWith(10)
  })

  test('getDecodedData returns buffer', () => {
    const ws = createWs()
    ;(ws as any).decodedData = 123 as any
    expect(ws.getDecodedData()).toBe(123)
  })

  test('exportPeaks reads data from buffer', () => {
    const ws = createWs()
    ;(ws as any).decodedData = {
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([0, 1, -1]),
      duration: 3,
    }
    const peaks = ws.exportPeaks({ maxLength: 3, precision: 100 })
    expect(peaks[0]).toEqual([0, 1, -1])
  })

  test('getDuration falls back to decoded data', () => {
    const ws = createWs()
    const media = ws.getMediaElement()
    Object.defineProperty(media, 'duration', { configurable: true, value: Infinity })
    ;(ws as any).decodedData = { duration: 2 }
    expect(ws.getDuration()).toBe(2)
  })

  test('toggleInteraction sets option', () => {
    const ws = createWs()
    ws.toggleInteraction(false)
    expect(ws.options.interact).toBe(false)
  })

  test('setTime updates state and emits event', () => {
    const ws = createWs()
    const spy = jest.fn()
    ws.on('timeupdate', spy)
    ws.setTime(1)
    expect(spy).toHaveBeenCalledWith(1)
    // setTime now updates reactive state instead of calling renderProgress directly
    expect((ws as any).wavesurferState.currentTime.value).toBe(1)
  })

  test('seekTo calculates correct time', () => {
    const ws = createWs()
    jest.spyOn(ws, 'getDuration').mockReturnValue(10)
    const setTimeSpy = jest.spyOn(ws, 'setTime')
    ws.seekTo(0.5)
    expect(setTimeSpy).toHaveBeenCalledWith(5)
  })

  test('play sets start and end', async () => {
    const ws = createWs()
    const spy = jest.spyOn(ws, 'setTime')
    await ws.play(2, 4)
    expect(spy).toHaveBeenCalledWith(2)
    expect((ws as any).stopAtPosition).toBe(4)
  })

  test('playPause toggles play and pause', async () => {
    const ws = createWs()
    const media = ws.getMediaElement()
    await ws.playPause()
    expect(media.play).toHaveBeenCalled()
    Object.defineProperty(media, 'paused', { configurable: true, value: false })
    await ws.playPause()
    expect(media.pause).toHaveBeenCalled()
  })

  test('stop resets time', () => {
    const ws = createWs()
    ws.setTime(5)
    ws.stop()
    expect(ws.getCurrentTime()).toBe(0)
  })

  test('skip and empty', () => {
    const ws = createWs()
    ws.getMediaElement().currentTime = 1
    const spy = jest.spyOn(ws, 'setTime')
    ws.skip(2)
    expect(spy).toHaveBeenCalledWith(3)
    const loadSpy = jest.spyOn(ws, 'load').mockResolvedValue(undefined)
    ws.empty()
    expect(loadSpy).toHaveBeenCalledWith('', [[0]], 0.001)
  })

  test('setMediaElement reinitializes events', () => {
    const ws = createWs()
    const unsub = jest.spyOn(ws as any, 'unsubscribePlayerEvents')
    const init = jest.spyOn(ws as any, 'initPlayerEvents')
    const el = createMedia()
    ws.setMediaElement(el)
    expect(unsub).toHaveBeenCalled()
    expect(init).toHaveBeenCalled()
    expect(ws.getMediaElement()).toBe(el)
  })

  test('exportImage uses renderer', async () => {
    const ws = createWs()
    await ws.exportImage('image/png', 1, 'dataURL')
    expect(getRenderer().exportImage).toHaveBeenCalled()
  })

  test('destroy cleans up renderer', () => {
    const ws = createWs()
    ws.destroy()
    expect(getRenderer().destroy).toHaveBeenCalled()
  })
})
