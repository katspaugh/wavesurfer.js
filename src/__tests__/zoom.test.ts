import ZoomPlugin from '../plugins/zoom.js'
import { signal } from '../reactive/store.js'
import { createEmitter } from './helpers/create-emitter.js'

const createWaveSurfer = (container: HTMLElement, wrapper: HTMLElement, durationValue: number) => {
  const duration = signal(durationValue)
  const zoom = signal(0)

  return {
    duration,
    wavesurfer: {
      ...createEmitter(),
      options: { minPxPerSec: 50 },
      getDuration: jest.fn(() => duration.value),
      getScroll: jest.fn(() => 0),
      getState: jest.fn(() => ({ zoom, duration })),
      getWrapper: jest.fn(() => wrapper),
      zoom: jest.fn(),
    },
  }
}

const createDom = (containerWidth = 100) => {
  const container = document.createElement('div')
  const wrapper = document.createElement('div')
  container.appendChild(wrapper)
  document.body.appendChild(container)

  Object.defineProperty(container, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0 }),
  })
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: containerWidth })

  let scrollLeftValue = 0
  Object.defineProperty(container, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeftValue,
    set: (value: number) => {
      scrollLeftValue = value
    },
  })

  return { container, wrapper }
}

describe('ZoomPlugin', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  // The pre-port class computed a missing `maxZoom` once from the
  // container width and kept it on the long-lived `this.options` for the
  // plugin instance's lifetime, even
  // across a destroy -> re-init cycle. The port recomputes it fresh from
  // the CURRENT container width on every (re-)init instead — this is a
  // deliberate, disclosed behavior change (see the comment in zoom.ts).
  // This test pins the new behavior via the only externally observable
  // effect of `maxZoom`: it caps the pixels-per-second value passed to
  // `wavesurfer.zoom()`.
  test('derives the default maxZoom from the live container width on each re-init, not cached across destroy', () => {
    const container = document.createElement('div')
    const wrapper = document.createElement('div')
    container.appendChild(wrapper)
    document.body.appendChild(container)

    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0 }),
    })
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 100 })

    const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

    const plugin = ZoomPlugin.create()
    plugin._init(wavesurfer as any)

    // A large wheel delta pushes the linear zoom calculation well past 100
    // px/s, so the value actually applied is clamped at maxZoom. With
    // duration=10 and width=100, 100 * 10 >= 100, so onWheel's "else"
    // branch (`wavesurfer.zoom(newMinPxPerSec)`) fires with the clamped
    // value directly.
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000, deltaX: 0 }))
    expect(wavesurfer.zoom).toHaveBeenLastCalledWith(100)

    plugin.destroy()

    // Resize the container between destroy and re-init.
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 300 })
    wavesurfer.zoom.mockClear()

    plugin._init(wavesurfer as any)
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000, deltaX: 0 }))

    // If maxZoom had been cached from the first init (the pre-port
    // behavior), this would still be clamped at 100.
    expect(wavesurfer.zoom).toHaveBeenLastCalledWith(300)
  })

  test('lets the page scroll (no preventDefault, no zoom) before the audio is decoded', () => {
    const { container, wrapper } = createDom()
    const { wavesurfer } = createWaveSurfer(container, wrapper, 0)

    const plugin = ZoomPlugin.create()
    plugin._init(wavesurfer as any)

    const event = new WheelEvent('wheel', { deltaY: -100, deltaX: 0, cancelable: true })
    container.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(wavesurfer.zoom).not.toHaveBeenCalled()
  })

  test('re-derives the pointer anchor from the current scroll after an external scroll at the same x', () => {
    const { container, wrapper } = createDom()
    const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

    const plugin = ZoomPlugin.create()
    plugin._init(wavesurfer as any)

    // First wheel step at x=50: anchor time = (scroll 0 + 50) / 50 px/s = 1s.
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0, clientX: 50 }))

    // newMinPxPerSec = min(50 + 10 * 0.5, maxZoom 100) = 55
    expect(wavesurfer.zoom).toHaveBeenLastCalledWith(55)
    expect(container.scrollLeft).toBeCloseTo((1 - (100 / 55) * (50 / 100)) * 55)

    // The container is scrolled externally (not by the plugin).
    wavesurfer.getScroll.mockReturnValue(200)

    // A wheel event at the SAME x must anchor at the newly visible time
    // (scroll 200 + x 50) / 50 px/s = 5s — not reuse the stale cached anchor.
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0, clientX: 50 }))

    expect(container.scrollLeft).toBeCloseTo((5 - (100 / 55) * (50 / 100)) * 55)
  })

  test('iterations: 1 zooms in a single step instead of dividing by zero', () => {
    const { container, wrapper } = createDom()
    Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 800 })
    const { wavesurfer } = createWaveSurfer(container, wrapper, 4)
    wavesurfer.options.minPxPerSec = 300

    const plugin = ZoomPlugin.create({ exponentialZooming: true, iterations: 1, maxZoom: 400 })
    plugin._init(wavesurfer as any)

    // startZoom = wrapper width 800 / duration 4 = 200; a zoom-out step with a
    // single iteration applies the full ratio startZoom/endZoom = 0.5 once:
    // 300 * 0.5 = 150. The divide-by-zero exponent (1 / (1 - 1)) collapsed the
    // zoom to 0 instead, snapping straight to fit-to-width.
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: 1000, deltaX: 0 }))

    expect(wavesurfer.zoom).toHaveBeenLastCalledWith(150)
  })

  test('resets the exponential zoom baseline when new audio loads', () => {
    const { container, wrapper } = createDom()
    Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 100 })
    const { duration, wavesurfer } = createWaveSurfer(container, wrapper, 10)

    const plugin = ZoomPlugin.create({ exponentialZooming: true, iterations: 3, maxZoom: 6400 })
    plugin._init(wavesurfer as any)

    // First track: startZoom = 100 / 10 = 10.
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0 }))
    expect(wavesurfer.zoom).toHaveBeenLastCalledWith(Math.min(50 * Math.pow(6400 / 10, 1 / 2), 6400))

    // Load a new, longer audio file.
    duration.set(40)
    wavesurfer.emit('ready', 40)

    // The baseline must be re-derived from the NEW duration (100 / 40 = 2.5),
    // not kept from the previous track.
    container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0 }))
    expect(wavesurfer.zoom).toHaveBeenLastCalledWith(Math.min(50 * Math.pow(6400 / 2.5, 1 / 2), 6400))
  })
})
