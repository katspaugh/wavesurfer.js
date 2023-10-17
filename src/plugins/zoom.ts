/**
 * Zoom plugin
 *
 * zoom player when mouse wheel
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
  scale?: number // every wheel step zoom  0.1 means 10%
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
    if (this.wavesurfer?.options.container) {
      const containerParam = this.wavesurfer?.options.container
      if (typeof containerParam === 'string') {
        this.container = document.querySelector(containerParam) as HTMLElement
      } else if (containerParam instanceof HTMLElement) {
        this.container = containerParam
      } else {
        this.container = this.wavesurfer?.getWrapper().parentElement as HTMLElement
      }
    }
    this.wrapper.addEventListener('wheel', this.onWheel)
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.wavesurfer?.options.minPxPerSec || !this.container) {
      return
    }
    const scrollEl = this.wrapper?.parentElement as HTMLElement
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
      scrollEl.scrollLeft = 0
    } else {
      this.wavesurfer.zoom(newMinPxPerSec)
      scrollEl.scrollLeft = (pointerTime - newLeftSec) * newMinPxPerSec
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
