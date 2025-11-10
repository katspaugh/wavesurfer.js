/**
 * The Hover plugin follows the mouse and shows a timestamp
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import createElement from '../dom.js'
import { effect } from '../reactive/store.js'

export type HoverPluginOptions = {
  /** The hover cursor color (playback cursor and progress mask colors used as falllback in this order)
   */
  lineColor?: string
  /**
   * The hover cursor width (pixels used if no units specified)
   * @default 1
   */
  lineWidth?: string | number
  /** The color of the label text */
  labelColor?: string
  /**
   * The font size of the label text (pixels used if no units specified)
   * @default 11
   */
  labelSize?: string | number
  /** The background color of the label */
  labelBackground?: string
  /**
   * Whether to display the label to the left of the cursor if possible
   * @default false
   */
  labelPreferLeft?: boolean
  /** Custom function to customize the displayed label text (m:ss used if not specified) */
  formatTimeCallback?: (seconds: number) => string
}

const defaultOptions = {
  lineWidth: 1,
  labelSize: 11,
  labelPreferLeft: false,
  formatTimeCallback(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const secondsRemainder = Math.floor(seconds) % 60
    const paddedSeconds = `0${secondsRemainder}`.slice(-2)
    return `${minutes}:${paddedSeconds}`
  },
}

export type HoverPluginEvents = BasePluginEvents & {
  hover: [relX: number]
}

class HoverPlugin extends BasePlugin<HoverPluginEvents, HoverPluginOptions> {
  protected options: HoverPluginOptions & typeof defaultOptions
  private wrapper: HTMLElement
  private label: HTMLElement
  private lastPointerPosition: { clientX: number; clientY: number } | null = null
  private unsubscribePointerEvents: () => void = () => undefined
  private unsubscribeReactive: (() => void)[] = []

  constructor(options?: HoverPluginOptions) {
    super(options || {})
    this.options = Object.assign({}, defaultOptions, options)

    // Create the plugin elements
    this.wrapper = createElement('div', { part: 'hover' })
    this.label = createElement('span', { part: 'hover-label' }, this.wrapper)
  }

  public static create(options?: HoverPluginOptions) {
    return new HoverPlugin(options)
  }

  private addUnits(value: string | number): string {
    const units = typeof value === 'number' ? 'px' : ''
    return `${value}${units}`
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    const wsOptions = this.wavesurfer.options
    const lineColor = this.options.lineColor || wsOptions.cursorColor || wsOptions.progressColor

    // Vertical line
    Object.assign(this.wrapper.style, {
      position: 'absolute',
      zIndex: 10,
      left: 0,
      top: 0,
      height: '100%',
      pointerEvents: 'none',
      borderLeft: `${this.addUnits(this.options.lineWidth)} solid ${lineColor}`,
      opacity: '0',
      transition: 'opacity .1s ease-in',
    })

    // Timestamp label
    Object.assign(this.label.style, {
      display: 'block',
      backgroundColor: this.options.labelBackground,
      color: this.options.labelColor,
      fontSize: `${this.addUnits(this.options.labelSize)}`,
      transition: 'transform .1s ease-in',
      padding: '2px 3px',
    })

    // Append the wrapper
    const container = this.wavesurfer.getWrapper()
    container.appendChild(this.wrapper)

    // When zoom or scroll happens, re-run the pointer move logic
    // with the last known mouse position (using reactive streams)
    const renderer = this.wavesurfer.getRenderer?.()
    if (renderer && renderer.scrollStream) {
      // Subscribe to scroll changes reactively
      this.unsubscribeReactive.push(
        effect(() => {
          // Access scroll percentages to trigger on scroll
          const { startX, endX } = renderer.scrollStream!.percentages.value
          if (this.lastPointerPosition && (startX !== undefined || endX !== undefined)) {
            this.onPointerMove(this.lastPointerPosition as PointerEvent)
          }
        }, [renderer.scrollStream.percentages]),
      )
    }

    // Subscribe to resize changes reactively (which includes zoom)
    if (renderer) {
      this.unsubscribeReactive.push(
        effect(() => {
          const resize = renderer.resize$.value
          if (resize > 0 && this.lastPointerPosition) {
            this.onPointerMove(this.lastPointerPosition as PointerEvent)
          }
        }, [renderer.resize$]),
      )
    }

    // Attach pointer events
    container.addEventListener('pointermove', this.onPointerMove)
    container.addEventListener('pointerleave', this.onPointerLeave)

    this.unsubscribePointerEvents = () => {
      container.removeEventListener('pointermove', this.onPointerMove)
      container.removeEventListener('pointerleave', this.onPointerLeave)
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.wavesurfer) return

    // Store only the position data needed for zoom/scroll updates
    this.lastPointerPosition = { clientX: e.clientX, clientY: e.clientY }

    // Position
    const bbox = this.wavesurfer.getWrapper().getBoundingClientRect()
    const { width } = bbox
    const offsetX = e.clientX - bbox.left
    const relX = Math.min(1, Math.max(0, offsetX / width))
    const posX = Math.min(width - this.options.lineWidth - 1, offsetX)
    this.wrapper.style.transform = `translateX(${posX}px)`
    this.wrapper.style.opacity = '1'

    // Timestamp
    const duration = this.wavesurfer.getDuration() || 0
    this.label.textContent = this.options.formatTimeCallback(duration * relX)
    const labelWidth = this.label.offsetWidth
    const transformCondition = this.options.labelPreferLeft ? posX - labelWidth > 0 : posX + labelWidth > width
    this.label.style.transform = transformCondition ? `translateX(-${labelWidth + this.options.lineWidth}px)` : ''

    // Emit a hover event with the relative X position
    this.emit('hover', relX)
  }

  private onPointerLeave = () => {
    this.wrapper.style.opacity = '0'
    this.lastPointerPosition = null
  }

  /** Unmount */
  public destroy() {
    super.destroy()
    this.unsubscribePointerEvents()
    this.unsubscribeReactive.forEach((unsub) => unsub())
    this.wrapper.remove()
  }
}

export default HoverPlugin
