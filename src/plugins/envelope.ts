/**
 * Envelope is a visual UI for controlling the audio volume and add fade-in and fade-out effects.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import { makeDraggable } from '../draggable.js'
import EventEmitter from '../event-emitter.js'

export type EnvelopePoint = {
  id?: string
  time: number // in seconds
  volume: number // 0 to 1
}

export type EnvelopePluginOptions = {
  points?: EnvelopePoint[]
  volume?: number
  lineWidth?: string
  lineColor?: string
  dragLine?: boolean
  dragPointSize?: number
  dragPointFill?: string
  dragPointStroke?: string
  audioContext?: AudioContext
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
  'point-create': [relativeX: number, relativeY: number]
  'line-move': [relativeY: number]
}> {
  private svg: SVGSVGElement
  private options: Options
  private polyPoints: Map<
    EnvelopePoint,
    {
      polyPoint: SVGPoint
      circle: SVGEllipseElement
    }
  >

  constructor(options: Options, wrapper: HTMLElement) {
    super()

    this.options = options
    this.polyPoints = new Map()

    const width = wrapper.clientWidth
    const height = wrapper.clientHeight

    // SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('style', 'position: absolute; left: 0; top: 0; z-index: 4;')
    svg.setAttribute('part', 'envelope')
    this.svg = svg

    // A polyline representing the envelope
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    polyline.setAttribute('points', `0,${height} ${width},${height}`)
    polyline.setAttribute('stroke', options.lineColor)
    polyline.setAttribute('stroke-width', options.lineWidth)
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('part', 'polyline')
    polyline.setAttribute('style', options.dragLine ? 'cursor: row-resize; pointer-events: stroke;' : '')
    svg.appendChild(polyline)

    wrapper.appendChild(svg)

    // Make the polyline draggable along the Y axis
    if (options.dragLine) {
      makeDraggable(polyline as unknown as HTMLElement, (_, dy) => {
        const { height } = svg.viewBox.baseVal
        const { points } = polyline
        for (let i = 1; i < points.numberOfItems - 1; i++) {
          const point = points.getItem(i)
          point.y = Math.min(height, Math.max(0, point.y + dy))
        }
        const circles = svg.querySelectorAll('ellipse')
        Array.from(circles).forEach((circle) => {
          const newY = Math.min(height, Math.max(0, Number(circle.getAttribute('cy')) + dy))
          circle.setAttribute('cy', newY.toString())
        })

        this.emit('line-move', dy / height)
      })
    }

    // Listen to double click to add a new point
    svg.addEventListener('dblclick', (e) => {
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.emit('point-create', x / rect.width, y / rect.height)
    })

    // Long press on touch devices
    {
      let pressTimer: number

      const clearTimer = () => clearTimeout(pressTimer)

      svg.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          pressTimer = window.setTimeout(() => {
            e.preventDefault()
            const rect = svg.getBoundingClientRect()
            const x = e.touches[0].clientX - rect.left
            const y = e.touches[0].clientY - rect.top
            this.emit('point-create', x / rect.width, y / rect.height)
          }, 500)
        } else {
          clearTimer()
        }
      })

      svg.addEventListener('touchmove', clearTimer)

      svg.addEventListener('touchend', clearTimer)
    }
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
    const size = this.options.dragPointSize
    const radius = size / 2
    circle.setAttribute('rx', radius.toString())
    circle.setAttribute('ry', radius.toString())
    circle.setAttribute('fill', this.options.dragPointFill)
    if (this.options.dragPointStroke) {
      circle.setAttribute('stroke', this.options.dragPointStroke)
      circle.setAttribute('stroke-width', '2')
    }
    circle.setAttribute('style', 'cursor: grab; pointer-events: all;')
    circle.setAttribute('part', 'envelope-circle')
    circle.setAttribute('cx', x.toString())
    circle.setAttribute('cy', y.toString())
    this.svg.appendChild(circle)
    return circle
  }

  removePolyPoint(point: EnvelopePoint) {
    const item = this.polyPoints.get(point)
    if (!item) return
    const { polyPoint, circle } = item
    const { points } = this.svg.querySelector('polyline') as SVGPolylineElement
    const index = Array.from(points).findIndex((p) => p.x === polyPoint.x && p.y === polyPoint.y)
    points.removeItem(index)
    circle.remove()
    this.polyPoints.delete(point)
  }

  addPolyPoint(relX: number, relY: number, refPoint: EnvelopePoint) {
    const { svg } = this
    const { width, height } = svg.viewBox.baseVal
    const x = relX * width
    const y = height - relY * height
    const threshold = this.options.dragPointSize / 2

    const newPoint = svg.createSVGPoint()
    newPoint.x = relX * width
    newPoint.y = height - relY * height

    const circle = this.createCircle(x, y)
    const { points } = svg.querySelector('polyline') as SVGPolylineElement
    const newIndex = Array.from(points).findIndex((point) => point.x >= x)
    points.insertItemBefore(newPoint, Math.max(newIndex, 1))

    this.polyPoints.set(refPoint, { polyPoint: newPoint, circle })

    this.makeDraggable(circle, (dx, dy) => {
      const newX = newPoint.x + dx
      const newY = newPoint.y + dy

      // Remove the point if it's dragged out of the SVG
      if (newX < -threshold || newY < -threshold || newX > width + threshold || newY > height + threshold) {
        this.emit('point-dragout', refPoint)
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

      // Emit the event passing the point and new relative coordinates
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
    this.polyPoints.clear()
    this.svg.remove()
  }
}

const randomId = () => Math.random().toString(36).slice(2)

class EnvelopePlugin extends BasePlugin<EnvelopePluginEvents, EnvelopePluginOptions> {
  protected options: Options
  private polyline: Polyline | null = null
  private points: EnvelopePoint[]
  private throttleTimeout: ReturnType<typeof setTimeout> | null = null
  private ac: AudioContext | null = null
  private gain: GainNode['gain'] | null = null
  private volume = 1

  /**
   * Create a new Envelope plugin.
   */
  constructor(options: EnvelopePluginOptions) {
    super(options)

    this.points = options.points || []

    this.options = Object.assign({}, defaultOptions, options)
    this.options.lineColor = this.options.lineColor || defaultOptions.lineColor
    this.options.dragPointFill = this.options.dragPointFill || defaultOptions.dragPointFill
    this.options.dragPointStroke = this.options.dragPointStroke || defaultOptions.dragPointStroke
    this.options.dragPointSize = this.options.dragPointSize || defaultOptions.dragPointSize
  }

  public static create(options: EnvelopePluginOptions) {
    return new EnvelopePlugin(options)
  }

  /**
   * Add an envelope point with a given time and volume.
   */
  public addPoint(point: EnvelopePoint) {
    if (!point.id) point.id = randomId()

    // Insert the point in the correct position to keep the array sorted
    const index = this.points.findLastIndex((p) => p.time < point.time)
    this.points.splice(index + 1, 0, point)

    this.emitPoints()

    // Add the point to the polyline if the duration is available
    const duration = this.wavesurfer?.getDuration()
    if (duration) {
      this.addPolyPoint(point, duration)
    }
  }

  /**
   * Remove an envelope point.
   */
  public removePoint(point: EnvelopePoint) {
    const index = this.points.indexOf(point)
    if (index > -1) {
      this.points.splice(index, 1)
      this.polyline?.removePolyPoint(point)
      this.emitPoints()
    }
  }

  /**
   * Get all envelope points. Should not be modified directly.
   */
  public getPoints(): EnvelopePoint[] {
    return this.points
  }

  /**
   * Set new envelope points.
   */
  public setPoints(newPoints: EnvelopePoint[]) {
    this.points.slice().forEach((point) => this.removePoint(point))
    newPoints.forEach((point) => this.addPoint(point))
  }

  /**
   * Destroy the plugin instance.
   */
  public destroy() {
    if (this.ac && this.ac !== this.options.audioContext) {
      this.ac.close()
    }
    this.polyline?.destroy()
    super.destroy()
  }

  /**
   * Get the envelope volume.
   */
  public getCurrentVolume(): number {
    return this.volume
  }

  /**
   * Set the envelope volume. 0..1 (more than 1 will boost the volume).
   */
  public setVolume(floatValue: number) {
    this.volume = floatValue
    if (this.gain) {
      this.gain.value = this.volume
    }
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    const { options } = this
    options.volume = options.volume ?? this.wavesurfer.getVolume()

    this.initAudioContext(this.wavesurfer.getMediaElement())
    this.setVolume(options.volume)

    this.subscriptions.push(
      this.wavesurfer.on('decode', (duration) => {
        this.initPolyline()

        this.points.forEach((point) => {
          this.addPolyPoint(point, duration)
        })
      }),

      this.wavesurfer.on('redraw', () => {
        this.polyline?.update()
      }),

      this.wavesurfer.on('timeupdate', (time) => {
        this.onTimeUpdate(time)
      }),

      this.wavesurfer.on('play', () => {
        if (this.ac?.state === 'suspended') {
          this.ac.resume()
        }
      }),
    )
  }

  private initAudioContext(mediaElement: HTMLMediaElement) {
    const ac = this.options.audioContext || new AudioContext()
    const gainNode = ac.createGain()
    gainNode.gain.value = this.options.volume ?? 1
    gainNode.connect(ac.destination)

    // Create a media element source
    const source = ac.createMediaElementSource(mediaElement)
    source.connect(gainNode)

    this.ac = ac
    this.gain = gainNode.gain
  }

  private emitPoints() {
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout)
    }
    this.throttleTimeout = setTimeout(() => {
      this.emit('points-change', this.points)
    }, 200)
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

        this.emitPoints()
      }),

      this.polyline.on('point-dragout', (point) => {
        this.removePoint(point)
      }),

      this.polyline.on('point-create', (relativeX, relativeY) => {
        this.addPoint({
          time: relativeX * (this.wavesurfer?.getDuration() || 0),
          volume: 1 - relativeY,
        })
      }),

      this.polyline.on('line-move', (relativeY) => {
        this.points.forEach((point) => {
          point.volume = Math.min(1, Math.max(0, point.volume - relativeY))
        })

        this.emitPoints()

        this.onTimeUpdate(this.wavesurfer?.getCurrentTime() || 0)
      }),
    )
  }

  private addPolyPoint(point: EnvelopePoint, duration: number) {
    this.polyline?.addPolyPoint(point.time / duration, point.volume, point)
  }

  private onTimeUpdate(time: number) {
    if (!this.wavesurfer) return
    let nextPoint = this.points.find((point) => point.time > time)
    if (!nextPoint) {
      nextPoint = { time: this.wavesurfer.getDuration() || 0, volume: 0 }
    }
    let prevPoint = this.points.findLast((point) => point.time <= time)
    if (!prevPoint) {
      prevPoint = { time: 0, volume: 0 }
    }
    const timeDiff = nextPoint.time - prevPoint.time
    const volumeDiff = nextPoint.volume - prevPoint.volume
    const newVolume = prevPoint.volume + (time - prevPoint.time) * (volumeDiff / timeDiff)
    const clampedVolume = Math.min(1, Math.max(0, newVolume))
    const roundedVolume = Math.round(clampedVolume * 100) / 100

    if (roundedVolume !== this.getCurrentVolume()) {
      this.setVolume(roundedVolume)
      this.emit('volume-change', roundedVolume)
    }
  }
}

export default EnvelopePlugin
