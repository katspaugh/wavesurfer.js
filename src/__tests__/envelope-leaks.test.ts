import EnvelopePlugin from '../plugins/envelope.js'
import { Scope } from '../scope.js'

// jsdom implements almost none of the SVG geometry APIs envelope.ts relies on
// (SVGSVGElement.viewBox, SVGSVGElement.createSVGPoint, SVGPointList). Stub
// just enough of them, on the specific svg/polyline instances Polyline
// creates, for addPolyPoint/removePolyPoint to run through their real logic.
class FakeSvgPointList {
  private items: { x: number; y: number }[]
  constructor(initial: { x: number; y: number }[]) {
    this.items = initial
  }
  get numberOfItems() {
    return this.items.length
  }
  getItem(i: number) {
    return this.items[i]
  }
  insertItemBefore(item: { x: number; y: number }, index: number) {
    this.items.splice(index, 0, item)
    return item
  }
  removeItem(index: number) {
    return this.items.splice(index, 1)[0]
  }
  [Symbol.iterator]() {
    return this.items[Symbol.iterator]()
  }
}

const mockSvgGeometry = (svg: SVGSVGElement, width = 100, height = 100) => {
  Object.defineProperty(svg, 'viewBox', {
    configurable: true,
    value: { baseVal: { width, height } },
  })
  ;(svg as any).createSVGPoint = () => ({ x: 0, y: 0 })

  const polylineEl = svg.querySelector('polyline') as SVGPolylineElement
  Object.defineProperty(polylineEl, 'points', {
    configurable: true,
    value: new FakeSvgPointList([
      { x: 0, y: height },
      { x: width, y: height },
    ]),
  })
}

type Listener = (...args: any[]) => void

// EnvelopePlugin now only reaches its 'decode'/'redraw'/'timeupdate' wiring
// through ctx.wavesurfer.on(...) registered inside setup() — which only runs
// via the real _init() lifecycle. The pre-port tests bypassed all of that by
// assigning `anyPlugin.wavesurfer` directly and calling private methods
// (initPolyline()) by hand; that bypass no longer has anything to call. Use
// a real emitter stub, drive everything through plugin._init(ws) + ws.emit,
// and exercise the public Api (addPoint/removePoint/setPoints/destroy)
// instead — same pattern as hover.test.ts / minimap.test.ts.
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

const createWaveSurfer = (duration = 10) => {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  return {
    ...createEmitter(),
    getWrapper: () => wrapper,
    getDuration: () => duration,
    getDecodedData: () => null,
    getVolume: () => 1,
    getCurrentTime: () => 0,
    setVolume: () => undefined,
  }
}

describe('EnvelopePlugin leak fixes', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  // ADAPTED: the pre-port test read `anyPlugin.polylineSubscriptions.length`
  // directly. That array is now a child Scope (`ctx.scope.child()`),
  // disposed and replaced — not accumulated — on every 'decode' (see
  // envelope.ts:initPolyline). Scope has no size/length introspection by
  // design, so we pin the same "replace, don't accumulate" contract one
  // level down: spy on Scope.prototype.child (the mechanism itself, not an
  // envelope.ts private) and assert firing 'decode' twice disposes the
  // first child scope before/when creating the second, rather than leaving
  // both live.
  it('does not accumulate polyline subscriptions across re-inits of the polyline', () => {
    const childSpy = jest.spyOn(Scope.prototype, 'child')
    const ws = createWaveSurfer()
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)

    ws.emit('decode', 10)
    const firstPolylineScope = childSpy.mock.results[childSpy.mock.results.length - 1].value as Scope

    ws.emit('decode', 10)
    const secondPolylineScope = childSpy.mock.results[childSpy.mock.results.length - 1].value as Scope

    expect(firstPolylineScope).not.toBe(secondPolylineScope)
    expect(firstPolylineScope.disposed).toBe(true) // replaced, not accumulated
    expect(secondPolylineScope.disposed).toBe(false)
  })

  // ADAPTED: same underlying data-structure change as above. The pre-port
  // test checked `polylineSubscriptions.length` goes from >0 to 0 across
  // plugin.destroy(); the equivalent here is the current polyline child
  // scope transitioning from live to disposed.
  it('drains polyline subscriptions on plugin destroy', () => {
    const childSpy = jest.spyOn(Scope.prototype, 'child')
    const ws = createWaveSurfer()
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)

    ws.emit('decode', 10)
    const currentPolylineScope = childSpy.mock.results[childSpy.mock.results.length - 1].value as Scope
    expect(currentPolylineScope.disposed).toBe(false)

    plugin.destroy()

    expect(currentPolylineScope.disposed).toBe(true)
  })

  // ADAPTED: `anyPlugin.polyline.svg` no longer exists (`polyline` is a
  // setup-closure variable, not an instance field). The SVG element it
  // referenced is the same real DOM node Polyline appends into
  // wavesurfer's wrapper, so we query it straight off the wrapper instead.
  // The leak assertion itself (removeEventListener('pointerdown', ...)
  // called when a point is removed) is unchanged.
  it('removePolyPoint disposes the per-point drag stream instead of leaking it', () => {
    const ws = createWaveSurfer()
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)
    ws.emit('decode', 10)

    const svg = ws.getWrapper().querySelector('svg') as SVGSVGElement
    mockSvgGeometry(svg)

    const point = { time: 5, volume: 0.5 }
    plugin.addPoint(point)

    const circle = svg.querySelector('ellipse') as SVGEllipseElement
    expect(circle).toBeTruthy()
    const removeSpy = jest.spyOn(circle, 'removeEventListener')

    plugin.removePoint(point)

    // The drag-stream cleanup removes the pointerdown listener from the
    // (now detached) circle element as soon as the point is removed, rather
    // than waiting for the whole polyline to be torn down.
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  // ADAPTED: `anyPlugin.polyline.pointCleanups.size` no longer exists.
  // Assert the same "disposed, not merely orphaned" guarantee observably:
  // the stale points' circles must both have their pointerdown listener
  // removed, and only the freshly-added point's circle remains in the DOM.
  it('setPoints does not leak one drag stream per pre-existing point', () => {
    const ws = createWaveSurfer()
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)
    ws.emit('decode', 10)

    const svg = ws.getWrapper().querySelector('svg') as SVGSVGElement
    mockSvgGeometry(svg)

    const pointA = { time: 2, volume: 0.2 }
    const pointB = { time: 4, volume: 0.4 }
    plugin.addPoint(pointA)
    plugin.addPoint(pointB)

    const staleCircles = Array.from(svg.querySelectorAll('ellipse'))
    expect(staleCircles.length).toBe(2)
    const removeSpies = staleCircles.map((circle) => jest.spyOn(circle, 'removeEventListener'))

    plugin.setPoints([{ time: 6, volume: 0.6 }])

    // Only the freshly-added point's circle should remain; the two
    // pre-existing points' drag streams must have been disposed by
    // removePolyPoint, not merely orphaned.
    expect(svg.querySelectorAll('ellipse').length).toBe(1)
    removeSpies.forEach((spy) => {
      expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    })
  })

  // MERGED + ADAPTED (was two tests: "nulls the polyline on destroy..." and
  // "double Polyline.destroy() does not throw..."). Neither assertion is
  // reachable anymore: `polyline` is a private closure variable with no
  // instance-field equivalent, and the `Polyline` class is not exported, so
  // there is no way to hold a reference to an instance from the test. Pin
  // the same two guarantees the recipe calls for
  // (`ctx.scope.add(() => { polyline?.destroy(); polyline = null })`)
  // observably instead: destroying the plugin tears the polyline's DOM down
  // and is safe to call twice, and a post-destroy Api call cannot reach (or
  // resurrect) a torn-down polyline.
  it('destroying the plugin twice does not throw, and post-destroy Api calls are safe no-ops', () => {
    const ws = createWaveSurfer()
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)
    ws.emit('decode', 10)

    expect(ws.getWrapper().querySelector('svg')).toBeTruthy()

    expect(() => {
      plugin.destroy()
      plugin.destroy()
    }).not.toThrow()

    expect(ws.getWrapper().querySelector('svg')).toBeNull()

    expect(() => {
      plugin.addPoint({ time: 1, volume: 0.5 })
      plugin.removePoint({ time: 1, volume: 0.5 })
    }).not.toThrow()
  })
})
