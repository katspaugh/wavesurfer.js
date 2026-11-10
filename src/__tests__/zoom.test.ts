import ZoomPlugin from '../plugins/zoom.js'
import { signal } from '../reactive/store.js'
import { createEmitter } from './helpers/create-emitter.js'

const createWaveSurfer = (container: HTMLElement, wrapper: HTMLElement, durationValue: number) => {
  const duration = signal(durationValue)
  const zoom = signal(0)

  return {
    duration,
    zoom,
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

const createTouchEvent = (type: string, points: Array<[number, number]>) => {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
  })
  return event as TouchEvent
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

  describe('wheel zoom', () => {
    test('ignores horizontal-dominant wheel gestures so the waveform can scroll sideways', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

      ZoomPlugin.create({ deltaThreshold: 0 })._init(wavesurfer as any)

      const event = new WheelEvent('wheel', { deltaX: -20, deltaY: -10, cancelable: true })
      container.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(wavesurfer.zoom).not.toHaveBeenCalled()
    })

    test('prevents the page from scrolling while zooming', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

      ZoomPlugin.create()._init(wavesurfer as any)

      const event = new WheelEvent('wheel', { deltaY: -10, deltaX: 0, cancelable: true })
      container.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    test('accumulates small wheel deltas until deltaThreshold is reached, then zooms by the total', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

      ZoomPlugin.create()._init(wavesurfer as any)

      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -2, deltaX: 0 }))
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -2, deltaX: 0 }))
      expect(wavesurfer.zoom).not.toHaveBeenCalled()

      // Accumulated delta is now 6 >= the default threshold of 5: 50 + 6 * 0.5 = 53.
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -2, deltaX: 0 }))
      expect(wavesurfer.zoom).toHaveBeenCalledTimes(1)
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(53)

      // The accumulator was reset after zooming: one more small step is below the threshold again.
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -2, deltaX: 0 }))
      expect(wavesurfer.zoom).toHaveBeenCalledTimes(1)
    })

    test('zooms on every wheel event when deltaThreshold is 0, scaled by the scale option', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

      ZoomPlugin.create({ deltaThreshold: 0, scale: 2 })._init(wavesurfer as any)

      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, deltaX: 0 }))
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(52)
    })

    test('derives the current zoom from the wrapper scroll width when minPxPerSec is 0', () => {
      const { container, wrapper } = createDom()
      Object.defineProperty(wrapper, 'scrollWidth', { configurable: true, value: 1000 })
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)
      wavesurfer.options.minPxPerSec = 0

      ZoomPlugin.create({ maxZoom: 1000 })._init(wavesurfer as any)

      // Current zoom = 1000px / 10s = 100 px/s; 100 + 10 * 0.5 = 105.
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0 }))
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(105)
    })

    test('snaps to fit-to-width and resets the scroll when zooming out past the container width', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)
      container.scrollLeft = 123

      ZoomPlugin.create()._init(wavesurfer as any)

      // 50 - 1000 * 0.5 clamps to 0 px/s, which is narrower than the container: fit 100px / 10s.
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: 1000, deltaX: 0, clientX: 30 }))

      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(10)
      expect(container.scrollLeft).toBe(0)
    })

    test('keeps the time under a stationary pointer fixed across steps even when scrollLeft is rounded', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)
      wavesurfer.zoom.mockImplementation((pxPerSec: number) => {
        wavesurfer.options.minPxPerSec = pxPerSec
      })

      // Browsers round scrollLeft; record what the plugin asked for, store the rounded value.
      const requestedScroll: number[] = []
      let scrollLeftValue = 0
      Object.defineProperty(container, 'scrollLeft', {
        configurable: true,
        get: () => scrollLeftValue,
        set: (value: number) => {
          requestedScroll.push(value)
          scrollLeftValue = Math.round(value)
        },
      })
      wavesurfer.getScroll.mockImplementation(() => container.scrollLeft)

      ZoomPlugin.create({ deltaThreshold: 0 })._init(wavesurfer as any)

      // Anchor time = (0 + 30) / 50 = 0.6s. Step 1: 50 + 3 * 0.5 = 51.5 px/s.
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -3, deltaX: 0, clientX: 30 }))
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(51.5)
      expect(requestedScroll[0]).toBeCloseTo(0.6 * 51.5 - 30)

      // Step 2 at the same x: the 0.6s anchor is reused rather than re-derived from the rounded
      // scroll (which would drift to (1 + 30) / 51.5 s).
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -3, deltaX: 0, clientX: 30 }))
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(53)
      expect(requestedScroll[1]).toBeCloseTo(0.6 * 53 - 30)
    })

    test('re-derives the anchor when the pointer moves between steps', () => {
      const { container, wrapper } = createDom()
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)

      ZoomPlugin.create({ deltaThreshold: 0 })._init(wavesurfer as any)

      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0, clientX: 50 }))
      // Pointer moves to x=80: anchor = (0 + 80) / 50 = 1.6s; new zoom 55 px/s keeps 1.6s at x=80.
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0, clientX: 80 }))

      expect(container.scrollLeft).toBeCloseTo(1.6 * 55 - 80)
    })

    test('seeds the exponential baseline from the container width once the zoom state is set', () => {
      const { container, wrapper } = createDom(100)
      // Make the wrapper-derived baseline (800 / 10 = 80) differ from the
      // container-derived one (100 / 10 = 10) so the two code paths are distinguishable.
      Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 800 })
      const { zoom, wavesurfer } = createWaveSurfer(container, wrapper, 10)

      ZoomPlugin.create({ exponentialZooming: true, iterations: 3, maxZoom: 6400 })._init(wavesurfer as any)

      zoom.set(50)

      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0 }))
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(50 * Math.pow(6400 / 10, 1 / 2))
    })

    test('does not seed the exponential baseline from the zoom state while the duration is unknown', () => {
      const { container, wrapper } = createDom(100)
      Object.defineProperty(wrapper, 'clientWidth', { configurable: true, value: 800 })
      const { zoom, wavesurfer } = createWaveSurfer(container, wrapper, 0)

      ZoomPlugin.create({ exponentialZooming: true, iterations: 3, maxZoom: 6400 })._init(wavesurfer as any)

      // The zoom state changes while the state duration is still 0: no baseline (100 / 0) is cached.
      zoom.set(50)

      // The first wheel step after decoding derives the baseline from the wrapper instead: 800 / 10 = 80.
      wavesurfer.getDuration.mockReturnValue(10)
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0 }))
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(50 * Math.pow(6400 / 80, 1 / 2))
    })
  })

  describe('pinch zoom', () => {
    const setup = (minPxPerSec = 50) => {
      const { container, wrapper } = createDom(100)
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)
      wavesurfer.options.minPxPerSec = minPxPerSec
      ZoomPlugin.create()._init(wavesurfer as any)
      return { container, wrapper, wavesurfer }
    }

    test('zooms proportionally to the finger distance, anchored at the pinch center', () => {
      const { container, wavesurfer } = setup()

      // Distance 40, center x=40 -> anchor time (0 + 40) / 50 = 0.8s.
      const start = createTouchEvent('touchstart', [
        [20, 0],
        [60, 0],
      ])
      container.dispatchEvent(start)
      expect(start.defaultPrevented).toBe(true)

      // Distance 60 -> scale 1.5 -> 75 px/s.
      const move = createTouchEvent('touchmove', [
        [10, 0],
        [70, 0],
      ])
      container.dispatchEvent(move)

      expect(move.defaultPrevented).toBe(true)
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(75)
      // The anchor time 0.8s stays under the pinch center x=40.
      expect(container.scrollLeft).toBeCloseTo(0.8 * 75 - 40)
    })

    test('uses the euclidean distance between the fingers', () => {
      const { container, wavesurfer } = setup()

      // Distance 50 (a 30-40-50 triangle) -> 60 (horizontal): scale 1.2 -> 60 px/s.
      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [0, 0],
          [30, 40],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [0, 0],
          [60, 0],
        ]),
      )

      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(60)
    })

    test('clamps pinch zoom to maxZoom', () => {
      const { container, wavesurfer } = setup()

      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [40, 0],
          [50, 0],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [0, 0],
          [100, 0],
        ]),
      )

      // 50 * 10 = 500 is clamped to maxZoom = container width = 100.
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(100)
    })

    test('clamps pinch zoom-out to fit-to-width and resets the scroll', () => {
      const { container, wavesurfer } = setup()
      container.scrollLeft = 50

      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [0, 0],
          [100, 0],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [45, 0],
          [55, 0],
        ]),
      )

      // 50 * 0.1 = 5 px/s is below fit-to-width 100 / 10 = 10 px/s.
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(10)
      expect(container.scrollLeft).toBe(0)
    })

    test('derives the starting pinch zoom from the wrapper scroll width when minPxPerSec is 0', () => {
      const { container, wrapper, wavesurfer } = setup(0)
      Object.defineProperty(wrapper, 'scrollWidth', { configurable: true, value: 400 })

      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [40, 0],
          [60, 0],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [35, 0],
          [65, 0],
        ]),
      )

      // Starting zoom 400 / 10 = 40 px/s, scaled by 30 / 20 = 1.5.
      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(60)
    })

    test('ignores single-finger touches', () => {
      const { container, wavesurfer } = setup()

      const start = createTouchEvent('touchstart', [[20, 0]])
      container.dispatchEvent(start)
      const move = createTouchEvent('touchmove', [[80, 0]])
      container.dispatchEvent(move)

      expect(start.defaultPrevented).toBe(false)
      expect(move.defaultPrevented).toBe(false)
      expect(wavesurfer.zoom).not.toHaveBeenCalled()
    })

    test('ignores two-finger moves that did not start as a pinch', () => {
      const { container, wavesurfer } = setup()

      container.dispatchEvent(createTouchEvent('touchstart', [[20, 0]]))
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [10, 0],
          [70, 0],
        ]),
      )

      expect(wavesurfer.zoom).not.toHaveBeenCalled()
    })

    test.each(['touchend', 'touchcancel'])('stops pinching on %s once fewer than two fingers remain', (endType) => {
      const { container, wavesurfer } = setup()

      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [20, 0],
          [60, 0],
        ]),
      )
      container.dispatchEvent(createTouchEvent(endType, [[20, 0]]))
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [10, 0],
          [70, 0],
        ]),
      )

      expect(wavesurfer.zoom).not.toHaveBeenCalled()
    })

    test('keeps pinching when a touchend leaves two fingers down', () => {
      const { container, wavesurfer } = setup()

      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [20, 0],
          [60, 0],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchend', [
          [20, 0],
          [60, 0],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [10, 0],
          [70, 0],
        ]),
      )

      expect(wavesurfer.zoom).toHaveBeenLastCalledWith(75)
    })

    test('stops listening for touch and wheel events after destroy', () => {
      const { container, wrapper } = createDom(100)
      const { wavesurfer } = createWaveSurfer(container, wrapper, 10)
      const plugin = ZoomPlugin.create({ deltaThreshold: 0 })
      plugin._init(wavesurfer as any)
      plugin.destroy()

      container.dispatchEvent(
        createTouchEvent('touchstart', [
          [20, 0],
          [60, 0],
        ]),
      )
      container.dispatchEvent(
        createTouchEvent('touchmove', [
          [10, 0],
          [70, 0],
        ]),
      )
      container.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, deltaX: 0 }))

      expect(wavesurfer.zoom).not.toHaveBeenCalled()
    })
  })
})
