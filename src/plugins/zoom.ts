/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel
 *
 * @author HoodyHuo (https://github.com/HoodyHuo)
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
  scale?: number // the amount of zoom per wheel step, e.g. 0.5 means a 50% magnification per scroll
  maxZoom?: number // the maximum pixels-per-second factor while zooming
}
const defaultOptions = {
  scale: 0.5,
}

export type ZoomPluginEvents = BasePluginEvents

class ZoomPlugin extends BasePlugin<ZoomPluginEvents, ZoomPluginOptions> {
  protected options: ZoomPluginOptions & typeof defaultOptions
  private wrapper: HTMLElement | undefined = undefined
  private container: HTMLElement | null = null

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

    const duration = this.wavesurfer.getDuration()
    const oldMinPxPerSec = this.wavesurfer.options.minPxPerSec
    const width = this.container.clientWidth
    const newMinPxPerSec = this.calculateNewZoom(oldMinPxPerSec, -e.deltaY)
    if (newMinPxPerSec * duration < width) {
      this.wavesurfer.zoom(width / duration)
    } else {
      this.wavesurfer.zoom(newMinPxPerSec)
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
