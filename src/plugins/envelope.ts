/**
 * Envelope is a visual UI for controlling the audio volume and add fade-in and fade-out effects.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import { makeDraggable } from '../draggable.js'
import EventEmitter from '../event-emitter.js'

type EnvelopePoint = {
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
  'fade-in-change': [time: number]
  'fade-out-change': [time: number]
  'volume-change': [volume: number]
}

class Polyline extends EventEmitter<{
  'point-move': [index: number, relativeX: number, relativeY: number]
}> {
  private svg: SVGSVGElement
  private options: Options
  private padding: number
  private top = 0

  constructor(options: Options, wrapper: HTMLElement) {
    super()

    this.options = options

    // An padding to make the envelope fit into the SVG
    this.padding = options.dragPointSize / 2 + 1

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

  addPoint(relX: number, relY: number) {
    const { svg } = this
    const { width, height } = svg.viewBox.baseVal
    const polyline = svg.querySelector('polyline') as SVGPolylineElement
    const newPoint = svg.createSVGPoint()
    newPoint.x = relX * width
    newPoint.y = height - relY * height
    const { points } = polyline
    const lastPoint = points.getItem(points.length - 1)
    points.removeItem(points.length - 1)
    points.appendItem(newPoint)
    points.appendItem(lastPoint)

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    const radius = this.options.dragPointSize / 2
    circle.setAttribute('rx', radius.toString())
    circle.setAttribute('ry', radius.toString())
    circle.setAttribute('fill', this.options.dragPointFill)
    circle.setAttribute('stroke', this.options.dragPointStroke || this.options.dragPointFill)
    circle.setAttribute('stroke-width', '2')
    circle.setAttribute('style', 'cursor: grab; pointer-events: all;')
    circle.setAttribute('part', 'circle')
    circle.setAttribute('cx', newPoint.x.toString())
    circle.setAttribute('cy', newPoint.y.toString())
    svg.appendChild(circle)

    const index = points.length - 1

    this.makeDraggable(circle, (dx, dy) => {
      const newX = newPoint.x + dx
      const newY = newPoint.y + dy
      newPoint.x = newX
      newPoint.y = newY
      circle.setAttribute('cx', newX.toString())
      circle.setAttribute('cy', newY.toString())
      const { width, height } = svg.viewBox.baseVal
      this.emit('point-move', index, newX / width, newY / height)
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
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  // Adjust the exponent to change the curve of the volume control
  private readonly naturalVolumeExponent = 1.5

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

  public destroy() {
    this.polyline?.destroy()
    super.destroy()
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    this.subscriptions.push(
      this.wavesurfer.on('decode', (duration) => {
        // Add initial points
        const initialVolume = this.options.points.length > 0 ? 0 : this.getCurrentVolume()
        this.options.points.unshift({ time: 0, volume: initialVolume })
        this.options.points.push({ time: duration, volume: initialVolume })
      }),

      this.wavesurfer.on('redraw', () => {
        const duration = this.wavesurfer?.getDuration()
        if (!duration) return
        this.renderPolyline()
      }),
    )

    this.initWebAudio()
    this.initSvg()
    this.initRamps()
  }

  private initSvg() {
    if (!this.wavesurfer) return

    const wrapper = this.wavesurfer.getWrapper()

    this.polyline = new Polyline(this.options, wrapper)

    this.subscriptions.push(
      this.wavesurfer.on('decode', (duration) => {
        this.options.points.forEach((point) => {
          this.polyline?.addPoint(point.time / duration, point.volume)
        })
      }),

      this.polyline.on('point-move', (index, relativeX, relativeY) => {
        const duration = this.wavesurfer?.getDuration() || 0
        const newTime = relativeX * duration
        const point = this.options.points[index]
        if (point) {
          point.time = newTime
          point.volume = relativeY
        }
      }),
    )
  }

  private renderPolyline() {
    if (!this.polyline || !this.wavesurfer) return
    const duration = this.wavesurfer.getDuration()
    if (!duration) return

    this.polyline.update()
  }

  private initWebAudio() {
    const audio = this.wavesurfer?.getMediaElement()
    if (!audio) return null

    // Create an AudioContext
    const audioContext = new window.AudioContext()

    // Create a GainNode for controlling the volume
    this.gainNode = audioContext.createGain()
    this.setGainValue(this.options.volume ?? audio.volume)

    // Create a MediaElementAudioSourceNode using the audio element
    const source = audioContext.createMediaElementSource(audio)

    // Connect the source to the GainNode, and the GainNode to the destination (speakers)
    source.connect(this.gainNode)
    this.gainNode.connect(audioContext.destination)

    this.audioContext = audioContext
  }

  private invertNaturalVolume(value: number): number {
    if (value === 0) return value
    const minValue = 0.0001
    const maxValue = 1
    const interpolatedValue = Math.pow((value - minValue) / (maxValue - minValue), 1 / this.naturalVolumeExponent)
    return interpolatedValue
  }

  private naturalVolume(value: number): number {
    const minValue = 0.0001
    const maxValue = 1
    const interpolatedValue = minValue + (maxValue - minValue) * Math.pow(value, this.naturalVolumeExponent)
    return interpolatedValue
  }

  private setGainValue(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume
    }
  }

  private cancelRamp(currentTime: number, startTime: number) {
    if (!this.audioContext || !this.gainNode) return
    this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime + (startTime - currentTime))
  }

  private addRamp(currentTime: number, startTime: number, startVolume: number, endTime: number, endVolume: number) {
    if (!this.audioContext || !this.gainNode) return
    console.log(startVolume, endVolume)
    this.gainNode.gain.setValueAtTime(startVolume, this.audioContext.currentTime + (startTime - currentTime))
    this.gainNode.gain.linearRampToValueAtTime(endVolume, this.audioContext.currentTime + (endTime - currentTime))
  }

  private initRamps() {
    const { wavesurfer } = this
    if (!wavesurfer) return

    this.subscriptions.push(
      wavesurfer.on('play', () => {
        const currentTime = wavesurfer.getCurrentTime() || 0

        this.options.points.forEach((point, index) => {
          const prevPoint = this.options.points[index - 1] || { time: 0, volume: 0 }
          this.addRamp(currentTime, prevPoint.time, prevPoint.volume, point.time, point.volume)
        })
      }),

      wavesurfer.on('pause', () => {
        const currentTime = wavesurfer.getCurrentTime() || 0

        this.options.points.forEach((point) => {
          this.cancelRamp(currentTime, point.time)
        })
      }),
    )
  }

  /** Get the current audio volume */
  public getCurrentVolume() {
    return this.gainNode ? this.gainNode.gain.value : 0
  }

  /** Set the volume of the audio */
  public setVolume(volume: number) {
    this.setGainValue(volume)
    this.renderPolyline()
    this.emit('volume-change', volume)
  }
}

export default EnvelopePlugin
