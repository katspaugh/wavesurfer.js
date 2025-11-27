/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel
 *
 * @author HoodyHuo (https://github.com/HoodyHuo)
 * @author Chris Morbitzer (https://github.com/cmorbitzer)
 * @author Sam Hulick (https://github.com/ffxsam)
 * @author Gustav Sollenius (https://github.com/gustavsollenius)
 * @author Viktor Jevdokimov (https://github.com/vitar)
 *
 * @example
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     ZoomPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */

import { BasePlugin, BasePluginEvents } from '../base-plugin.js'
import { effect } from '../reactive/store.js'

export type ZoomPluginOptions = {
  /**
   * The amount of zoom per wheel step, e.g. 0.5 means a 50% magnification per scroll
   *
   * @default 0.5
   */
  scale?: number
  maxZoom?: number // The maximum pixels-per-second factor while zooming
  /**
   * The amount the wheel or trackpad needs to be moved before zooming the waveform. Set this value to 0 to have totally
   * fluid zooming (this has a high CPU cost).
   *
   * @default 5
   */
  deltaThreshold?: number
  /**
   * Whether to zoom into the waveform using a consistent exponential factor instead of a linear scale.
   * Exponential zooming ensures the zoom steps feel uniform regardless of scale.
   * When disabled, the zooming is linear and influenced by the `scale` parameter.
   *
   * @default false
   */
  exponentialZooming?: boolean
  /**
   * Number of steps required to zoom from the initial zoom level to `maxZoom`.
   *
   * @default 20
   */
  iterations?: number
}
const defaultOptions = {
  scale: 0.5,
  deltaThreshold: 5,
  exponentialZooming: false,
  iterations: 20,
}

export type ZoomPluginEvents = BasePluginEvents

class ZoomPlugin extends BasePlugin<ZoomPluginEvents, ZoomPluginOptions> {
  protected options: ZoomPluginOptions & typeof defaultOptions
  private wrapper: HTMLElement | undefined = undefined
  private container: HTMLElement | null = null

  // State for wheel zoom
  private accumulatedDelta = 0
  private pointerTime: number = 0
  private oldX: number = 0
  private endZoom: number = 0
  private startZoom: number = 0

  // State for proportional pinch-to-zoom
  private isPinching = false
  private initialPinchDistance = 0
  private initialZoom = 0

  constructor(options?: ZoomPluginOptions) {
    super(options || {})
    this.options = Object.assign({}, defaultOptions, options)
  }

  public static create(options?: ZoomPluginOptions) {
    return new ZoomPlugin(options)
  }

  onInit() {
    this.wrapper = this.wavesurfer?.getWrapper()
    if (!this.wrapper) {
      return
    }
    this.container = this.wrapper.parentElement as HTMLElement

    if (typeof this.options.maxZoom === 'undefined') {
      this.options.maxZoom = this.container.clientWidth
    }
    this.endZoom = this.options.maxZoom

    // Get reactive state
    const state = this.wavesurfer?.getState()

    // React to zoom state changes to update internal state
    if (state) {
      this.subscriptions.push(
        effect(() => {
          const zoom = state.zoom.value
          if (zoom > 0 && this.startZoom === 0 && this.options.exponentialZooming) {
            const duration = state.duration.value
            if (duration > 0 && this.container) {
              this.startZoom = this.container.clientWidth / duration
            }
          }
        }, [state.zoom, state.duration]),
      )
    }

    // Attach event listeners
    this.container.addEventListener('wheel', this.onWheel)
    this.container.addEventListener('touchstart', this.onTouchStart, { passive: false, capture: true })
    this.container.addEventListener('touchmove', this.onTouchMove, { passive: false, capture: true })
    this.container.addEventListener('touchend', this.onTouchEnd, { passive: false, capture: true })
    this.container.addEventListener('touchcancel', this.onTouchEnd, { passive: false, capture: true })
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.wavesurfer || !this.container || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      return
    }
    // prevent scrolling the sidebar while zooming
    e.preventDefault()

    // Update the accumulated delta...
    this.accumulatedDelta += -e.deltaY

    if (this.startZoom === 0 && this.options.exponentialZooming) {
      this.startZoom = this.wavesurfer.getWrapper().clientWidth / this.wavesurfer.getDuration()
    }

    // ...and only scroll once we've hit our threshold
    if (this.options.deltaThreshold === 0 || Math.abs(this.accumulatedDelta) >= this.options.deltaThreshold) {
      const duration = this.wavesurfer.getDuration()
      const oldMinPxPerSec =
        this.wavesurfer.options.minPxPerSec === 0
          ? this.wavesurfer.getWrapper().scrollWidth / duration
          : this.wavesurfer.options.minPxPerSec
      const x = e.clientX - this.container.getBoundingClientRect().left
      const width = this.container.clientWidth
      const scrollX = this.wavesurfer.getScroll()

      // Update pointerTime only if the pointer position has changed. This prevents the waveform from drifting during fixed zooming.
      if (x !== this.oldX || this.oldX === 0) {
        this.pointerTime = (scrollX + x) / oldMinPxPerSec
      }
      this.oldX = x

      const newMinPxPerSec = this.calculateNewZoom(oldMinPxPerSec, this.accumulatedDelta)
      const newLeftSec = (width / newMinPxPerSec) * (x / width)

      if (newMinPxPerSec * duration < width) {
        this.wavesurfer.zoom(width / duration)
        this.container.scrollLeft = 0
      } else {
        this.wavesurfer.zoom(newMinPxPerSec)
        this.container.scrollLeft = (this.pointerTime - newLeftSec) * newMinPxPerSec
      }

      // Reset the accumulated delta
      this.accumulatedDelta = 0
    }
  }

  private calculateNewZoom = (oldZoom: number, delta: number) => {
    let newZoom
    if (this.options.exponentialZooming) {
      const zoomFactor =
        delta > 0
          ? Math.pow(this.endZoom / this.startZoom, 1 / (this.options.iterations - 1))
          : Math.pow(this.startZoom / this.endZoom, 1 / (this.options.iterations - 1))
      newZoom = Math.max(0, oldZoom * zoomFactor)
    } else {
      // Default linear zooming
      newZoom = Math.max(0, oldZoom + delta * this.options.scale)
    }
    return Math.min(newZoom, this.options.maxZoom!)
  }

  private getTouchDistance(e: TouchEvent): number {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2))
  }

  private getTouchCenterX(e: TouchEvent): number {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    return (touch1.clientX + touch2.clientX) / 2
  }

  private onTouchStart = (e: TouchEvent) => {
    if (!this.wavesurfer || !this.container) return
    // Check if two fingers are used
    if (e.touches.length === 2) {
      e.preventDefault()
      this.isPinching = true

      // Store initial pinch distance
      this.initialPinchDistance = this.getTouchDistance(e)

      // Store initial zoom level
      const duration = this.wavesurfer.getDuration()
      this.initialZoom =
        this.wavesurfer.options.minPxPerSec === 0
          ? this.wavesurfer.getWrapper().scrollWidth / duration
          : this.wavesurfer.options.minPxPerSec

      // Store anchor point for zooming
      const x = this.getTouchCenterX(e) - this.container.getBoundingClientRect().left
      const scrollX = this.wavesurfer.getScroll()
      this.pointerTime = (scrollX + x) / this.initialZoom
      this.oldX = x // Use oldX to store the anchor X position
    }
  }

  private onTouchMove = (e: TouchEvent) => {
    if (!this.isPinching || e.touches.length !== 2 || !this.wavesurfer || !this.container) {
      return
    }
    e.preventDefault()

    // Calculate new zoom level
    const newDistance = this.getTouchDistance(e)
    const scaleFactor = newDistance / this.initialPinchDistance
    let newMinPxPerSec = this.initialZoom * scaleFactor

    // Constrain the zoom
    newMinPxPerSec = Math.min(newMinPxPerSec, this.options.maxZoom!)

    // Calculate minimum zoom (fit to width)
    const duration = this.wavesurfer.getDuration()
    const width = this.container.clientWidth
    const minZoom = width / duration
    if (newMinPxPerSec < minZoom) {
      newMinPxPerSec = minZoom
    }

    // Apply zoom and scroll
    const newLeftSec = (width / newMinPxPerSec) * (this.oldX / width)
    if (newMinPxPerSec === minZoom) {
      this.wavesurfer.zoom(minZoom)
      this.container.scrollLeft = 0
    } else {
      this.wavesurfer.zoom(newMinPxPerSec)
      this.container.scrollLeft = (this.pointerTime - newLeftSec) * newMinPxPerSec
    }
  }

  private onTouchEnd = (e: TouchEvent) => {
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false
      this.initialPinchDistance = 0
      this.initialZoom = 0
    }
  }

  destroy() {
    if (this.container) {
      this.container.removeEventListener('wheel', this.onWheel)
      this.container.removeEventListener('touchstart', this.onTouchStart)
      this.container.removeEventListener('touchmove', this.onTouchMove)
      this.container.removeEventListener('touchend', this.onTouchEnd)
      this.container.removeEventListener('touchcancel', this.onTouchEnd)
    }
    super.destroy()
  }
}

export default ZoomPlugin
