/**
 * jsdom implements almost none of the SVG geometry APIs envelope.ts relies on
 * (SVGSVGElement.viewBox, SVGSVGElement.createSVGPoint, SVGPointList). Stub
 * just enough of them, on the specific svg/polyline instances Polyline
 * creates, for addPolyPoint/removePolyPoint to run through their real logic.
 */
export class FakeSvgPointList {
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

export const mockSvgGeometry = (svg: SVGSVGElement, width = 100, height = 100) => {
  Object.defineProperty(svg, 'viewBox', {
    configurable: true,
    value: { baseVal: { width, height } },
  })
  ;(svg as unknown as { createSVGPoint: () => { x: number; y: number } }).createSVGPoint = () => ({ x: 0, y: 0 })

  const polylineEl = svg.querySelector('polyline') as SVGPolylineElement
  Object.defineProperty(polylineEl, 'points', {
    configurable: true,
    value: new FakeSvgPointList([
      { x: 0, y: height },
      { x: width, y: height },
    ]),
  })
}
