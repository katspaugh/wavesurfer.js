/**
 * The Timeline plugin adds timestamps and notches under the waveform.
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import { resolveContainer } from '../plugin-utils.js'
import createElement from '../dom.js'
import { effect } from '../reactive/store.js'

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

const defaultOptions = {
  height: 20,
  timeOffset: 0,
  formatTimeCallback: (seconds: number) => {
    if (seconds / 60 > 1) {
      // calculate minutes and seconds from seconds count
      const minutes = Math.floor(seconds / 60)
      seconds = Math.round(seconds % 60)
      const paddedSeconds = `${seconds < 10 ? '0' : ''}${seconds}`
      return `${minutes}:${paddedSeconds}`
    }
    const rounded = Math.round(seconds * 1000) / 1000
    return `${rounded}`
  },
}

export type TimelinePluginEvents = BasePluginEvents & {
  ready: []
}

const TimelinePlugin = definePlugin<TimelinePluginOptions, TimelinePluginEvents, object>(
  'TimelinePlugin',
  (ctx, options) => {
    const opts: TimelinePluginOptions & typeof defaultOptions = Object.assign({}, defaultOptions, options)

    const timelineWrapper = createElement('div', { part: 'timeline-wrapper', style: { pointerEvents: 'none' } })

    // Notch metadata for batch visibility updates, and the currently rendered
    // timeline element (rebuilt on every initTimeline() call).
    const notchElements: Map<HTMLElement, { start: number; width: number; wasVisible: boolean }> = new Map()
    let currentTimeline: HTMLElement | undefined = undefined

    // Return how many seconds should be between each notch
    function defaultTimeInterval(pxPerSec: number): number {
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
    function defaultPrimaryLabelInterval(pxPerSec: number): number {
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
    function defaultSecondaryLabelInterval(pxPerSec: number): number {
      if (pxPerSec >= 25) {
        return 5
      } else if (pxPerSec * 5 >= 25) {
        return 2
      } else if (pxPerSec * 15 >= 25) {
        return 2
      }
      return 2
    }

    function virtualAppend(start: number, container: HTMLElement, element: HTMLElement) {
      // Append BEFORE measuring: a detached element's clientWidth is always 0,
      // which would make the culling condition below degenerate (no label was
      // ever culled for overflowing the visible window). The timeline element
      // is already attached to the document at this point (see initTimeline).
      container.appendChild(element)
      const width = element.clientWidth

      // Initial render check
      const scrollLeft = ctx.wavesurfer.getScroll()
      const scrollRight = scrollLeft + ctx.wavesurfer.getWidth()
      const isVisible = start >= scrollLeft && start + width < scrollRight

      // Store notch metadata for batch updates
      notchElements.set(element, {
        start,
        width,
        wasVisible: isVisible,
      })

      if (!isVisible) {
        element.remove()
      }
    }

    function updateVisibleNotches(scrollLeft: number, scrollRight: number, container: HTMLElement) {
      notchElements.forEach((notchData, element) => {
        const isVisible = notchData.start >= scrollLeft && notchData.start + notchData.width < scrollRight

        if (isVisible === notchData.wasVisible) return
        notchData.wasVisible = isVisible

        if (isVisible) {
          container.appendChild(element)
        } else {
          element.remove()
        }
      })
    }

    function initTimeline() {
      notchElements.clear()

      // getDuration() returns a number (0 when nothing is loaded), never
      // nullish -- `??` would make opts.duration dead code, and the timeline
      // could never render before audio loads despite the option existing
      // for exactly that.
      const duration = ctx.wavesurfer.getDuration() || opts.duration || 0
      const pxPerSec = (ctx.wavesurfer.getWrapper().scrollWidth || timelineWrapper.scrollWidth) / duration
      const timeInterval = opts.timeInterval ?? defaultTimeInterval(pxPerSec)
      const primaryLabelInterval = opts.primaryLabelInterval ?? defaultPrimaryLabelInterval(pxPerSec)
      const primaryLabelSpacing = opts.primaryLabelSpacing
      const secondaryLabelInterval = opts.secondaryLabelInterval ?? defaultSecondaryLabelInterval(pxPerSec)
      const secondaryLabelSpacing = opts.secondaryLabelSpacing
      const isTop = opts.insertPosition === 'beforebegin'

      const timeline = createElement('div', {
        style: {
          height: `${opts.height}px`,
          overflow: 'hidden',
          fontSize: `${opts.height / 2}px`,
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

      if (typeof opts.style === 'string') {
        timeline.setAttribute('style', timeline.getAttribute('style') + opts.style)
      } else if (typeof opts.style === 'object') {
        Object.assign(timeline.style, opts.style)
      }

      // Attach the (empty) timeline to the document BEFORE building notches so
      // virtualAppend can measure each notch's real width after insertion.
      timelineWrapper.innerHTML = ''
      timelineWrapper.appendChild(timeline)
      currentTimeline = timeline

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
          opacity: `${opts.secondaryLabelOpacity ?? 0.25}`,
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
          notch.textContent = opts.formatTimeCallback(i)
          if (isPrimary) notch.style.opacity = '1'
        }

        const mode = isPrimary ? 'primary' : isSecondary ? 'secondary' : 'tick'
        notch.setAttribute('part', `timeline-notch timeline-notch-${mode}`)

        const offset = (i + opts.timeOffset) * pxPerSec
        notch.style.left = `${offset}px`
        virtualAppend(offset, timeline, notch)
      }

      ctx.emit('ready')
    }

    const container = resolveContainer(opts.container, ctx.wavesurfer.getWrapper(), 'timeline')

    if (opts.insertPosition) {
      ;(container.firstElementChild || container).insertAdjacentElement(opts.insertPosition, timelineWrapper)
    } else {
      container.appendChild(timelineWrapper)
    }
    ctx.scope.add(() => timelineWrapper.remove())

    // Get reactive state
    const { duration } = ctx.state

    // React to duration changes and redraw events to initialize timeline
    ctx.scope.add(
      effect(() => {
        const dur = duration.value
        if (dur > 0 || opts.duration) {
          initTimeline()
        }
      }, [duration]),
    )

    ctx.scope.add(ctx.wavesurfer.on('redraw', () => initTimeline()))

    // Re-window notches off the renderer's visibleRange (derived from scroll
    // position + duration) rather than hand-rolling scroll math off the raw
    // 'scroll' event. Registered once, not on every redraw.
    const renderer = ctx.wavesurfer.getRenderer()
    ctx.scope.add(
      effect(() => {
        if (currentTimeline) {
          const scrollLeft = ctx.wavesurfer.getScroll()
          // getWidth() is the container width minus its inline padding (see
          // Renderer.getWidth()), matching virtualAppend()'s initial-visibility
          // check below. This is intentional: it keeps the scroll-driven
          // re-window consistent with the initial-render window, both derived
          // from the same padding-adjusted width. The legacy 'scroll' event
          // this replaced reported unpadded bounds (scrollLeft + clientWidth),
          // which was inconsistent with virtualAppend -- with non-zero
          // container padding the visible window now differs slightly (by the
          // padding amount) from that old, inconsistent behavior.
          const scrollRight = scrollLeft + ctx.wavesurfer.getWidth()
          updateVisibleNotches(scrollLeft, scrollRight, currentTimeline)
        }
      }, [renderer.getVisibleRange()]),
    )

    if (ctx.wavesurfer.getDuration() || opts.duration) {
      initTimeline()
    }

    return {}
  },
)

export default TimelinePlugin
