import TimelinePlugin from '../plugins/timeline.js'
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

const createWaveSurfer = (duration = 1, scrollWidth = 100) => {
  const emitter = createEmitter()
  const durationSignal = signal(duration)
  const visibleRangeSignal = signal({ startTime: 0, endTime: duration })
  const wrapper = document.createElement('div')

  Object.defineProperty(wrapper, 'scrollWidth', { configurable: true, value: scrollWidth })
  document.body.appendChild(wrapper)

  return {
    ...emitter,
    getDuration: jest.fn(() => duration),
    getScroll: jest.fn(() => 0),
    getState: jest.fn(() => ({ duration: durationSignal })),
    getWidth: jest.fn(() => scrollWidth * 2),
    getWrapper: jest.fn(() => wrapper),
    getRenderer: jest.fn(() => ({
      getVisibleRange: jest.fn(() => visibleRangeSignal),
    })),
  }
}

// The real getVisibleRange() is a read-only ComputedSignal; this fake
// wavesurfer exposes a plain WritableSignal instead so the test can drive it
// directly. Real end-to-end scroll-driven recomputation of visibleRange is
// covered by renderer.test.ts; this test only needs to prove the timeline
// re-subscribed to visibleRange instead of the raw 'scroll' event.
const createInitializedTimeline = (options?: Parameters<typeof TimelinePlugin.create>[0]) => {
  const wavesurfer = createWaveSurfer(options?.duration ?? 1)
  const plugin = TimelinePlugin.create({ duration: 1, ...options })
  plugin._init(wavesurfer as any)
  return { plugin, wavesurfer }
}

describe('TimelinePlugin', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('preserves high precision offsets for notch positions', () => {
    const wavesurfer = createWaveSurfer(1, 100)
    const plugin = TimelinePlugin.create({
      duration: 1,
      timeInterval: 0.333,
      timeOffset: 0.001,
      primaryLabelInterval: 10,
      secondaryLabelInterval: 10,
    })

    plugin._init(wavesurfer as any)

    const notches = wavesurfer.getWrapper().querySelectorAll<HTMLElement>('[part^="timeline-notch"]')
    expect(notches).toHaveLength(4)
    const offsets = Array.from(notches, (notch) => parseFloat(notch.style.left))

    expect(offsets[0]).toBeCloseTo(0.1)
    expect(offsets[1]).toBeCloseTo(33.4)
    expect(offsets[2]).toBeCloseTo(66.7)
    expect(offsets[3]).toBeCloseTo(100)
  })

  test('re-windows notches when visibleRange changes rather than on raw scroll math', () => {
    const { plugin, wavesurfer } = createInitializedTimeline()
    const spy = jest.spyOn(plugin as any, 'updateVisibleNotches')

    wavesurfer.getRenderer().getVisibleRange().set({ startTime: 10, endTime: 20 })

    expect(spy).toHaveBeenCalled()
  })

  test('does not re-window notches on the raw wavesurfer "scroll" event anymore', () => {
    const { plugin, wavesurfer } = createInitializedTimeline()
    const spy = jest.spyOn(plugin as any, 'updateVisibleNotches')

    // Find the listener the plugin registered for 'scroll' via wavesurfer.on
    // (still present for other consumers) and confirm firing it no longer
    // drives updateVisibleNotches -- only visibleRange does.
    const onCalls = (wavesurfer.on as jest.Mock).mock.calls
    const scrollListenerCall = onCalls.find(([event]) => event === 'scroll')
    expect(scrollListenerCall).toBeUndefined()

    expect(spy).not.toHaveBeenCalled()
  })

  test('clears notch element cache on destroy', () => {
    const wavesurfer = createWaveSurfer(1, 100)
    const plugin = TimelinePlugin.create({ duration: 1 })

    plugin._init(wavesurfer as any)

    expect((plugin as any).notchElements.size).toBeGreaterThan(0)
    expect((plugin as any).currentTimeline).not.toBeUndefined()

    plugin.destroy()

    expect((plugin as any).notchElements.size).toBe(0)
    expect((plugin as any).currentTimeline).toBeUndefined()
  })
})
