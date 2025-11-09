/**
 * The Timeline plugin adds timestamps and notches under the waveform.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import createElement from '../dom.js'

export type TimelinePluginOptions = {
  /** The height of the timeline in pixels, defaults to 20 */
  height?: number
  /** HTML element or selector for a timeline container, defaults to wavesufer's container */
  container?: HTMLElement | string
  /** Pass 'beforebegin' to insert the timeline on top of the waveform */
  insertPosition?: InsertPosition
  /** The duration of the timeline in seconds, defaults to wavesurfer's duration */
  duration?: number
  /** Interval between ticks in seconds */
  timeInterval?: number
  /** Interval between numeric labels in seconds */
  primaryLabelInterval?: number
  /** Interval between secondary numeric labels in seconds */
  secondaryLabelInterval?: number
  /** Interval between numeric labels in timeIntervals (i.e notch count) */
  primaryLabelSpacing?: number
  /** Interval between secondary numeric labels  in timeIntervals (i.e notch count) */
  secondaryLabelSpacing?: number
  /** offset in seconds for the numeric labels */
  timeOffset?: number
  /** Custom inline style to apply to the container */
  style?: Partial<CSSStyleDeclaration> | string
  /** Turn the time into a suitable label for the time. */
  formatTimeCallback?: (seconds: number) => string
  /** Opacity of the secondary labels, defaults to 0.25 */
  secondaryLabelOpacity?: number
}

// ============================================================================
// Pure Timeline Calculation Functions
// ============================================================================
// These functions calculate timeline intervals and formatting without side effects.

/**
 * Calculate optimal time interval between notches based on pixel density
 * Pure function - no side effects
 *
 * @param pxPerSec - Pixels per second of audio
 * @returns Time interval in seconds between notches
 */
export function calculateTimeInterval(pxPerSec: number): number {
  if (pxPerSec >= 25) {
    return 1
  } else if (pxPerSec * 5 >= 25) {
    return 5
  } else if (pxPerSec * 15 >= 25) {
    return 15
  }
  return Math.ceil(0.5 / pxPerSec) * 60
}

/**
 * Calculate interval for primary (most prominent) labels
 * Pure function - no side effects
 *
 * @param pxPerSec - Pixels per second of audio
 * @returns Time interval in seconds for primary labels
 */
export function calculatePrimaryLabelInterval(pxPerSec: number): number {
  if (pxPerSec >= 25) {
    return 10
  } else if (pxPerSec * 5 >= 25) {
    return 6
  } else if (pxPerSec * 15 >= 25) {
    return 4
  }
  return 4
}

/**
 * Calculate interval for secondary labels
 * Pure function - no side effects
 *
 * @param pxPerSec - Pixels per second of audio
 * @returns Time interval in seconds for secondary labels
 */
export function calculateSecondaryLabelInterval(pxPerSec: number): number {
  if (pxPerSec >= 25) {
    return 5
  } else if (pxPerSec * 5 >= 25) {
    return 2
  } else if (pxPerSec * 15 >= 25) {
    return 2
  }
  return 2
}

/**
 * Format seconds into a human-readable time label
 * Pure function - no side effects
 *
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "1:30" or "5.234")
 */
export function formatTimeLabel(seconds: number): string {
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

/**
 * Check if a notch is visible within scroll bounds
 * Pure function - no side effects
 *
 * @param notchStart - Start position of notch in pixels
 * @param notchWidth - Width of notch in pixels
 * @param scrollLeft - Left edge of visible area
 * @param scrollRight - Right edge of visible area
 * @returns True if notch is visible
 */
export function isNotchVisible(
  notchStart: number,
  notchWidth: number,
  scrollLeft: number,
  scrollRight: number,
): boolean {
  return notchStart >= scrollLeft && notchStart + notchWidth < scrollRight
}

const defaultOptions = {
  height: 20,
  timeOffset: 0,
  formatTimeCallback: formatTimeLabel,
}

export type TimelinePluginEvents = BasePluginEvents & {
  ready: []
}

class TimelinePlugin extends BasePlugin<TimelinePluginEvents, TimelinePluginOptions> {
  private timelineWrapper: HTMLElement
  private unsubscribeNotches: (() => void)[] = []
  protected options: TimelinePluginOptions & typeof defaultOptions
  private notchElements: Map<HTMLElement, { start: number; width: number; wasVisible: boolean }> = new Map()

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

    let container = this.wavesurfer.getWrapper()
    if (this.options.container instanceof HTMLElement) {
      container = this.options.container
    } else if (typeof this.options.container === 'string') {
      const el = document.querySelector(this.options.container)
      if (!el) throw Error(`No Timeline container found matching ${this.options.container}`)
      container = el as HTMLElement
    }

    if (this.options.insertPosition) {
      ;(container.firstElementChild || container).insertAdjacentElement(
        this.options.insertPosition,
        this.timelineWrapper,
      )
    } else {
      container.appendChild(this.timelineWrapper)
    }

    this.subscriptions.push(this.wavesurfer.on('redraw', () => this.initTimeline()))

    if (this.wavesurfer?.getDuration() || this.options.duration) {
      this.initTimeline()
    }
  }

  /** Unmount */
  public destroy() {
    this.unsubscribeNotches.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeNotches = []
    this.timelineWrapper.remove()
    super.destroy()
  }

  private initTimelineWrapper(): HTMLElement {
    return createElement('div', { part: 'timeline-wrapper', style: { pointerEvents: 'none' } })
  }

  private virtualAppend(start: number, container: HTMLElement, element: HTMLElement) {
    // Store notch metadata for batch updates
    this.notchElements.set(element, {
      start,
      width: element.clientWidth,
      wasVisible: false,
    })

    // Initial render check
    if (!this.wavesurfer) return
    const scrollLeft = this.wavesurfer.getScroll()
    const scrollRight = scrollLeft + this.wavesurfer.getWidth()

    const notchData = this.notchElements.get(element)!
    const isVisible = isNotchVisible(start, notchData.width, scrollLeft, scrollRight)
    notchData.wasVisible = isVisible

    if (isVisible) {
      container.appendChild(element)
    }
  }

  private updateVisibleNotches(scrollLeft: number, scrollRight: number, container: HTMLElement) {
    this.notchElements.forEach((notchData, element) => {
      const isVisible = isNotchVisible(notchData.start, notchData.width, scrollLeft, scrollRight)

      if (isVisible === notchData.wasVisible) return
      notchData.wasVisible = isVisible

      if (isVisible) {
        container.appendChild(element)
      } else {
        element.remove()
      }
    })
  }

  private initTimeline() {
    this.unsubscribeNotches.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeNotches = []
    this.notchElements.clear()

    const duration = this.wavesurfer?.getDuration() ?? this.options.duration ?? 0
    const pxPerSec = (this.wavesurfer?.getWrapper().scrollWidth || this.timelineWrapper.scrollWidth) / duration
    const timeInterval = this.options.timeInterval ?? calculateTimeInterval(pxPerSec)
    const primaryLabelInterval = this.options.primaryLabelInterval ?? calculatePrimaryLabelInterval(pxPerSec)
    const primaryLabelSpacing = this.options.primaryLabelSpacing
    const secondaryLabelInterval = this.options.secondaryLabelInterval ?? calculateSecondaryLabelInterval(pxPerSec)
    const secondaryLabelSpacing = this.options.secondaryLabelSpacing
    const isTop = this.options.insertPosition === 'beforebegin'

    const timeline = createElement('div', {
      style: {
        height: `${this.options.height}px`,
        overflow: 'hidden',
        fontSize: `${this.options.height / 2}px`,
        whiteSpace: 'nowrap',
        ...(isTop
          ? {
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              zIndex: '2',
            }
          : {
              position: 'relative',
            }),
      },
    })

    timeline.setAttribute('part', 'timeline')

    if (typeof this.options.style === 'string') {
      timeline.setAttribute('style', timeline.getAttribute('style') + this.options.style)
    } else if (typeof this.options.style === 'object') {
      Object.assign(timeline.style, this.options.style)
    }

    const notchEl = createElement('div', {
      style: {
        width: '0',
        height: '50%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isTop ? 'flex-start' : 'flex-end',
        top: isTop ? '0' : 'auto',
        bottom: isTop ? 'auto' : '0',
        overflow: 'visible',
        borderLeft: '1px solid currentColor',
        opacity: `${this.options.secondaryLabelOpacity ?? 0.25}`,
        position: 'absolute',
        zIndex: '1',
      },
    })

    for (let i = 0, notches = 0; i < duration; i += timeInterval, notches++) {
      const notch = notchEl.cloneNode() as HTMLElement
      const isPrimary =
        Math.round(i * 100) % Math.round(primaryLabelInterval * 100) === 0 ||
        (primaryLabelSpacing && notches % primaryLabelSpacing === 0)
      const isSecondary =
        Math.round(i * 100) % Math.round(secondaryLabelInterval * 100) === 0 ||
        (secondaryLabelSpacing && notches % secondaryLabelSpacing === 0)

      if (isPrimary || isSecondary) {
        notch.style.height = '100%'
        notch.style.textIndent = '3px'
        notch.textContent = this.options.formatTimeCallback(i)
        if (isPrimary) notch.style.opacity = '1'
      }

      const mode = isPrimary ? 'primary' : isSecondary ? 'secondary' : 'tick'
      notch.setAttribute('part', `timeline-notch timeline-notch-${mode}`)

      const offset = (Math.round((i + this.options.timeOffset) * 100) / 100) * pxPerSec
      notch.style.left = `${offset}px`
      this.virtualAppend(offset, timeline, notch)
    }

    this.timelineWrapper.innerHTML = ''
    this.timelineWrapper.appendChild(timeline)

    // Add single scroll listener for all notches (instead of one per notch)
    if (this.wavesurfer) {
      this.unsubscribeNotches.push(
        this.wavesurfer.on('scroll', (_start, _end, scrollLeft, scrollRight) => {
          this.updateVisibleNotches(scrollLeft, scrollRight, timeline)
        }),
      )
    }

    this.emit('ready')
  }
}

export default TimelinePlugin
