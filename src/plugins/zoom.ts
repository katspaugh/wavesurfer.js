/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel
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

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import { effect } from '../reactive/store.js'
import { cleanup, fromEvent } from '../reactive/event-streams.js'

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

function getTouchDistance(e: TouchEvent): number {
  const touch1 = e.touches[0]
  const touch2 = e.touches[1]
  return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2))
}

function getTouchCenterX(e: TouchEvent): number {
  const touch1 = e.touches[0]
  const touch2 = e.touches[1]
  return (touch1.clientX + touch2.clientX) / 2
}

const ZoomPlugin = definePlugin<ZoomPluginOptions, ZoomPluginEvents, object>('zoom', (ctx, options) => {
  const opts: ZoomPluginOptions & typeof defaultOptions = Object.assign({}, defaultOptions, options)

  const container = ctx.wavesurfer.getWrapper().parentElement as HTMLElement

  // When the caller doesn't pass `maxZoom`, derive it from the container's
  // CURRENT width. `opts` is a fresh object built fresh on every (re-)init
  // (setup() reruns from scratch), so this recomputes from the live
  // container on each init rather than being cached across a
  // destroy -> re-init cycle — unlike the pre-port class, which stored the
  // default on the long-lived `this.options` and only computed it once, on
  // the first init. Deliberate behavior change: a container resized
  // between init cycles gets an accurate cap instead of a stale one.
  if (typeof opts.maxZoom === 'undefined') {
    opts.maxZoom = container.clientWidth
  }
  const endZoom = opts.maxZoom

  // State for wheel zoom
  let accumulatedDelta = 0
  let pointerTime = 0
  let oldX = 0
  let startZoom = 0

  // State for proportional pinch-to-zoom
  let isPinching = false
  let initialPinchDistance = 0
  let initialZoom = 0

  const calculateNewZoom = (oldZoom: number, delta: number) => {
    let newZoom
    if (opts.exponentialZooming) {
      const zoomFactor =
        delta > 0
          ? Math.pow(endZoom / startZoom, 1 / (opts.iterations - 1))
          : Math.pow(startZoom / endZoom, 1 / (opts.iterations - 1))
      newZoom = Math.max(0, oldZoom * zoomFactor)
    } else {
      // Default linear zooming
      newZoom = Math.max(0, oldZoom + delta * opts.scale)
    }
    return Math.min(newZoom, opts.maxZoom!)
  }

  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
      return
    }
    // prevent scrolling the sidebar while zooming
    e.preventDefault()

    // Update the accumulated delta...
    accumulatedDelta += -e.deltaY

    if (startZoom === 0 && opts.exponentialZooming) {
      startZoom = ctx.wavesurfer.getWrapper().clientWidth / ctx.wavesurfer.getDuration()
    }

    // ...and only scroll once we've hit our threshold
    if (opts.deltaThreshold === 0 || Math.abs(accumulatedDelta) >= opts.deltaThreshold) {
      const duration = ctx.wavesurfer.getDuration()
      const oldMinPxPerSec =
        ctx.wavesurfer.options.minPxPerSec === 0
          ? ctx.wavesurfer.getWrapper().scrollWidth / duration
          : ctx.wavesurfer.options.minPxPerSec
      const x = e.clientX - container.getBoundingClientRect().left
      const width = container.clientWidth
      const scrollX = ctx.wavesurfer.getScroll()

      // Update pointerTime only if the pointer position has changed. This prevents the waveform from drifting during fixed zooming.
      if (x !== oldX || oldX === 0) {
        pointerTime = (scrollX + x) / oldMinPxPerSec
      }
      oldX = x

      const newMinPxPerSec = calculateNewZoom(oldMinPxPerSec, accumulatedDelta)
      const newLeftSec = (width / newMinPxPerSec) * (x / width)

      if (newMinPxPerSec * duration < width) {
        ctx.wavesurfer.zoom(width / duration)
        container.scrollLeft = 0
      } else {
        ctx.wavesurfer.zoom(newMinPxPerSec)
        container.scrollLeft = (pointerTime - newLeftSec) * newMinPxPerSec
      }

      // Reset the accumulated delta
      accumulatedDelta = 0
    }
  }

  const onTouchStart = (e: TouchEvent) => {
    // Check if two fingers are used
    if (e.touches.length === 2) {
      e.preventDefault()
      isPinching = true

      // Store initial pinch distance
      initialPinchDistance = getTouchDistance(e)

      // Store initial zoom level
      const duration = ctx.wavesurfer.getDuration()
      initialZoom =
        ctx.wavesurfer.options.minPxPerSec === 0
          ? ctx.wavesurfer.getWrapper().scrollWidth / duration
          : ctx.wavesurfer.options.minPxPerSec

      // Store anchor point for zooming
      const x = getTouchCenterX(e) - container.getBoundingClientRect().left
      const scrollX = ctx.wavesurfer.getScroll()
      pointerTime = (scrollX + x) / initialZoom
      oldX = x // Use oldX to store the anchor X position
    }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!isPinching || e.touches.length !== 2) {
      return
    }
    e.preventDefault()

    // Calculate new zoom level
    const newDistance = getTouchDistance(e)
    const scaleFactor = newDistance / initialPinchDistance
    let newMinPxPerSec = initialZoom * scaleFactor

    // Constrain the zoom
    newMinPxPerSec = Math.min(newMinPxPerSec, opts.maxZoom!)

    // Calculate minimum zoom (fit to width)
    const duration = ctx.wavesurfer.getDuration()
    const width = container.clientWidth
    const minZoom = width / duration
    if (newMinPxPerSec < minZoom) {
      newMinPxPerSec = minZoom
    }

    // Apply zoom and scroll
    const newLeftSec = (width / newMinPxPerSec) * (oldX / width)
    if (newMinPxPerSec === minZoom) {
      ctx.wavesurfer.zoom(minZoom)
      container.scrollLeft = 0
    } else {
      ctx.wavesurfer.zoom(newMinPxPerSec)
      container.scrollLeft = (pointerTime - newLeftSec) * newMinPxPerSec
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (isPinching && e.touches.length < 2) {
      isPinching = false
      initialPinchDistance = 0
      initialZoom = 0
    }
  }

  // Get reactive state
  const { zoom, duration } = ctx.state

  // React to zoom state changes to update internal state
  ctx.scope.add(
    effect(() => {
      const z = zoom.value
      if (z > 0 && startZoom === 0 && opts.exponentialZooming) {
        const dur = duration.value
        if (dur > 0) {
          startZoom = container.clientWidth / dur
        }
      }
    }, [zoom, duration]),
  )

  // Create event streams
  const wheelStream = fromEvent(container, 'wheel')
  const touchStartStream = fromEvent(container, 'touchstart')
  const touchMoveStream = fromEvent(container, 'touchmove')
  const touchEndStream = fromEvent(container, 'touchend')
  const touchCancelStream = fromEvent(container, 'touchcancel')
  ctx.scope.add(() => cleanup(wheelStream))
  ctx.scope.add(() => cleanup(touchStartStream))
  ctx.scope.add(() => cleanup(touchMoveStream))
  ctx.scope.add(() => cleanup(touchEndStream))
  ctx.scope.add(() => cleanup(touchCancelStream))

  // React to wheel events
  ctx.scope.add(
    effect(() => {
      const e = wheelStream.value
      if (e) onWheel(e)
    }, [wheelStream]),
  )

  // React to touch events
  ctx.scope.add(
    effect(() => {
      const e = touchStartStream.value
      if (e) onTouchStart(e)
    }, [touchStartStream]),
  )

  ctx.scope.add(
    effect(() => {
      const e = touchMoveStream.value
      if (e) onTouchMove(e)
    }, [touchMoveStream]),
  )

  ctx.scope.add(
    effect(() => {
      const e = touchEndStream.value
      if (e) onTouchEnd(e)
    }, [touchEndStream]),
  )

  ctx.scope.add(
    effect(() => {
      const e = touchCancelStream.value
      if (e) onTouchEnd(e)
    }, [touchCancelStream]),
  )

  return {}
})

export default ZoomPlugin
