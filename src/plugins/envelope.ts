/**
 * Envelope is a visual UI for controlling the audio volume and add fade-in and fade-out effects.
 */

import BasePlugin from '../base-plugin.js'
import { makeDraggable } from '../draggable.js'
import EventEmitter from '../event-emitter.js'

export type EnvelopePluginOptions = {
  fadeInStart?: number
  fadeInEnd?: number
  fadeOutStart?: number
  fadeOutEnd?: number
  volume?: number
  lineWidth?: string
  lineColor?: string
  dragPointSize?: number
  dragPointFill?: string
  dragPointStroke?: string
}

const defaultOptions = {
  fadeInStart: 0,
  fadeOutEnd: 0,
  fadeInEnd: 0,
  fadeOutStart: 0,
  lineWidth: 4,
  lineColor: 'rgba(0, 0, 255, 0.5)',
  dragPointSize: 10,
  dragPointFill: 'rgba(255, 255, 255, 0.8)',
  dragPointStroke: 'rgba(255, 255, 255, 0.8)',
}

type Options = EnvelopePluginOptions & typeof defaultOptions

export type EnvelopePluginEvents = {
  'fade-in-change': [time: number]
  'fade-out-change': [time: number]
  'volume-change': [volume: number]
}

class Polyline extends EventEmitter<{
  'point-move': [index: number, relativeX: number]
  'line-move': [relativeY: number]
}> {
  private svg: SVGElement
  private padding: number
  private top = 0

  constructor(options: Options, wrapper: HTMLElement) {
    super()

    // An padding to make the envelope fit into the SVG
    this.padding = options.dragPointSize / 2 + 1

    // SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('viewBox', '0 0 0 0')
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('style', 'position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none;')
    svg.setAttribute('part', 'envelope')
    this.svg = svg

    // A polyline representing the envelope
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    polyline.setAttribute('points', '0,0 0,0 0,0 0,0')
    polyline.setAttribute('stroke', options.lineColor)
    polyline.setAttribute('stroke-width', options.lineWidth)
    polyline.setAttribute('fill', 'none')
    polyline.setAttribute('style', 'pointer-events: none;')
    polyline.setAttribute('part', 'polyline')
    svg.appendChild(polyline)

    // Draggable top line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('stroke', 'transparent')
    line.setAttribute('stroke-width', (options.lineWidth * 3).toString())
    line.setAttribute('style', 'cursor: ns-resize; pointer-events: all;')
    line.setAttribute('part', 'line')
    svg.appendChild(line)

    // Drag points
    ;[0, 1].forEach(() => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('r', (options.dragPointSize / 2).toString())
      circle.setAttribute('fill', options.dragPointFill)
      circle.setAttribute('stroke', options.dragPointStroke || options.dragPointFill)
      circle.setAttribute('stroke-width', '2')
      circle.setAttribute('style', 'cursor: ew-resize; pointer-events: all;')
      circle.setAttribute('part', 'circle')
      svg.appendChild(circle)
    })

    wrapper.appendChild(svg)

    // Init dtagging
    {
      // On top line drag
      const onDragY = (dy: number) => {
        const newTop = this.top + dy
        const { height } = svg.viewBox.baseVal
        if (newTop < -0.5 || newTop > height) return
        const relativeY = Math.min(1, Math.max(0, (height - newTop) / height))
        this.emit('line-move', relativeY)
      }

      // On points drag
      const onDragX = (index: number, dx: number) => {
        const point = polyline.points.getItem(index)
        const newX = point.x + dx
        const { width } = svg.viewBox.baseVal
        this.emit('point-move', index, newX / width)
      }

      // Draggable top line of the polyline
      this.makeDraggable(line, (_, y) => onDragY(y))

      // Make each point draggable
      const draggables = this.svg.querySelectorAll('circle')
      Array.from(draggables).forEach((draggable, index) => {
        this.makeDraggable(draggable, (x) => onDragX(index + 1, x))
      })
    }
  }

  private makeDraggable(draggable: SVGElement, onDrag: (x: number, y: number) => void) {
    makeDraggable(draggable as unknown as HTMLElement, onDrag)
  }

  update({ x1, x2, x3, x4, y }: { x1: number; x2: number; x3: number; x4: number; y: number }) {
    const width = this.svg.clientWidth
    const height = this.svg.clientHeight

    this.top = height - y * height

    const paddedTop = Math.max(this.padding, Math.min(this.top, height - this.padding))

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

    const polyline = this.svg.querySelector('polyline') as SVGPolylineElement
    const { points } = polyline
    points.getItem(0).x = x1 * width
    points.getItem(0).y = height
    points.getItem(1).x = x2 * width
    points.getItem(1).y = paddedTop
    points.getItem(2).x = x3 * width
    points.getItem(2).y = paddedTop
    points.getItem(3).x = x4 * width
    points.getItem(3).y = height

    const line = this.svg.querySelector('line') as SVGLineElement
    line.setAttribute('x1', points.getItem(1).x.toString())
    line.setAttribute('x2', points.getItem(2).x.toString())
    line.setAttribute('y1', paddedTop.toString())
    line.setAttribute('y2', paddedTop.toString())

    const circles = this.svg.querySelectorAll('circle')
    Array.from(circles).forEach((circle, i) => {
      const point = points.getItem(i + 1)
      circle.setAttribute('cx', point.x.toString())
      circle.setAttribute('cy', point.y.toString())
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
  private volume = 1
  private isFadingIn = false
  private isFadingOut = false
  // Adjust the exponent to change the curve of the volume control
  private readonly naturalVolumeExponent = 1.5

  constructor(options: EnvelopePluginOptions) {
    super(options)

    this.options = Object.assign({}, defaultOptions, options)
    this.options.lineColor = this.options.lineColor || defaultOptions.lineColor
    this.options.dragPointFill = this.options.dragPointFill || defaultOptions.dragPointFill
    this.options.dragPointStroke = this.options.dragPointStroke || defaultOptions.dragPointStroke

    this.volume = this.options.volume ?? 1
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

    this.initWebAudio()
    this.initSvg()
    this.initFadeEffects()

    this.subscriptions.push(
      this.wavesurfer.on('redraw', () => {
        const duration = this.wavesurfer?.getDuration()
        if (!duration) return
        this.options.fadeInStart = this.options.fadeInStart || 0
        this.options.fadeOutEnd = this.options.fadeOutEnd || duration
        this.options.fadeInEnd = this.options.fadeInEnd || this.options.fadeInStart
        this.options.fadeOutStart = this.options.fadeOutStart || this.options.fadeOutEnd
        this.renderPolyline()
      }),
    )
  }

  private initSvg() {
    if (!this.wavesurfer) return

    const wrapper = this.wavesurfer.getWrapper()

    this.polyline = new Polyline(this.options, wrapper)

    this.subscriptions.push(
      this.polyline.on('line-move', (relativeY: number) => {
        this.setVolume(this.naturalVolume(relativeY))
      }),

      this.polyline.on('point-move', (index, relativeX) => {
        const duration = this.wavesurfer?.getDuration() || 0
        const newTime = relativeX * duration

        // Fade-in end point
        if (index === 1) {
          if (newTime < this.options.fadeInStart || newTime > this.options.fadeOutStart) return
          this.options.fadeInEnd = newTime
          this.emit('fade-in-change', newTime)
        } else if (index === 2) {
          // Fade-out start point
          if (newTime > this.options.fadeOutEnd || newTime < this.options.fadeInEnd) return
          this.options.fadeOutStart = newTime
          this.emit('fade-out-change', newTime)
        }

        this.renderPolyline()
      }),
    )
  }

  private renderPolyline() {
    if (!this.polyline || !this.wavesurfer) return
    const duration = this.wavesurfer.getDuration()
    if (!duration) return

    this.polyline.update({
      x1: this.options.fadeInStart / duration,
      x2: this.options.fadeInEnd / duration,
      x3: this.options.fadeOutStart / duration,
      x4: this.options.fadeOutEnd / duration,
      y: this.invertNaturalVolume(this.volume),
    })
  }

  private initWebAudio() {
    const audio = this.wavesurfer?.getMediaElement()
    if (!audio) return null

    this.volume = this.options.volume ?? audio.volume

    // Create an AudioContext
    const audioContext = new window.AudioContext()

    // Create a GainNode for controlling the volume
    this.gainNode = audioContext.createGain()
    this.setGainValue()

    // Create a MediaElementAudioSourceNode using the audio element
    const source = audioContext.createMediaElementSource(audio)

    // Connect the source to the GainNode, and the GainNode to the destination (speakers)
    source.connect(this.gainNode)
    this.gainNode.connect(audioContext.destination)

    this.audioContext = audioContext
  }

  private invertNaturalVolume(value: number): number {
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

  private setGainValue() {
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume
    }
  }

  private initFadeEffects() {
    if (!this.audioContext || !this.wavesurfer) return

    const unsub = this.wavesurfer.on('timeupdate', (currentTime) => {
      if (!this.audioContext || !this.gainNode) return
      if (!this.wavesurfer?.isPlaying()) return

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume()
      }

      // Fade in
      if (!this.isFadingIn && currentTime >= this.options.fadeInStart && currentTime <= this.options.fadeInEnd) {
        this.isFadingIn = true
        // Set the initial gain (volume) to 0 (silent)
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
        // Set the target gain (volume) to 1 (full volume) over N seconds
        this.gainNode.gain.linearRampToValueAtTime(
          this.volume,
          this.audioContext.currentTime + (this.options.fadeInEnd - currentTime),
        )
        return
      }

      // Fade out
      if (!this.isFadingOut && currentTime >= this.options.fadeOutStart && currentTime <= this.options.fadeOutEnd) {
        this.isFadingOut = true
        /**
         * Set the gain at this point in time to the current volume, otherwise
         * the audio will start fading out from the fade-in point.
         */
        this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime)
        // Set the target gain (volume) to 0 (silent) over N seconds
        this.gainNode.gain.linearRampToValueAtTime(
          0,
          this.audioContext.currentTime + (this.options.fadeOutEnd - currentTime),
        )
        return
      }

      // Reset fade in/out
      let cancelRamp = false
      if (this.isFadingIn && (currentTime < this.options.fadeInStart || currentTime > this.options.fadeInEnd)) {
        this.isFadingIn = false
        cancelRamp = true
      }
      if (this.isFadingOut && (currentTime < this.options.fadeOutStart || currentTime >= this.options.fadeOutEnd)) {
        this.isFadingOut = false
        cancelRamp = true
      }
      if (cancelRamp) {
        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime)
        this.setGainValue()
      }
    })

    this.subscriptions.push(unsub)
  }

  /** Get the current audio volume */
  public getCurrentVolume() {
    return this.gainNode ? this.gainNode.gain.value : this.volume
  }

  /**
   * Set the fade-in start time.
   * @param time The time (in seconds) to set the fade-in start time to
   * @param moveFadeInEnd Whether to move the drag point to the new time (default: false)
   */
  public setStartTime(time: number, moveFadeInEnd = false) {
    if (moveFadeInEnd) {
      const rampLength = this.options.fadeInEnd - this.options.fadeInStart
      this.options.fadeInEnd = time + rampLength
    }

    this.options.fadeInStart = time

    this.renderPolyline()
  }

  /** Set the fade-in end time.
   * @param time The time (in seconds) to set the fade-in end time to
   * @param moveFadeOutStart Whether to move the drag point to the new time (default: false)
   */
  public setEndTime(time: number, moveFadeOutStart = false) {
    if (moveFadeOutStart) {
      const rampLength = this.options.fadeOutEnd - this.options.fadeOutStart
      this.options.fadeOutStart = time - rampLength
    }

    this.options.fadeOutEnd = time

    this.renderPolyline()
  }

  /** Set the volume of the audio */
  public setVolume(volume: number) {
    this.volume = volume
    this.setGainValue()
    this.renderPolyline()
    this.emit('volume-change', volume)
  }
}

export default EnvelopePlugin
