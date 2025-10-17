/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel or using pinch-to-zoom
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
  private accumulatedDelta = 0
  private pointerTime: number = 0
  private oldX: number = 0
  private endZoom: number = 0
  private startZoom: number = 0

  // NEW: State for pinch-to-zoom
  private isPinching = false
  private lastPinchDistance = 0

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
    // Wheel listener
    this.container.addEventListener('wheel', this.onWheel)

    // NEW: Touch listeners for pinch-to-zoom
    // We use { passive: false } to be able to call e.preventDefault()
    // and stop the browser's native pinch-to-zoom on the page.
    this.container.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.container.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.container.addEventListener('touchend', this.onTouchEnd, { passive: false })

    if (typeof this.options.maxZoom === 'undefined') {
      this.options.maxZoom = this.container.clientWidth
    }
    this.endZoom = this.options.maxZoom
  }

  // MODIFIED: onWheel is now a thin wrapper around the new onZoom method
  private onWheel = (e: WheelEvent) => {
    if (!this.wavesurfer || !this.container || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      return
    }
    // prevent scrolling the sidebar while zooming
    e.preventDefault()

    // Pass the delta and the anchor point (mouse X) to the shared zoom logic
    this.onZoom(-e.deltaY, e.clientX)
  }

  // NEW: Get the distance between two touch points
  private getTouchDistance(e: TouchEvent): number {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2))
  }

  // NEW: Get the center X coordinate between two touch points
  private getTouchCenterX(e: TouchEvent): number {
    const touch1 = e.touches[0]
    const touch2 = e.touches[1]
    return (touch1.clientX + touch2.clientX) / 2
  }

  // NEW: Handle touch start
  private onTouchStart = (e: TouchEvent) => {
    // Check if two fingers are used
    if (e.touches.length === 2) {
      e.preventDefault() // Prevent text selection, etc.
      this.isPinching = true
      this.lastPinchDistance = this.getTouchDistance(e)
    }
  }

  // NEW: Handle touch move
  private onTouchMove = (e: TouchEvent) => {
    // Only zoom if we're in a pinching state with two fingers
    if (!this.isPinching || e.touches.length !== 2) {
      return
    }
    e.preventDefault() // CRITICAL: Stop the browser from zooming the whole page

    const newDistance = this.getTouchDistance(e)
    const newCenterX = this.getTouchCenterX(e)
    // The delta is the change in distance since the last move event
    const delta = newDistance - this.lastPinchDistance
    // Update the last distance for the next event
    this.lastPinchDistance = newDistance

    // Pass the delta and the anchor point (pinch center X) to the shared zoom logic
    this.onZoom(delta, newCenterX)
  }

  // NEW: Handle touch end
  private onTouchEnd = (e: TouchEvent) => {
    // If we were pinching and now have less than 2 fingers, stop
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false
      this.lastPinchDistance = 0
      this.accumulatedDelta = 0 // Reset accumulation on gesture end
    }
  }

  // NEW: Refactored core zoom logic
  // This was extracted from the original onWheel method
  private onZoom = (delta: number, anchorX: number) => {
    if (!this.wavesurfer || !this.container) return

    // Update the accumulated delta...
    this.accumulatedDelta += delta

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

      // Get X relative to the container
      const x = anchorX - this.container.getBoundingClientRect().left
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

  destroy() {
    if (this.container) {
      this.container.removeEventListener('wheel', this.onWheel)
      // NEW: Remove touch listeners
      this.container.removeEventListener('touchstart', this.onTouchStart)
      this.container.removeEventListener('touchmove', this.onTouchMove)
      this.container.removeEventListener('touchend', this.onTouchEnd)
    }
    super.destroy()
  }
}

export default ZoomPlugin