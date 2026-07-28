/**
 * The Hover plugin follows the mouse and shows a timestamp
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import createElement from '../dom.js'
import { cleanup, fromEvent } from '../reactive/event-streams.js'
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

function addUnits(value: string | number): string {
  const units = typeof value === 'number' ? 'px' : ''
  return `${value}${units}`
}

const HoverPlugin = definePlugin<HoverPluginOptions, HoverPluginEvents, object>('HoverPlugin', (ctx, options) => {
  const opts: HoverPluginOptions & typeof defaultOptions = Object.assign({}, defaultOptions, options)

  // Create the plugin elements
  const wrapper = createElement('div', { part: 'hover' })
  const label = createElement('span', { part: 'hover-label' }, wrapper)

  const wsOptions = ctx.wavesurfer.options
  const lineColor = opts.lineColor || wsOptions.cursorColor || wsOptions.progressColor

  // Vertical line
  Object.assign(wrapper.style, {
    position: 'absolute',
    zIndex: 10,
    left: 0,
    top: 0,
    height: '100%',
    pointerEvents: 'none',
    borderLeft: `${addUnits(opts.lineWidth)} solid ${lineColor}`,
    opacity: '0',
    transition: 'opacity .1s ease-in',
  })

  // Timestamp label
  Object.assign(label.style, {
    display: 'block',
    backgroundColor: opts.labelBackground,
    color: opts.labelColor,
    fontSize: `${addUnits(opts.labelSize)}`,
    transition: 'transform .1s ease-in',
    padding: '2px 3px',
  })

  // Append the wrapper
  const container = ctx.wavesurfer.getWrapper()
  container.appendChild(wrapper)
  ctx.scope.add(() => wrapper.remove())

  // Get reactive state
  const { duration } = ctx.state

  let lastPointerPosition: { clientX: number; clientY: number } | null = null
  let isPointerOverWaveform = false
  let transitionEndCleanup: (() => void) | null = null

  // Create event streams for pointer events
  const pointerMove = fromEvent(container, 'pointermove')
  const pointerLeave = fromEvent(container, 'pointerleave')
  ctx.scope.add(() => cleanup(pointerMove))
  ctx.scope.add(() => cleanup(pointerLeave))

  ctx.scope.add(
    effect(() => {
      const e = pointerMove.value
      if (!e) return

      isPointerOverWaveform = true
    }, [pointerMove]),
  )

  // React to pointer movement
  ctx.scope.add(
    effect(() => {
      const e = pointerMove.value
      if (!e || !isPointerOverWaveform) return

      // Store only the position data needed for zoom/scroll updates
      lastPointerPosition = { clientX: e.clientX, clientY: e.clientY }

      // Position
      const bbox = ctx.wavesurfer.getWrapper().getBoundingClientRect()
      const { width } = bbox
      const offsetX = e.clientX - bbox.left
      const relX = Math.min(1, Math.max(0, offsetX / width))
      const posX = Math.min(width - opts.lineWidth - 1, offsetX)
      wrapper.style.transform = `translateX(${posX}px)`
      wrapper.style.opacity = '1'

      // Timestamp
      const dur = ctx.wavesurfer.getDuration()
      label.textContent = opts.formatTimeCallback(dur * relX)
      const labelWidth = label.offsetWidth
      const transformCondition = opts.labelPreferLeft ? posX - labelWidth > 0 : posX + labelWidth > width
      label.style.transform = transformCondition ? `translateX(-${labelWidth + opts.lineWidth}px)` : ''

      // Emit a hover event with the relative X position
      ctx.emit('hover', relX)
    }, [pointerMove, duration]),
  )

  // React to pointer leave
  ctx.scope.add(
    effect(() => {
      const e = pointerLeave.value
      if (!e) return

      wrapper.style.opacity = '0'
      isPointerOverWaveform = false
      lastPointerPosition = null

      // Remove any previously attached transitionend listener before attaching a
      // new one, so listeners don't accumulate if the transition never fires
      // (e.g. element hidden or opacity already 0).
      if (transitionEndCleanup) {
        transitionEndCleanup()
        transitionEndCleanup = null
      }

      // Reset transform after the opacity fade so the line doesn't jump to position 0
      // while still visible. Also resets the scrollable overflow area of the scroll
      // container to prevent improper scrollLeft clamping on zoom changes.
      const onTransitionEnd = () => {
        transitionEndCleanup = null
        if (!isPointerOverWaveform) {
          wrapper.style.transform = ''
        }
      }
      wrapper.addEventListener('transitionend', onTransitionEnd, { once: true })
      transitionEndCleanup = () => wrapper.removeEventListener('transitionend', onTransitionEnd)
    }, [pointerLeave]),
  )
  ctx.scope.add(() => {
    if (transitionEndCleanup) {
      transitionEndCleanup()
      transitionEndCleanup = null
    }
  })

  // When zoom or scroll happens, re-run the pointer move logic with the last known mouse position
  const onUpdate = () => {
    if (lastPointerPosition) {
      // Position
      const bbox = ctx.wavesurfer.getWrapper().getBoundingClientRect()
      const { width } = bbox
      const offsetX = lastPointerPosition.clientX - bbox.left
      const relX = Math.min(1, Math.max(0, offsetX / width))
      const posX = Math.min(width - opts.lineWidth - 1, offsetX)
      wrapper.style.transform = `translateX(${posX}px)`

      // Timestamp
      const dur = ctx.wavesurfer.getDuration()
      label.textContent = opts.formatTimeCallback(dur * relX)
      const labelWidth = label.offsetWidth
      const transformCondition = opts.labelPreferLeft ? posX - labelWidth > 0 : posX + labelWidth > width
      label.style.transform = transformCondition ? `translateX(-${labelWidth + opts.lineWidth}px)` : ''
    }
  }

  // Subscribe to zoom and scroll events
  ctx.scope.add(ctx.wavesurfer.on('zoom', onUpdate))
  ctx.scope.add(ctx.wavesurfer.on('scroll', onUpdate))

  return {}
})

export default HoverPlugin
