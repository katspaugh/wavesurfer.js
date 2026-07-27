import EnvelopePlugin from '../plugins/envelope.js'

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

const createWaveSurfer = (duration = 10) => {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  return {
    getWrapper: () => wrapper,
    getDuration: () => duration,
    getDecodedData: () => null,
    getVolume: () => 1,
    getCurrentTime: () => 0,
    setVolume: () => undefined,
    on: () => () => undefined,
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
  })

  it('does not accumulate polyline subscriptions across re-inits of the polyline', () => {
    const plugin = EnvelopePlugin.create({ points: [] })
    const anyPlugin = plugin as any
    anyPlugin.wavesurfer = createWaveSurfer()

    anyPlugin.initPolyline()
    const after1 = anyPlugin.polylineSubscriptions.length

    anyPlugin.initPolyline()
    const after2 = anyPlugin.polylineSubscriptions.length

    expect(after1).toBeGreaterThan(0)
    expect(after2).toBe(after1) // replaced, not accumulated
  })

  it('drains polyline subscriptions on plugin destroy', () => {
    const plugin = EnvelopePlugin.create({ points: [] })
    const anyPlugin = plugin as any
    anyPlugin.wavesurfer = createWaveSurfer()

    anyPlugin.initPolyline()
    expect(anyPlugin.polylineSubscriptions.length).toBeGreaterThan(0)

    plugin.destroy()
    expect(anyPlugin.polylineSubscriptions.length).toBe(0)
  })

  it('removePolyPoint disposes the per-point drag stream instead of leaking it', () => {
    const plugin = EnvelopePlugin.create({ points: [] })
    const anyPlugin = plugin as any
    anyPlugin.wavesurfer = createWaveSurfer()
    anyPlugin.initPolyline()
    mockSvgGeometry(anyPlugin.polyline.svg)

    const point = { time: 5, volume: 0.5 }
    plugin.addPoint(point)

    const circle = anyPlugin.polyline.svg.querySelector('ellipse') as SVGEllipseElement
    expect(circle).toBeTruthy()
    const removeSpy = jest.spyOn(circle, 'removeEventListener')

    plugin.removePoint(point)

    // The drag-stream cleanup removes the pointerdown listener from the
    // (now detached) circle element as soon as the point is removed, rather
    // than waiting for the whole polyline to be torn down.
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  it('setPoints does not leak one drag stream per pre-existing point', () => {
    const plugin = EnvelopePlugin.create({ points: [] })
    const anyPlugin = plugin as any
    anyPlugin.wavesurfer = createWaveSurfer()
    anyPlugin.initPolyline()
    mockSvgGeometry(anyPlugin.polyline.svg)

    const pointA = { time: 2, volume: 0.2 }
    const pointB = { time: 4, volume: 0.4 }
    plugin.addPoint(pointA)
    plugin.addPoint(pointB)

    expect(anyPlugin.polyline.pointCleanups.size).toBe(2)

    plugin.setPoints([{ time: 6, volume: 0.6 }])

    // Only the freshly-added point's cleanup should remain; the two
    // pre-existing points' drag streams must have been disposed by
    // removePolyPoint, not merely orphaned.
    expect(anyPlugin.polyline.pointCleanups.size).toBe(1)
  })

  it('nulls the polyline on destroy so post-destroy calls cannot reach a torn-down instance', () => {
    const plugin = EnvelopePlugin.create({ points: [] })
    const anyPlugin = plugin as any
    anyPlugin.wavesurfer = createWaveSurfer()
    anyPlugin.initPolyline()

    plugin.destroy()

    expect(anyPlugin.polyline).toBeNull()
  })

  it('double Polyline.destroy() does not throw and empties its subscriptions', () => {
    const plugin = EnvelopePlugin.create({ points: [] })
    const anyPlugin = plugin as any
    anyPlugin.wavesurfer = createWaveSurfer()
    anyPlugin.initPolyline()

    const polyline = anyPlugin.polyline

    expect(() => {
      polyline.destroy()
      polyline.destroy()
    }).not.toThrow()

    expect(polyline.subscriptions.length).toBe(0)
  })
})
