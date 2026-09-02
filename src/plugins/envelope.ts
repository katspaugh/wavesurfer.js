/**
 * Envelope is a visual UI for controlling the audio volume and add fade-in and fade-out effects.
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import createElement from '../dom.js'
import { createDragStream } from '../reactive/drag-stream.js'
import { effect } from '../reactive/store.js'
import { Scope } from '../scope.js'

export type EnvelopePoint = {
  id?: string
  time: number // in seconds
  volume: number // 0 to 1
}

export type EnvelopePluginOptions = {
  points?: EnvelopePoint[]
  volume?: number
  lineWidth?: string
  lineColor?: string
  dragLine?: boolean
  dragPointSize?: number
  dragPointFill?: string
  dragPointStroke?: string
}

const defaultOptions = {
  points: [] as EnvelopePoint[],
  lineWidth: 4,
  lineColor: 'rgba(0, 0, 255, 0.5)',
  dragPointSize: 10,
  dragPointFill: 'rgba(255, 255, 255, 0.8)',
  dragPointStroke: 'rgba(255, 255, 255, 0.8)',
}

type Options = EnvelopePluginOptions & typeof defaultOptions

export type EnvelopePluginEvents = BasePluginEvents & {
  'points-change': [newPoints: EnvelopePoint[]]
  'volume-change': [volume: number]
}

// Polyline's outward channel: plain constructor-injected callbacks, not an
// event bus -- it is a private class with exactly one consumer (the setup
// function below). See the eslint 'extends EventEmitter' ban (R3).
type PolylineCallbacks = {
  onPointMove: (point: EnvelopePoint, relativeX: number, relativeY: number) => void
  onPointDragout: (point: EnvelopePoint) => void
  onPointCreate: (relativeX: number, relativeY: number) => void
  onLineMove: (relativeY: number) => void
}

class Polyline {
  private svg: SVGSVGElement
  private options: Options
  private polyPoints: Map<
    EnvelopePoint,
    {
      polyPoint: SVGPoint
      circle: SVGEllipseElement
    }
  >
  private pointCleanups = new Map<EnvelopePoint, () => void>()
  // Owns every constructor-registered teardown: the dblclick/touch listeners
  // and long-press timer below, plus (when dragLine is on) the polyline
  // drag-stream + its effect. Unified onto one Scope rather than
  // splitting cleanup between this and a hand-rolled subscriptions array --
  // destroy() disposes this once instead of draining two separate mechanisms.
  private scope = new Scope()
  private cancelPressTimer?: () => void

  constructor(
    options: Options,
    wrapper: HTMLElement,
    private callbacks: PolylineCallbacks,
  ) {
    this.options = options
    this.polyPoints = new Map()

    const width = wrapper.clientWidth
    const height = wrapper.clientHeight

    // SVG element
    const svg = createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '100%',
        height: '100%',
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'none',
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          zIndex: '4',
        },
        part: 'envelope',
      },
      wrapper,
    ) as SVGSVGElement

    this.svg = svg

    // A polyline representing the envelope
    const polyline = createElement(
      'polyline',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        points: `0,${height} ${width},${height}`,
        stroke: options.lineColor,
        'stroke-width': options.lineWidth,
        fill: 'none',
        part: 'polyline',
        style: options.dragLine
          ? {
              cursor: 'row-resize',
              pointerEvents: 'stroke',
            }
          : {},
      },
      svg,
    ) as SVGPolylineElement

    // Make the polyline draggable along the Y axis
    if (options.dragLine) {
      const dragStream = createDragStream(polyline)
      const unsubscribe = effect(() => {
        const drag = dragStream.signal.value
        if (!drag || drag.type !== 'move' || drag.deltaY === undefined) return

        const deltaY = drag.deltaY
        const { height } = svg.viewBox.baseVal
        const { points } = polyline
        for (let i = 1; i < points.numberOfItems - 1; i++) {
          const point = points.getItem(i)
          point.y = Math.min(height, Math.max(0, point.y + deltaY))
        }
        const circles = svg.querySelectorAll('ellipse')
        Array.from(circles).forEach((circle) => {
          const newY = Math.min(height, Math.max(0, Number(circle.getAttribute('cy')) + deltaY))
          circle.setAttribute('cy', newY.toString())
        })

        this.callbacks.onLineMove(deltaY / height)
      }, [dragStream.signal])

      this.scope.add(() => {
        unsubscribe()
        dragStream.cleanup()
      })
    }

    // Listen to double click to add a new point
    const dblClickListener = (e: MouseEvent) => {
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.callbacks.onPointCreate(x / rect.width, y / rect.height)
    }
    this.scope.listen(svg, 'dblclick', dblClickListener as EventListener)

    // Long press on touch devices
    const clearTimer = () => {
      this.cancelPressTimer?.()
      this.cancelPressTimer = undefined
    }

    const touchStartListener = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this.cancelPressTimer = this.scope.timeout(() => {
          this.cancelPressTimer = undefined
          e.preventDefault()
          const rect = svg.getBoundingClientRect()
          const x = e.touches[0].clientX - rect.left
          const y = e.touches[0].clientY - rect.top
          this.callbacks.onPointCreate(x / rect.width, y / rect.height)
        }, 500)
      } else {
        clearTimer()
      }
    }

    this.scope.listen(svg, 'touchstart', touchStartListener as EventListener)
    this.scope.listen(svg, 'touchmove', clearTimer)
    this.scope.listen(svg, 'touchend', clearTimer)
  }

  private makeDraggable(draggable: SVGElement, onDrag: (x: number, y: number) => void): () => void {
    const dragStream = createDragStream(draggable, { threshold: 1 })

    const unsubscribe = effect(() => {
      const drag = dragStream.signal.value
      if (!drag) return

      if (drag.type === 'start') {
        draggable.style.cursor = 'grabbing'
      } else if (drag.type === 'move' && drag.deltaX !== undefined && drag.deltaY !== undefined) {
        onDrag(drag.deltaX, drag.deltaY)
      } else if (drag.type === 'end') {
        draggable.style.cursor = 'grab'
      }
    }, [dragStream.signal])

    return () => {
      unsubscribe()
      dragStream.cleanup()
    }
  }

  private createCircle(x: number, y: number) {
    const size = this.options.dragPointSize
    const radius = size / 2
    return createElement(
      'ellipse',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        cx: x,
        cy: y,
        rx: radius,
        ry: radius,
        fill: this.options.dragPointFill,
        stroke: this.options.dragPointStroke,
        'stroke-width': '2',
        style: {
          cursor: 'grab',
          pointerEvents: 'all',
        },
        part: 'envelope-circle',
      },
      this.svg,
    ) as SVGEllipseElement
  }

  removePolyPoint(point: EnvelopePoint) {
    const item = this.polyPoints.get(point)
    if (!item) return
    const { polyPoint, circle } = item
    const { points } = this.svg.querySelector('polyline') as SVGPolylineElement
    const index = Array.from(points).findIndex((p) => p.x === polyPoint.x && p.y === polyPoint.y)
    points.removeItem(index)
    circle.remove()
    this.polyPoints.delete(point)

    const cleanup = this.pointCleanups.get(point)
    if (cleanup) {
      cleanup()
      this.pointCleanups.delete(point)
    }
  }

  addPolyPoint(relX: number, relY: number, refPoint: EnvelopePoint) {
    const { svg } = this
    const { width, height } = svg.viewBox.baseVal
    const x = relX * width
    const y = height - relY * height
    const threshold = this.options.dragPointSize / 2

    const newPoint = svg.createSVGPoint()
    newPoint.x = relX * width
    newPoint.y = height - relY * height

    const circle = this.createCircle(x, y)
    const { points } = svg.querySelector('polyline') as SVGPolylineElement
    const newIndex = Array.from(points).findIndex((point) => point.x >= x)
    points.insertItemBefore(newPoint, Math.max(newIndex, 1))

    this.polyPoints.set(refPoint, { polyPoint: newPoint, circle })

    const cleanup = this.makeDraggable(circle, (dx, dy) => {
      const newX = newPoint.x + dx
      const newY = newPoint.y + dy

      // Remove the point if it's dragged out of the SVG
      if (newX < -threshold || newY < -threshold || newX > width + threshold || newY > height + threshold) {
        this.callbacks.onPointDragout(refPoint)
        return
      }

      // Don't allow to drag past the next or previous point
      const next = Array.from(points).find((point) => point.x > newPoint.x)
      const prev = Array.from(points).findLast((point) => point.x < newPoint.x)
      if ((next && newX >= next.x) || (prev && newX <= prev.x)) {
        return
      }

      // Update the point and the circle position
      newPoint.x = newX
      newPoint.y = newY
      circle.setAttribute('cx', newX.toString())
      circle.setAttribute('cy', newY.toString())

      // Emit the event passing the point and new relative coordinates
      this.callbacks.onPointMove(refPoint, newX / width, newY / height)
    })

    this.pointCleanups.set(refPoint, cleanup)
  }

  update() {
    const { svg } = this
    // Skip the update if the container is hidden
    const { clientWidth, clientHeight } = svg
    if (!clientWidth || !clientHeight) {
      return
    }

    const aspectRatioX = svg.viewBox.baseVal.width / clientWidth
    const aspectRatioY = svg.viewBox.baseVal.height / clientHeight
    const circles = svg.querySelectorAll('ellipse')

    circles.forEach((circle) => {
      const radius = this.options.dragPointSize / 2
      const rx = radius * aspectRatioX
      const ry = radius * aspectRatioY
      circle.setAttribute('rx', rx.toString())
      circle.setAttribute('ry', ry.toString())
    })
  }

  destroy() {
    // Cancels the pending press timer (if any), removes the dblclick/touch
    // listeners registered in the constructor above, and (when dragLine was
    // on) unsubscribes the polyline's own drag-stream effect.
    this.scope.dispose()

    this.pointCleanups.forEach((cleanup) => cleanup())
    this.pointCleanups.clear()

    this.polyPoints.clear()
    this.svg.remove()
  }
}

const randomId = () => Math.random().toString(36).slice(2)

// The public surface returned by setup() below: addPoint/removePoint/
// getPoints/setPoints/setVolume/getCurrentVolume are Envelope's only public
// API methods (destroy is chassis-owned by definePlugin, not part of Api).
type Api = {
  addPoint: (point: EnvelopePoint) => void
  removePoint: (point: EnvelopePoint) => void
  getPoints: () => EnvelopePoint[]
  setPoints: (newPoints: EnvelopePoint[]) => void
  setVolume: (floatValue: number) => void
  getCurrentVolume: () => number
}

const EnvelopePlugin = definePlugin<EnvelopePluginOptions, EnvelopePluginEvents, Api>(
  'EnvelopePlugin',
  (ctx, options) => {
    const opts: Options = Object.assign({}, defaultOptions, options)
    opts.lineColor = opts.lineColor || defaultOptions.lineColor
    opts.dragPointFill = opts.dragPointFill || defaultOptions.dragPointFill
    opts.dragPointStroke = opts.dragPointStroke || defaultOptions.dragPointStroke
    opts.dragPointSize = opts.dragPointSize || defaultOptions.dragPointSize

    const points: EnvelopePoint[] = options?.points || []
    let polyline: Polyline | null = null
    // A child scope dedicated to the current polyline's event subscriptions.
    // Disposed and replaced (not accumulated) every time initPolyline() runs
    // (e.g. on every 'decode'), so listeners never pile up across repeated
    // re-inits.
    let polylineScope = ctx.scope.child()
    let volume = 1
    let clearEmitPointsTimeout: (() => void) | null = null

    function emitPoints() {
      // Replace the pending throttle timeout instead of accumulating one per
      // call (mirrors the old `throttleTimeout` clearTimeout-then-set).
      clearEmitPointsTimeout?.()
      clearEmitPointsTimeout = ctx.scope.timeout(() => {
        ctx.emit('points-change', points)
      }, 200)
    }

    function addPolyPoint(point: EnvelopePoint, duration: number) {
      polyline?.addPolyPoint(point.time / duration, point.volume, point)
    }

    function onTimeUpdate(time: number) {
      // Guards a post-destroy call: ctx.wavesurfer is typed non-null but reads
      // `undefined` at runtime once destroy() has run (see define-plugin.ts).
      const duration = ctx.wavesurfer?.getDuration()
      if (duration === undefined) return

      let nextPoint = points.find((point) => point.time > time)
      if (!nextPoint) {
        nextPoint = { time: duration || 0, volume: 0 }
      }
      let prevPoint = points.findLast((point) => point.time <= time)
      if (!prevPoint) {
        prevPoint = { time: 0, volume: 0 }
      }
      const timeDiff = nextPoint.time - prevPoint.time
      const volumeDiff = nextPoint.volume - prevPoint.volume
      // The synthesized end point above collapses onto the last real point when that point sits
      // at the very end of the track, making timeDiff 0. Interpolating then yields NaN, which the
      // clamp below cannot undo, so hold the last point's volume instead of dividing.
      const newVolume =
        timeDiff > 0 ? prevPoint.volume + (time - prevPoint.time) * (volumeDiff / timeDiff) : prevPoint.volume
      const clampedVolume = Math.min(1, Math.max(0, newVolume))
      const roundedVolume = Math.round(clampedVolume * 100) / 100

      if (roundedVolume !== volume) {
        setVolume(roundedVolume)
        ctx.emit('volume-change', roundedVolume)
      }
    }

    function initPolyline() {
      // Drop the previous polyline's listeners before replacing it, instead
      // of accumulating a fresh set of 4 on every decode.
      polylineScope.dispose()
      polyline?.destroy()
      polyline = null
      polylineScope = ctx.scope.child()

      if (!ctx.wavesurfer) return

      const wrapper = ctx.wavesurfer.getWrapper()
      polyline = new Polyline(opts, wrapper, {
        onPointMove: (point, relativeX, relativeY) => {
          const duration = ctx.wavesurfer?.getDuration() || 0
          point.time = relativeX * duration
          point.volume = 1 - relativeY

          emitPoints()
        },

        onPointDragout: (point) => {
          removePoint(point)
        },

        onPointCreate: (relativeX, relativeY) => {
          addPoint({
            time: relativeX * (ctx.wavesurfer?.getDuration() || 0),
            volume: 1 - relativeY,
          })
        },

        onLineMove: (relativeY) => {
          points.forEach((point) => {
            point.volume = Math.min(1, Math.max(0, point.volume - relativeY))
          })

          emitPoints()

          onTimeUpdate(ctx.wavesurfer?.getCurrentTime() || 0)
        },
      })
    }

    function addPoint(point: EnvelopePoint) {
      if (!point.id) point.id = randomId()

      // Insert the point in the correct position to keep the array sorted
      const index = points.findLastIndex((p) => p.time < point.time)
      points.splice(index + 1, 0, point)

      emitPoints()

      // Add the point to the polyline if the duration is available
      const duration = ctx.wavesurfer?.getDuration()
      if (duration) {
        addPolyPoint(point, duration)
      }
    }

    function removePoint(point: EnvelopePoint) {
      const index = points.indexOf(point)
      if (index > -1) {
        points.splice(index, 1)
        polyline?.removePolyPoint(point)
        emitPoints()
      }
    }

    function getPoints(): EnvelopePoint[] {
      return points
    }

    function setPoints(newPoints: EnvelopePoint[]) {
      points.slice().forEach((point) => removePoint(point))
      newPoints.forEach((point) => addPoint(point))
    }

    function getCurrentVolume(): number {
      return volume
    }

    function setVolume(floatValue: number) {
      volume = floatValue
      ctx.wavesurfer?.setVolume(floatValue)
    }

    // Default the volume option from the live wavesurfer and apply it, then
    // subscribe to decode/redraw/timeupdate.
    opts.volume = opts.volume ?? ctx.wavesurfer.getVolume()
    setVolume(opts.volume)

    ctx.scope.add(
      ctx.wavesurfer.on('decode', (duration) => {
        initPolyline()

        points.forEach((point) => {
          addPolyPoint(point, duration)
        })
      }),
    )

    ctx.scope.add(
      ctx.wavesurfer.on('redraw', () => {
        polyline?.update()
      }),
    )

    ctx.scope.add(
      ctx.wavesurfer.on('timeupdate', (time) => {
        onTimeUpdate(time)
      }),
    )

    // No destroy() override exists anymore — teardown IS scope disposal.
    // polylineScope (a child of ctx.scope) is disposed automatically as part
    // of that tree, but `polyline` itself must be explicitly destroyed and
    // nulled out here so a post-destroy Api call (addPoint/removePoint/...)
    // can't reach a torn-down Polyline instance.
    ctx.scope.add(() => {
      polyline?.destroy()
      polyline = null
    })

    return {
      addPoint,
      removePoint,
      getPoints,
      setPoints,
      setVolume,
      getCurrentVolume,
    }
  },
)

export default EnvelopePlugin
