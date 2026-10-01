import SpectrogramPlugin from '../plugins/spectrogram.js'
import { createEmitter } from './helpers/create-emitter.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'

beforeAll(() => {
  ;(globalThis as any).Worker = function Worker() {}
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('SpectrogramPlugin external container', () => {
  it('matches the waveform width and scroll position when rendered outside the waveform', () => {
    const waveformWrapper = document.createElement('div')
    let waveformWidth = 1200
    Object.defineProperty(waveformWrapper, 'offsetWidth', {
      configurable: true,
      get: () => waveformWidth,
    })

    let scrollLeft = 200
    const events = createEmitter()
    const wavesurfer = createFakeWaveSurfer({
      getWrapper: () => waveformWrapper,
      getScroll: () => scrollLeft,
      on: events.on,
      options: { fillParent: true },
    } as any)

    const externalContainer = document.createElement('div')
    document.body.appendChild(externalContainer)

    const plugin = SpectrogramPlugin.create({ container: externalContainer })
    plugin._init(wavesurfer)

    const spectrogramWrapper = externalContainer.firstElementChild as HTMLElement
    expect(spectrogramWrapper.style.width).toBe('1200px')
    expect(spectrogramWrapper.style.transform).toBe('translateX(-200px)')

    scrollLeft = 640
    events.emit('scroll', 2, 4, scrollLeft, scrollLeft + 400)
    expect(spectrogramWrapper.style.transform).toBe('translateX(-640px)')

    waveformWidth = 1600
    events.emit('redraw')
    expect(spectrogramWrapper.style.width).toBe('1600px')
    expect(spectrogramWrapper.style.transform).toBe('translateX(-640px)')

    plugin.destroy()
  })

  it('keeps the default waveform container in its existing coordinate system', () => {
    const waveformWrapper = document.createElement('div')
    const events = createEmitter()
    const wavesurfer = createFakeWaveSurfer({
      getWrapper: () => waveformWrapper,
      getScroll: () => 200,
      on: events.on,
      options: { fillParent: true },
    } as any)

    const plugin = SpectrogramPlugin.create({})
    plugin._init(wavesurfer)

    const spectrogramWrapper = waveformWrapper.firstElementChild as HTMLElement
    expect(spectrogramWrapper.style.width).toBe('100%')
    expect(spectrogramWrapper.style.transform).toBe('')

    events.emit('scroll', 0, 1, 200, 600)
    expect(spectrogramWrapper.style.transform).toBe('')

    plugin.destroy()
  })
})
