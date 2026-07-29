import ZoomPlugin from '../plugins/zoom.js'
import { signal } from '../reactive/store.js'

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
  }
}

const createWaveSurfer = (container: HTMLElement, wrapper: HTMLElement, durationValue: number) => {
  const duration = signal(durationValue)
  const zoom = signal(0)

  return {
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
})
