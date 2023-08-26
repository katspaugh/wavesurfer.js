/**
 * Envelope is a visual UI for controlling the audio volume and add fade-in and fade-out effects.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import { makeDraggable } from '../draggable.js'
import EventEmitter from '../event-emitter.js'

export type EnvelopePoint = {
  time: number // in seconds
  volume: number // 0 to 1 (will distort if > 1)
}

export type EnvelopePluginOptions = {
  points?: EnvelopePoint[]
  volume?: number
  lineWidth?: string
  lineColor?: string
  dragPointSize?: number
  dragPointFill?: string
  dragPointStroke?: string
}

const defaultOptions = {
  points: [] as EnvelopePoint[],
  lineWidth: 4,
  lineColor: 'rgba(0, 0, 255, 0.5)',
  dragPointSize: 10,
  dragPointFill: 'rgba(255, 255, 255, 0.8)',
  dragPointStroke: 'rgba(255, 255, 255, 0.8)',
}

type Options = EnvelopePluginOptions & typeof defaultOptions

export type EnvelopePluginEvents = BasePluginEvents & {
  'points-change': [newPoints: EnvelopePoint[]]
  'volume-change': [volume: number]
}

class Polyline extends EventEmitter<{
  'point-move': [point: EnvelopePoint, relativeX: number, relativeY: number]
  'point-dragout': [point: EnvelopePoint]
}> {
  private svg: SVGSVGElement
  private options: Options
  static dragOutThreshold = 10

  constructor(options: Options, wrapper: HTMLElement) {
    super()

    this.options = options

    const width = wrapper.clientWidth
    const height = wrapper.clientHeight

    // SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('style', 'position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none;')
    svg.setAttribute('part', 'envelope')
    this.svg = svg

    // A polyline representing the envelope
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    polyline.setAttribute('points', `0,${height} ${width},${height}`)
    polyline.setAttribute('stroke', options.lineColor)
    polyline.setAttribute('stroke-width', options.lineWidth)
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('style', 'pointer-events: none;')
    polyline.setAttribute('part', 'polyline')
    svg.appendChild(polyline)

    wrapper.appendChild(svg)
  }

  private makeDraggable(draggable: SVGElement, onDrag: (x: number, y: number) => void) {
    makeDraggable(
      draggable as unknown as HTMLElement,
      onDrag,
      () => (draggable.style.cursor = 'grabbing'),
      () => (draggable.style.cursor = 'grab'),
    )
  }

  private createCircle(x: number, y: number) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    const radius = this.options.dragPointSize / 2
    circle.setAttribute('rx', radius.toString())
    circle.setAttribute('ry', radius.toString())
    circle.setAttribute('fill', this.options.dragPointFill)
    circle.setAttribute('stroke', this.options.dragPointStroke || this.options.dragPointFill)
    circle.setAttribute('stroke-width', '2')
    circle.setAttribute('style', 'cursor: grab; pointer-events: all;')
    circle.setAttribute('part', 'circle')
    circle.setAttribute('cx', x.toString())
    circle.setAttribute('cy', y.toString())
    this.svg.appendChild(circle)
    return circle
  }

  addPolyPoint(relX: number, relY: number, refPoint: EnvelopePoint) {
    const { svg } = this
    const { width, height } = svg.viewBox.baseVal
    const x = relX * width
    const y = height - relY * height

    const newPoint = svg.createSVGPoint()
    newPoint.x = relX * width
    newPoint.y = height - relY * height

    const polyline = svg.querySelector('polyline') as SVGPolylineElement
    const { points } = polyline

    const newIndex = Array.from(points).findIndex((point) => point.x >= x)
    points.insertItemBefore(newPoint, Math.max(newIndex, 1))

    const circle = this.createCircle(x, y)

    this.makeDraggable(circle, (dx, dy) => {
      const newX = newPoint.x + dx
      const newY = newPoint.y + dy

      // Remove the point if it's dragged out of the SVG
      if (newX < 0 || newY < 0 || newX > width || newY > height) {
        const pointIndex = Array.from(points).findIndex((point) => point.x === newPoint.x && point.y === newPoint.y)
        // Don't allow to drag out the first and last points
        if (pointIndex > 0 && pointIndex < points.numberOfItems - 1) {
          points.removeItem(pointIndex)
          circle.remove()
          this.emit('point-dragout', refPoint)
        }
        return
      }

      // Don't allow to drag past the next or previous point
      const next = Array.from(points).find((point) => point.x > newPoint.x)
      const prev = Array.from(points).findLast((point) => point.x < newPoint.x)
      if ((next && newX >= next.x) || (prev && newX <= prev.x)) {
        return
      }

      // Update the point and the circle position
      newPoint.x = newX
      newPoint.y = newY
      circle.setAttribute('cx', newX.toString())
      circle.setAttribute('cy', newY.toString())

      // Emit the event passing the relative coordinates
      this.emit('point-move', refPoint, newX / width, newY / height)
    })
  }

  update() {
    const { svg } = this
    const aspectRatioX = svg.viewBox.baseVal.width / svg.clientWidth
    const aspectRatioY = svg.viewBox.baseVal.height / svg.clientHeight
    const circles = svg.querySelectorAll('ellipse')

    circles.forEach((circle) => {
      const radius = this.options.dragPointSize / 2
      const rx = radius * aspectRatioX
      const ry = radius * aspectRatioY
      circle.setAttribute('rx', rx.toString())
      circle.setAttribute('ry', ry.toString())
    })
  }

  destroy() {
    this.svg.remove()
  }
}

class EnvelopePlugin extends BasePlugin<EnvelopePluginEvents, EnvelopePluginOptions> {
  protected options: Options
  private polyline: Polyline | null = null

  /**
   * Create a new Envelope plugin.
   */
  constructor(options: EnvelopePluginOptions) {
    super(options)

    this.options = Object.assign({}, defaultOptions, options)
    this.options.lineColor = this.options.lineColor || defaultOptions.lineColor
    this.options.dragPointFill = this.options.dragPointFill || defaultOptions.dragPointFill
    this.options.dragPointStroke = this.options.dragPointStroke || defaultOptions.dragPointStroke
  }

  public static create(options: EnvelopePluginOptions) {
    return new EnvelopePlugin(options)
  }

  /**
   * Add an envelope point with a given time and volume.
   */
  public addPoint(point: EnvelopePoint) {
    // Insert the point in the correct position
    const index = this.options.points.findLastIndex((p) => p.time < point.time)
    if (index === -1) {
      this.options.points.unshift(point)
    } else {
      this.options.points.splice(index + 1, 0, point)
    }

    this.emit('points-change', this.options.points)

    // Add the point to the polyline if the duration is available
    const duration = this.wavesurfer?.getDuration()
    if (duration) {
      this.polyline?.addPolyPoint(point.time / duration, point.volume, point)
    }
  }

  /**
   * Remove an envelope point.
   */
  public removePoint(point: EnvelopePoint) {
    const index = this.options.points.findIndex((p) => p === point)
    if (index !== -1) {
      this.options.points.splice(index, 1)
      this.emit('points-change', this.options.points)
    }
  }

  /**
   * Destroy the plugin instance.
   */
  public destroy() {
    this.polyline?.destroy()
    super.destroy()
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    this.initVolumeRamps()

    this.subscriptions.push(
      this.wavesurfer.on('decode', (duration) => {
        this.initPolyline()

        // Add initial points
        const initialVolume = this.options.points.length > 0 ? 0 : this.wavesurfer?.getVolume() || 0
        if (!this.options.points.some((p) => p.time === 0)) {
          this.options.points.unshift({ time: 0, volume: initialVolume })
        }
        if (!this.options.points.some((p) => p.time === duration)) {
          this.options.points.push({ time: duration, volume: initialVolume })
        }

        this.options.points.forEach((point) => {
          this.polyline?.addPolyPoint(point.time / duration, point.volume, point)
        })
      }),

      this.wavesurfer.on('dblclick', (relativeX, relativeY) => {
        this.addPoint({
          time: relativeX * (this.wavesurfer?.getDuration() || 0),
          volume: 1 - relativeY,
        })
      }),

      this.wavesurfer.on('redraw', () => {
        this.polyline?.update()
      }),
    )
  }

  private initPolyline() {
    if (this.polyline) this.polyline.destroy()
    if (!this.wavesurfer) return

    const wrapper = this.wavesurfer.getWrapper()

    this.polyline = new Polyline(this.options, wrapper)

    this.subscriptions.push(
      this.polyline.on('point-move', (point, relativeX, relativeY) => {
        const duration = this.wavesurfer?.getDuration() || 0
        point.time = relativeX * duration
        point.volume = 1 - relativeY

        this.emit('points-change', this.options.points)
      }),

      this.polyline.on('point-dragout', (point) => {
        this.removePoint(point)
      }),
    )
  }

  private initVolumeRamps() {
    const { wavesurfer } = this
    if (!wavesurfer) return

    this.subscriptions.push(
      wavesurfer.on('timeupdate', (time) => {
        const nextPoint = this.options.points.find((point) => point.time > time)
        const prevPoint = this.options.points.findLast((point) => point.time <= time)
        if (!nextPoint || !prevPoint) return
        const timeDiff = nextPoint.time - prevPoint.time
        const volumeDiff = nextPoint.volume - prevPoint.volume
        const newVolume = prevPoint.volume + (time - prevPoint.time) * (volumeDiff / timeDiff)
        wavesurfer.setVolume(newVolume)
      }),
    )
  }
}

export default EnvelopePlugin
