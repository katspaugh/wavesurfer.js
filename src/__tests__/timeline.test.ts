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

  // ADAPTED (private-internal poke): the original spied on the plugin's
  // private `updateVisibleNotches` method, which no longer exists as an
  // instance member post-port (it's a setup()-local closure). Adapted to
  // pin the same observable claim -- firing the visibleRange signal
  // re-windows notch visibility using the CURRENT getScroll()/getWidth()
  // mock values -- via the DOM instead of a spy: change what getWidth()
  // returns *after* init (so a stale, init-time window would keep both
  // notches visible), confirm nothing moves until the signal actually
  // fires, then fire it and confirm the now-out-of-window notch is pruned.
  test('re-windows notches when visibleRange changes rather than on raw scroll math', () => {
    const wavesurfer = createWaveSurfer(1, 100)
    const plugin = TimelinePlugin.create({ duration: 1, timeInterval: 0.5 })
    plugin._init(wavesurfer as any)

    const notchAt0 = wavesurfer.getWrapper().querySelector<HTMLElement>('[part^="timeline-notch"][style*="left: 0px"]')
    const notchAt50 = wavesurfer
      .getWrapper()
      .querySelector<HTMLElement>('[part^="timeline-notch"][style*="left: 50px"]')
    expect(notchAt0).not.toBeNull()
    expect(notchAt50).not.toBeNull()
    // Both start out visible: getScroll()=0, getWidth()=200 (scrollWidth * 2).
    expect(notchAt0?.isConnected).toBe(true)
    expect(notchAt50?.isConnected).toBe(true)

    // Shrink the live window so the notch at offset 50 falls outside it.
    // Changing the mock alone must not move anything yet.
    wavesurfer.getWidth = jest.fn(() => 30)
    expect(notchAt50?.isConnected).toBe(true)

    wavesurfer.getRenderer().getVisibleRange().set({ startTime: 10, endTime: 20 })

    expect(notchAt0?.isConnected).toBe(true)
    expect(notchAt50?.isConnected).toBe(false)
  })

  // ADAPTED (private-internal poke): same `updateVisibleNotches` spy removed
  // as above. The first assertion (no 'scroll' subscription registered) is
  // unmodified and is, on its own, sufficient to prove the plugin can't be
  // driven by the raw 'scroll' event -- there's nothing to fire. The
  // dropped second half (`spy not called`) is now covered by the previous
  // test's boundary check, which shows the re-window path only reacts to
  // the visibleRange signal.
  test('does not re-window notches on the raw wavesurfer "scroll" event anymore', () => {
    const { wavesurfer } = createInitializedTimeline()

    // Find the listener the plugin registered for 'scroll' via wavesurfer.on
    // (still present for other consumers) and confirm firing it no longer
    // drives updateVisibleNotches -- only visibleRange does.
    const onCalls = (wavesurfer.on as jest.Mock).mock.calls
    const scrollListenerCall = onCalls.find(([event]) => event === 'scroll')
    expect(scrollListenerCall).toBeUndefined()
  })

  // ADAPTED (private-internal poke): the original spied on
  // `updateVisibleNotches` and asserted its exact call args, including a
  // read of the private `currentTimeline` field. Neither exists post-port.
  // Adapted to pin the same invariant -- the re-window uses
  // getScroll() + getWidth() (padding-adjusted), not some other bounds --
  // via a DOM boundary: place notches exactly either side of the padding-
  // adjusted scrollRight (160 = getScroll() 10 + getWidth() 150) and confirm
  // only the one strictly inside the window survives after the signal fires.
  test('scroll-driven notch window uses the padding-adjusted getWidth(), consistent with virtualAppend', () => {
    // Renderer.getWidth() returns clientWidth minus the container's inline
    // padding (see renderer.ts's getWidth()/containerInlinePadding). Simulate
    // non-zero container padding by making getWidth() smaller than a raw,
    // unpadded viewport width would be. virtualAppend()'s initial-visibility
    // check already used getScroll() + getWidth() for this reason; the
    // scroll-driven effect must compute the SAME window, not fall back to an
    // unpadded bounds value (as the legacy 'scroll' event used to report).
    // duration=20, scrollWidth=200 => pxPerSec=10, so integer notch indices
    // land on exact, drift-free pixel offsets (i * 10) -- unlike a fractional
    // timeInterval, which would accumulate floating-point error across the
    // repeated `i += timeInterval` loop and make an exact "left: 150px"
    // string match unreliable.
    const wavesurfer = createWaveSurfer(20, 200)
    // Start with a generous window so both boundary notches render visible
    // at init time, before the padding-adjusted width kicks in.
    wavesurfer.getWidth = jest.fn(() => 1000)
    wavesurfer.getScroll = jest.fn(() => 10)

    const plugin = TimelinePlugin.create({ duration: 20, timeInterval: 1, timeOffset: 0 })
    plugin._init(wavesurfer as any)

    const wrapper = wavesurfer.getWrapper()
    const notchAt150 = wrapper.querySelector<HTMLElement>('[part^="timeline-notch"][style*="left: 150px"]')
    const notchAt160 = wrapper.querySelector<HTMLElement>('[part^="timeline-notch"][style*="left: 160px"]')
    expect(notchAt150).not.toBeNull()
    expect(notchAt160).not.toBeNull()
    expect(notchAt150?.isConnected).toBe(true)
    expect(notchAt160?.isConnected).toBe(true)

    const paddingAdjustedWidth = 150 // e.g. a 200px-wide container with 50px of inline padding
    wavesurfer.getWidth = jest.fn(() => paddingAdjustedWidth)

    wavesurfer.getRenderer().getVisibleRange().set({ startTime: 0.1, endTime: 0.9 })

    // scrollRight = getScroll() 10 + getWidth() 150 = 160. The notch at 150
    // is strictly inside (150 < 160) and stays; the notch at exactly 160 is
    // not (160 < 160 is false) and is pruned. If the re-window had instead
    // used an unpadded bounds value, both would still be inside and the
    // notch at 160 would incorrectly remain.
    expect(notchAt150?.isConnected).toBe(true)
    expect(notchAt160?.isConnected).toBe(false)
  })

  // ADAPTED (private-internal poke): the original read the private
  // `notchElements`/`currentTimeline` fields directly. Neither exists
  // post-port (they're setup()-local closure state, discarded with the
  // scope on destroy). Adapted to the equivalent DOM-observable claim: the
  // timeline wrapper (and its notches) is detached from the container on
  // destroy, i.e. nothing the plugin rendered is left behind.
  test('removes the timeline DOM on destroy', () => {
    const wavesurfer = createWaveSurfer(1, 100)
    const plugin = TimelinePlugin.create({ duration: 1 })

    plugin._init(wavesurfer as any)

    const wrapper = wavesurfer.getWrapper()
    expect(wrapper.querySelectorAll('[part^="timeline-notch"]').length).toBeGreaterThan(0)
    expect(wrapper.querySelector('[part="timeline-wrapper"]')).not.toBeNull()

    plugin.destroy()

    expect(wrapper.querySelector('[part="timeline-wrapper"]')).toBeNull()
    expect(wrapper.querySelectorAll('[part^="timeline-notch"]').length).toBe(0)
  })
})
