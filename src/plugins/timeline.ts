/**
 * The Timeline plugin adds timestamps and notches under the waveform.
 */

import BasePlugin from '../base-plugin.js'

export type TimelinePluginOptions = {
  /** The height of the timeline in pixels, defaults to 20 */
  height?: number
  /** HTML container for the timeline, defaults to wavesufer's container */
  container?: HTMLElement
  /** Pass 'beforebegin' to insert the timeline on top of the waveform */
  insertPosition?: InsertPosition
  /** The duration of the timeline in seconds, defaults to wavesurfer's duration */
  duration?: number
  /** Interval between ticks in seconds */
  timeInterval?: number
  /** Interval between numeric labels */
  primaryLabelInterval?: number
  /** Interval between secondary numeric labels */
  secondaryLabelInterval?: number
  /** Custom inline style to apply to the container */
  style?: Partial<CSSStyleDeclaration> | string
}

const defaultOptions = {
  height: 20,
}

export type TimelinePluginEvents = {
  ready: []
}

class TimelinePlugin extends BasePlugin<TimelinePluginEvents, TimelinePluginOptions> {
  private timelineWrapper: HTMLElement
  protected options: TimelinePluginOptions & typeof defaultOptions

  constructor(options?: TimelinePluginOptions) {
    super(options || {})

    this.options = Object.assign({}, defaultOptions, options)
    this.timelineWrapper = this.initTimelineWrapper()
  }

  public static create(options?: TimelinePluginOptions) {
    return new TimelinePlugin(options)
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    const container = this.options.container ?? this.wavesurfer.getWrapper()
    if (this.options.insertPosition) {
      ;(container.firstElementChild || container).insertAdjacentElement(
        this.options.insertPosition,
        this.timelineWrapper,
      )
    } else {
      container.appendChild(this.timelineWrapper)
    }

    if (this.options.duration) {
      this.initTimeline(this.options.duration)
    } else {
      this.subscriptions.push(
        this.wavesurfer.on('redraw', () => {
          this.initTimeline(this.wavesurfer?.getDuration() || 0)
        }),
      )
    }
  }

  /** Unmount */
  public destroy() {
    this.timelineWrapper.remove()
    super.destroy()
  }

  private initTimelineWrapper(): HTMLElement {
    const div = document.createElement('div')
    div.setAttribute('part', 'timeline')
    return div
  }

  private formatTime(seconds: number): string {
    if (seconds / 60 > 1) {
      // calculate minutes and seconds from seconds count
      const minutes = Math.floor(seconds / 60)
      seconds = Math.round(seconds % 60)
      const paddedSeconds = `${seconds < 10 ? '0' : ''}${seconds}`
      return `${minutes}:${paddedSeconds}`
    }
    const rounded = Math.round(seconds * 1000) / 1000
    return `${rounded}`
  }

  // Return how many seconds should be between each notch
  private defaultTimeInterval(pxPerSec: number): number {
    if (pxPerSec >= 25) {
      return 1
    } else if (pxPerSec * 5 >= 25) {
      return 5
    } else if (pxPerSec * 15 >= 25) {
      return 15
    }
    return Math.ceil(0.5 / pxPerSec) * 60
  }

  // Return the cadence of notches that get labels in the primary color.
  private defaultPrimaryLabelInterval(pxPerSec: number): number {
    if (pxPerSec >= 25) {
      return 10
    } else if (pxPerSec * 5 >= 25) {
      return 6
    } else if (pxPerSec * 15 >= 25) {
      return 4
    }
    return 4
  }

  // Return the cadence of notches that get labels in the secondary color.
  private defaultSecondaryLabelInterval(pxPerSec: number): number {
    if (pxPerSec >= 25) {
      return 5
    } else if (pxPerSec * 5 >= 25) {
      return 2
    } else if (pxPerSec * 15 >= 25) {
      return 2
    }
    return 2
  }

  private initTimeline(duration: number) {
    const pxPerSec = this.timelineWrapper.scrollWidth / duration
    const timeInterval = this.options.timeInterval ?? this.defaultTimeInterval(pxPerSec)
    const primaryLabelInterval = this.options.primaryLabelInterval ?? this.defaultPrimaryLabelInterval(pxPerSec)
    const secondaryLabelInterval = this.options.secondaryLabelInterval ?? this.defaultSecondaryLabelInterval(pxPerSec)
    const isTop = this.options.insertPosition === 'beforebegin'

    const timeline = document.createElement('div')
    timeline.setAttribute(
      'style',
      `
      height: ${this.options.height}px;
      overflow: hidden;
      display: flex;
      justify-content: space-between;
      align-items: ${isTop ? 'flex-start' : 'flex-end'};
      font-size: ${this.options.height / 2}px;
      white-space: nowrap;
    `,
    )

    if (isTop) {
      const topStyle = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2;
      `
      timeline.setAttribute('style', timeline.getAttribute('style') + topStyle)
    }

    if (typeof this.options.style === 'string') {
      timeline.setAttribute('style', timeline.getAttribute('style') + this.options.style)
    } else if (typeof this.options.style === 'object') {
      Object.assign(timeline.style, this.options.style)
    }

    const notchEl = document.createElement('div')
    notchEl.setAttribute(
      'style',
      `
      width: 1px;
      height: 50%;
      display: flex;
      flex-direction: column;
      justify-content: ${isTop ? 'flex-start' : 'flex-end'};
      overflow: visible;
      border-left: 1px solid currentColor;
      opacity: 0.25;
    `,
    )

    for (let i = 0; i < duration; i += timeInterval) {
      const notch = notchEl.cloneNode() as HTMLElement
      const isPrimary = (Math.round(i * 100) / 100) % primaryLabelInterval === 0
      const isSecondary = (Math.round(i * 100) / 100) % secondaryLabelInterval === 0

      if (isPrimary || isSecondary) {
        notch.style.height = '100%'
        notch.style.textIndent = '3px'
        notch.textContent = this.formatTime(i)
        if (isPrimary) notch.style.opacity = '1'
      }

      timeline.appendChild(notch)
    }

    this.timelineWrapper.innerHTML = ''
    this.timelineWrapper.appendChild(timeline)

    this.emit('ready')
  }
}

export default TimelinePlugin
