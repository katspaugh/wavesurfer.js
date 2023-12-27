/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel
 *
 * @author HoodyHuo (https://github.com/HoodyHuo)
 * @author Chris Morbitzer (https://github.com/cmorbitzer)
 * @author Sam Hulick (https://github.com/ffxsam)
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
}
const defaultOptions = {
  scale: 0.5,
  deltaThreshold: 5,
}

export type ZoomPluginEvents = BasePluginEvents

class ZoomPlugin extends BasePlugin<ZoomPluginEvents, ZoomPluginOptions> {
  protected options: ZoomPluginOptions & typeof defaultOptions
  private wrapper: HTMLElement | undefined = undefined
  private container: HTMLElement | null = null
  private accumulatedDelta = 0

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
    this.wrapper.addEventListener('wheel', this.onWheel)
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.wavesurfer || !this.container || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      return
    }
    // prevent scrolling the sidebar while zooming
    e.preventDefault()

    // Update the accumulated delta...
    this.accumulatedDelta += -e.deltaY

    // ...and only scroll once we've hit our threshold
    if (this.options.deltaThreshold === 0 || Math.abs(this.accumulatedDelta) >= this.options.deltaThreshold) {
      const duration = this.wavesurfer.getDuration()
      const oldMinPxPerSec = this.wavesurfer.options.minPxPerSec
      const x = e.clientX
      const width = this.container.clientWidth
      const scrollX = this.wavesurfer.getScroll()
      const pointerTime = (scrollX + x) / oldMinPxPerSec
      const newMinPxPerSec = this.calculateNewZoom(oldMinPxPerSec, this.accumulatedDelta)
      const newLeftSec = (width / newMinPxPerSec) * (x / width)

      if (newMinPxPerSec * duration < width) {
        this.wavesurfer.zoom(width / duration)
        this.container.scrollLeft = 0
      } else {
        this.wavesurfer.zoom(newMinPxPerSec)
        this.container.scrollLeft = (pointerTime - newLeftSec) * newMinPxPerSec
      }

      // Reset the accumulated delta
      this.accumulatedDelta = 0
    }
  }

  private calculateNewZoom = (oldZoom: number, delta: number) => {
    const newZoom = Math.max(0, oldZoom + delta * this.options.scale)
    return typeof this.options.maxZoom === 'undefined' ? newZoom : Math.min(newZoom, this.options.maxZoom)
  }

  destroy() {
    if (this.wrapper) {
      this.wrapper.removeEventListener('wheel', this.onWheel)
    }
    super.destroy()
  }
}

export default ZoomPlugin
