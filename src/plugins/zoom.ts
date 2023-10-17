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
  scale?: number // the amount of zoom per wheel step, e.g. 0.1 means a 10% magnification per scroll
}
const defaultOptions = {
  scale: 0.2,
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
    if (!this.wavesurfer?.options.minPxPerSec || !this.container) {
      return
    }
    const duration = this.wavesurfer.getDuration()
    const oldMinPxPerSec = this.wavesurfer.options.minPxPerSec
    const x = e.clientX
    const width = this.container.clientWidth
    const scrollX = this.wavesurfer.getScroll()
    const pointerTime = (scrollX + x) / oldMinPxPerSec
    const newMinPxPerSec = oldMinPxPerSec * (e.deltaY > 0 ? 1 - this.options.scale : 1 + this.options.scale)
    const newLeftSec = (width / newMinPxPerSec) * (x / width)
    if (newMinPxPerSec * duration < width) {
      this.wavesurfer.zoom(width / duration)
      this.container.scrollLeft = 0
    } else {
      this.wavesurfer.zoom(newMinPxPerSec)
      this.container.scrollLeft = (pointerTime - newLeftSec) * newMinPxPerSec
    }
  }

  destroy() {
    if (this.wrapper) {
      this.wrapper.removeEventListener('wheel', this.onWheel)
    }
    super.destroy()
  }
}

export default ZoomPlugin
