/**
 * Minimap is a tiny copy of the main waveform serving as a navigation tool.
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import { bridgeEvents } from '../plugin-utils.js'
import WaveSurfer, { type WaveSurferOptions } from '../wavesurfer.js'
import createElement, { isHTMLElement } from '../dom.js'

export type MinimapPluginOptions = {
  overlayColor?: string
  insertPosition?: InsertPosition
} & Partial<WaveSurferOptions>

const defaultOptions = {
  height: 50,
  overlayColor: 'rgba(100, 100, 100, 0.1)',
  insertPosition: 'afterend',
}

export type MinimapPluginEvents = BasePluginEvents & {
  /** An alias of timeupdate but only when the audio is playing */
  audioprocess: [currentTime: number]
  /** When the user clicks on the waveform */
  click: [relativeX: number, relativeY: number]
  /** When the user double-clicks on the waveform */
  dblclick: [relativeX: number, relativeY: number]
  /** When the audio has been decoded */
  decode: [duration: number]
  /** When the user drags the cursor */
  drag: [relativeX: number]
  /** When the user ends dragging the cursor */
  dragend: [relativeX: number]
  /** When the user starts dragging the cursor */
  dragstart: [relativeX: number]
  /** When the user interacts with the waveform (i.g. clicks or drags on it) */
  interaction: []
  /** After the minimap is created */
  init: []
  /** When the audio is both decoded and can play */
  ready: []
  /** When visible waveform is drawn */
  redraw: []
  /** When all audio channel chunks of the waveform have drawn */
  redrawcomplete: []
  /** When the user seeks to a new position */
  seeking: [currentTime: number]
  /** On audio position change, fires continuously during playback */
  timeupdate: [currentTime: number]
}

// Pure 1:1 forwarders from the nested mini wavesurfer to the plugin's own
// event stream — no side effects beyond re-emitting under the same name.
// 'click', 'drag' and 'ready' are handled manually below because they carry
// extra logic (seeking the main waveform, debounced drag-to-seek, syncing
// the minimap position) in addition to forwarding.
const FORWARDED_MINI_EVENTS: Array<keyof MinimapPluginEvents & string> = [
  'audioprocess',
  'dblclick',
  'decode',
  'destroy',
  'dragend',
  'dragstart',
  'interaction',
  'init',
  'redraw',
  'redrawcomplete',
  'seeking',
  'timeupdate',
]

const MinimapPlugin = definePlugin<MinimapPluginOptions, MinimapPluginEvents, object>(
  'MinimapPlugin',
  (ctx, options) => {
    const opts: MinimapPluginOptions & typeof defaultOptions = Object.assign({}, defaultOptions, options)

    const minimapWrapper = createElement('div', {
      part: 'minimap',
      style: {
        position: 'relative',
      },
    })

    const overlay = createElement(
      'div',
      {
        part: 'minimap-overlay',
        style: {
          position: 'absolute',
          zIndex: '2',
          left: '0',
          top: '0',
          bottom: '0',
          transition: 'left 100ms ease-out, width 100ms ease-out',
          pointerEvents: 'none',
          backgroundColor: opts.overlayColor,
        },
      },
      minimapWrapper,
    )

    // Resolve and attach the wrapper. A missing/invalid `container` selector
    // is a SILENT no-op here (matches the pre-port behavior) — unlike
    // resolveContainer(), which throws. Do not switch this to
    // resolveContainer().
    if (opts.container) {
      let container: HTMLElement | null = null
      if (typeof opts.container === 'string') {
        container = document.querySelector(opts.container) as HTMLElement | null
      } else if (isHTMLElement(opts.container)) {
        container = opts.container
      }
      container?.appendChild(minimapWrapper)
    } else {
      const container = ctx.wavesurfer.getWrapper().parentElement
      container?.insertAdjacentElement(opts.insertPosition, minimapWrapper)
    }
    ctx.scope.add(() => minimapWrapper.remove())

    let miniWavesurfer: WaveSurfer | null = null
    let miniScope = ctx.scope.child()
    let isInitializing = false
    // Cancel function for the pending debounced-seek timeout, registered on
    // ctx.scope (not miniScope) so it survives a minimap reinit (e.g. on
    // 'decode') and is only ever cancelled explicitly below.
    let cancelDragTimeout: (() => void) | null = null

    function renderMainProgress(progress: number) {
      ctx.wavesurfer.getRenderer().renderProgress(progress, ctx.wavesurfer.isPlaying())
    }

    function renderMinimapProgress(progress: number) {
      if (!miniWavesurfer) return
      miniWavesurfer.getRenderer().renderProgress(progress, ctx.wavesurfer.isPlaying())
    }

    function syncMinimapPosition(currentTime: number) {
      if (!miniWavesurfer) return

      const duration = ctx.wavesurfer.getDuration()
      if (!duration) return

      if (miniWavesurfer.getDuration()) {
        miniWavesurfer.setTime(currentTime)
      } else {
        renderMinimapProgress(currentTime / duration)
      }
    }

    function onMinimapDrag(relativeX: number) {
      renderMainProgress(relativeX)

      cancelDragTimeout?.()
      cancelDragTimeout = null

      let debounceTime = 0
      const dragToSeek = opts.dragToSeek

      if (!ctx.wavesurfer.isPlaying() && dragToSeek === true) {
        debounceTime = 200
      } else if (!ctx.wavesurfer.isPlaying() && dragToSeek && typeof dragToSeek === 'object') {
        debounceTime = dragToSeek.debounceTime ?? 200
      }

      cancelDragTimeout = ctx.scope.timeout(() => {
        ctx.wavesurfer.seekTo(relativeX)
        cancelDragTimeout = null
      }, debounceTime)
    }

    function updateOverlay(startTime?: number, endTime?: number) {
      const duration = ctx.wavesurfer.getDuration()
      if (!duration) return

      if (startTime === undefined || endTime === undefined) {
        const waveformWidth = ctx.wavesurfer.getWrapper().clientWidth || 1
        const visibleWidth = ctx.wavesurfer.getWidth()
        const scrollLeft = ctx.wavesurfer.getScroll()

        startTime = (scrollLeft / waveformWidth) * duration
        endTime = ((scrollLeft + visibleWidth) / waveformWidth) * duration
      }

      const clampedStartTime = Math.min(Math.max(startTime, 0), duration)
      const clampedEndTime = Math.min(Math.max(endTime, clampedStartTime), duration)
      const overlayLeft = (clampedStartTime / duration) * 100
      const overlayWidth = ((clampedEndTime - clampedStartTime) / duration) * 100

      overlay.style.left = `${overlayLeft}%`
      overlay.style.width = `${Math.min(overlayWidth, 100 - overlayLeft)}%`
    }

    // Dispose the current bridge scope FIRST (unsubscribing the mini
    // wavesurfer's event forwarders, including its 'destroy' forwarder),
    // THEN destroy the nested instance, THEN replace miniScope with a fresh
    // child. This order means the nested instance's own 'destroy' event
    // fires with no forwarder listening, so recreating the minimap (e.g. on
    // 'decode') never re-emits the plugin's own 'destroy' event.
    function destroyMinimap() {
      const mini = miniWavesurfer
      miniWavesurfer = null
      miniScope.dispose()
      mini?.destroy()
      miniScope = ctx.scope.child()

      cancelDragTimeout?.()
      cancelDragTimeout = null
    }

    function initMinimap() {
      // Prevent concurrent initialization
      if (isInitializing) return
      isInitializing = true

      destroyMinimap()

      const data = ctx.wavesurfer.getDecodedData()
      if (!data) {
        isInitializing = false
        return
      }

      const peaks = []
      for (let i = 0; i < data.numberOfChannels; i++) {
        peaks.push(data.getChannelData(i))
      }

      miniWavesurfer = WaveSurfer.create({
        ...opts,
        container: minimapWrapper,
        minPxPerSec: 0,
        fillParent: true,
        url: undefined,
        media: undefined,
        peaks,
        duration: data.duration,
      })

      syncMinimapPosition(ctx.wavesurfer.getCurrentTime())

      bridgeEvents<MinimapPluginEvents>(
        miniScope,
        miniWavesurfer,
        { emit: ctx.emit as (event: never, ...args: never[]) => void },
        FORWARDED_MINI_EVENTS,
      )

      miniScope.add(
        miniWavesurfer.on('click', (relativeX, relativeY) => {
          ctx.wavesurfer.seekTo(relativeX)
          ctx.emit('click', relativeX, relativeY)
        }),
      )

      miniScope.add(
        miniWavesurfer.on('drag', (relativeX) => {
          onMinimapDrag(relativeX)
          ctx.emit('drag', relativeX)
        }),
      )

      miniScope.add(
        miniWavesurfer.on('ready', () => {
          syncMinimapPosition(ctx.wavesurfer.getCurrentTime() || 0)
          ctx.emit('ready')
        }),
      )

      // Reset flag after initialization completes
      isInitializing = false
    }

    // Final teardown: tear down the nested wavesurfer the same way a
    // reinit would. `ctx.scope`'s children (the current `miniScope`) are
    // already disposed by the time this disposer runs (Scope disposes
    // children before its own disposers), so the `miniScope.dispose()`
    // inside `destroyMinimap()` is a no-op here — only `mini?.destroy()`
    // and the timeout clear actually do anything.
    ctx.scope.add(() => destroyMinimap())

    ctx.scope.add(
      ctx.wavesurfer.on('decode', () => {
        initMinimap()
      }),
    )

    ctx.scope.add(
      ctx.wavesurfer.on('timeupdate', (currentTime: number) => {
        syncMinimapPosition(currentTime)
      }),
    )

    ctx.scope.add(
      ctx.wavesurfer.on('drag', (relativeX: number) => {
        renderMinimapProgress(relativeX)
      }),
    )

    ctx.scope.add(
      ctx.wavesurfer.on('scroll', (startTime: number, endTime: number) => {
        updateOverlay(startTime, endTime)
      }),
    )

    ctx.scope.add(
      ctx.wavesurfer.on('redraw', () => {
        updateOverlay()
      }),
    )

    Promise.resolve().then(() => {
      // The plugin may have been destroyed before this microtask runs
      // (e.g. destroy() called synchronously right after registerPlugin());
      // ctx.scope.disposed mirrors the old `if (!this.wavesurfer) return`
      // guard for that race.
      if (ctx.scope.disposed) return
      initMinimap()
    })

    return {}
  },
)

export default MinimapPlugin
