import EventEmitter from './event-emitter.js'
import { isHTMLElement } from './dom.js'
import * as utils from './renderer-utils.js'
import type { WaveSurferOptions } from './wavesurfer.js'
import { createDragStream, type DragEvent } from './reactive/drag-stream.js'
import { createScrollStream, type ScrollStream } from './reactive/scroll-stream.js'
import { computed, effect, signal, type ComputedSignal, type Signal } from './reactive/store.js'
import { Scope } from './scope.js'

type ChannelData = utils.ChannelData

type RendererEvents = {
  click: [relativeX: number, relativeY: number]
  dblclick: [relativeX: number, relativeY: number]
  drag: [relativeX: number]
  dragstart: [relativeX: number]
  dragend: [relativeX: number]
  scroll: [relativeStart: number, relativeEnd: number, scrollLeft: number, scrollRight: number]
  render: []
  rendered: []
  resize: []
}

const SMOOTH_SCROLL_FPS = 60
const SMOOTH_SCROLL_MAX_DELTA = 10
const LOW_ZOOM_PIXELS_PER_SECOND_THRESHOLD = SMOOTH_SCROLL_MAX_DELTA * SMOOTH_SCROLL_FPS

class Renderer extends EventEmitter<RendererEvents> {
  private options: WaveSurferOptions
  private parent: HTMLElement
  private container: HTMLElement
  private scrollContainer: HTMLElement
  private wrapper: HTMLElement
  private canvasWrapper: HTMLElement
  private progressWrapper: HTMLElement
  private cursor: HTMLElement
  // A signal (not a plain field) because visibleRange's auto-tracked computed
  // reads it: a scrollable transition (fit-to-width -> zoomed, or back) must
  // trigger a recompute even when nothing else changed that render -- e.g.
  // zoom() on the same audio leaves audioDuration untouched (Object.is no-op)
  // and streamEpoch only bumps on stream rebuilds, so a plain field here left
  // visibleRange (and the lazy-render effect subscribed to it) frozen with
  // the dependency set collected on the non-scrollable early-return branch.
  private isScrollable = signal(false)
  private audioData: AudioBuffer | null = null
  private lastContainerWidth = 0
  private isDragging = false
  private scope = new Scope()
  // Recreated (disposed + replaced) at the top of render()/reRender(), exactly
  // where `unsubscribeOnScroll.forEach(...); unsubscribeOnScroll = []` used to run.
  private scrollRenderScope = this.scope.child()
  // Recreated at the top of render() only, matching the original
  // `timeouts.forEach(clear); timeouts = []` there. Each pending delay()
  // registers its cancellation on the delayScope current at call time, so
  // both the next render() pass and destroy() can cancel it.
  private delayScope = this.scope.child()
  // Child of this.scope, created fresh in initDrag() and disposed+cleared in
  // disposeDrag(). Scoping the drag stream + its effect to their own child
  // (instead of registering their disposers straight onto this.scope) means
  // repeated setOptions({dragToSeek}) toggles dispose exactly what the last
  // initDrag() added -- a disposed child detaches itself from its parent, so
  // this.scope never accumulates stale disposers across toggles.
  private dragScope: Scope | null = null
  private dragStream: { signal: Signal<DragEvent | null>; cleanup: () => void } | null = null
  private scrollStream: ScrollStream | null = null
  private containerInlinePadding = 0
  private audioDuration = signal(0)
  // Bumped in initEvents() every time a new this.scrollStream is created
  // (construction, and each destroy() -> render() revival). Read (but
  // otherwise unused) inside visibleRange's auto-tracked computed body below
  // purely to force it to be a dependency -- see that computed's comment for
  // why this is needed on top of this.audioDuration.
  private streamEpoch = signal(0)
  private visibleRange: ComputedSignal<{ startTime: number; endTime: number }>
  // initEvents() (click/dblclick listeners, scrollStream, dragStream,
  // resize observer) only ever ran from the constructor, historically. But
  // destroy() disposes+recreates this.scope and tears the DOM listeners
  // down manually, so a reused instance (destroy() -> load() -> render())
  // needs its input pipeline rebuilt too. ensureInputEvents() makes that
  // idempotent: the constructor and the top of render() both call it, and
  // destroy() flips the flag back off so the next render() re-runs it.
  private inputEventsInitialized = false

  constructor(options: WaveSurferOptions, audioElement?: HTMLElement) {
    super()

    this.options = options

    const parent = this.parentFromOptionsContainer(options.container)
    this.parent = parent

    const [div, shadow] = this.initHtml()
    parent.appendChild(div)
    this.container = div
    this.scrollContainer = shadow.querySelector('.scroll') as HTMLElement
    this.wrapper = shadow.querySelector('.wrapper') as HTMLElement
    this.canvasWrapper = shadow.querySelector('.canvases') as HTMLElement
    this.progressWrapper = shadow.querySelector('.progress') as HTMLElement
    this.cursor = shadow.querySelector('.cursor') as HTMLElement
    this.calculateInlinePadding()

    if (audioElement) {
      shadow.appendChild(audioElement)
    }

    // ensureInputEvents() creates this.scrollStream, so visibleRange must be
    // built after it.
    this.ensureInputEvents()

    // visibleRange is instance-lifetime state, deliberately NOT disposed via
    // this.scope -- mirroring the WaveSurferState computeds precedent (see
    // wavesurfer.ts's constructor comment near createWaveSurferState). Why:
    // destroy() disposes and recreates `this.scope` to support the documented
    // destroy -> load() reuse contract, and ensureInputEvents() rebuilds
    // this.scrollStream on the next render() after a destroy(). If
    // visibleRange's dispose were registered on this.scope, it would be
    // permanently disposed after the FIRST destroy() with nothing left to
    // recreate it -- breaking getVisibleRange() forever for any reused
    // instance (and for future consumers like minimap/spectrogram). So
    // visibleRange itself is never disposed; it depends on this.audioDuration
    // (owned by this instance, never disposed) and, transitively through the
    // recompute body below, on this.scrollStream.percentages, which the scope
    // cleanup in initEvents() DOES dispose at destroy() (and nulls out
    // this.scrollStream). The recompute body defends against that by falling
    // back to the non-scrollable {0, duration} shape whenever
    // this.scrollStream is null, instead of throwing.
    //
    // Deliberately built with NO explicit dependency array (auto-tracking):
    // computed()'s auto mode re-collects dependencies from the signals
    // actually read on each recompute (see store.ts). An explicit
    // `[this.audioDuration, this.scrollStream.percentages]` array would pin
    // the subscription to whichever percentages signal object existed at
    // construction time; once ensureInputEvents() rebuilds this.scrollStream
    // on a post-destroy render(), that pinned subscription would keep
    // pointing at the old, now-orphaned percentages signal forever, and
    // visibleRange would never react to scroll again after the first
    // destroy(). Auto-tracking re-subscribes to whatever this.scrollStream
    // currently is every time the computed reruns.
    //
    // But a recompute has to actually FIRE for that re-subscription to
    // happen, and audioDuration.set(duration) in render() -- the trigger
    // this used to rely on exclusively -- is a no-op via Object.is whenever
    // the reused instance loads audio of the SAME duration (the most common
    // reuse: reloading the same track). With no duration change to ride
    // along on, nothing would tell visibleRange to recompute, and it would
    // stay subscribed to the disposed, orphaned pre-destroy percentages
    // signal forever. this.streamEpoch closes that gap: initEvents() bumps
    // it every time it builds a new this.scrollStream (construction, and
    // every destroy() -> render() revival), and reading it here makes it a
    // tracked dependency, so that bump alone -- independent of whether
    // audioDuration actually changed -- forces the one recompute needed to
    // re-collect dependencies against the new stream.
    this.visibleRange = computed(() => {
      // Tracked only to force a recompute when initEvents() rebuilds
      // this.scrollStream; see the comment above.
      void this.streamEpoch.value
      const duration = this.audioDuration.value
      if (!this.isScrollable.value || duration === 0 || !this.scrollStream) {
        return { startTime: 0, endTime: duration }
      }
      const { startX, endX } = this.scrollStream.percentages.value
      return { startTime: startX * duration, endTime: endX * duration }
    })
  }

  /**
   * Idempotently (re)establishes the input pipeline: click/dblclick DOM
   * listeners, the scroll stream (and its 'scroll' event bridge), the
   * optional drag stream, and the resize observer. Runs once from the
   * constructor; destroy() flips inputEventsInitialized back to false so the
   * next render() call re-runs initEvents() and revives the pipeline for a
   * reused instance.
   */
  private ensureInputEvents(): void {
    if (this.inputEventsInitialized) return
    this.inputEventsInitialized = true
    this.initEvents()
  }

  private parentFromOptionsContainer(container: WaveSurferOptions['container']) {
    let parent
    if (typeof container === 'string') {
      parent = document.querySelector(container) satisfies HTMLElement | null
    } else if (isHTMLElement(container)) {
      parent = container
    }

    if (!parent) {
      throw new Error('Container not found')
    }

    return parent
  }

  private onClickWrapper = (e: MouseEvent) => {
    const rect = this.wrapper.getBoundingClientRect()
    const [x, y] = utils.getRelativePointerPosition(rect, e.clientX, e.clientY)
    this.emit('click', x, y)
  }

  private onDblClickWrapper = (e: MouseEvent) => {
    const rect = this.wrapper.getBoundingClientRect()
    const [x, y] = utils.getRelativePointerPosition(rect, e.clientX, e.clientY)
    this.emit('dblclick', x, y)
  }

  private initEvents() {
    // Add a click listener
    this.scope.listen(this.wrapper, 'click', this.onClickWrapper as EventListener)

    // Add a double click listener
    this.scope.listen(this.wrapper, 'dblclick', this.onDblClickWrapper as EventListener)

    // Drag
    if (this.options.dragToSeek === true || typeof this.options.dragToSeek === 'object') {
      this.initDrag()
    }

    // Add a scroll listener using reactive stream
    this.scrollStream = createScrollStream(this.scrollContainer)
    // Force visibleRange's auto-tracked computed to recompute and
    // re-subscribe to THIS scrollStream's percentages, even when nothing
    // else about to run this render cycle (e.g. audioDuration.set()) will
    // actually change value and fire on its own -- see visibleRange's
    // constructor comment.
    this.streamEpoch.update((n) => n + 1)
    const unsubscribeScroll = effect(() => {
      const { startX, endX } = this.scrollStream!.percentages.value
      const { left, right } = this.scrollStream!.bounds.value
      this.emit('scroll', startX, endX, left, right)
    }, [this.scrollStream.percentages, this.scrollStream.bounds])
    this.scope.add(unsubscribeScroll)
    this.scope.add(() => {
      this.scrollStream?.cleanup()
      this.scrollStream = null
    })

    // Re-render the waveform on container resize
    if (typeof ResizeObserver === 'function') {
      const delay = this.createDelay(100)
      // The observer itself is scope-owned (createResizeObserver registers its
      // own disconnect on this.scope) -- no need to keep a field reference to
      // it here; nothing in this class ever read one.
      this.scope.createResizeObserver(this.scrollContainer, () => {
        delay()
          .then(() => this.onContainerResize())
          .catch(() => undefined)
      })
    }
  }

  private onContainerResize() {
    // A container resize changes the scrollContainer's clientWidth (and
    // potentially scrollWidth) without dispatching a 'scroll' event -- refresh
    // unconditionally, even when the early-return below skips a full
    // re-render, so visibleRange never reports stale metrics.
    this.scrollStream?.refresh()
    const width = this.parent.clientWidth
    this.calculateInlinePadding()
    if (width === this.lastContainerWidth && this.options.height !== 'auto') return
    this.lastContainerWidth = width
    this.reRender()
    this.emit('resize')
  }

  private initDrag() {
    // Don't initialize drag if it's already set up
    if (this.dragStream) return

    const dragScope = this.scope.child()
    this.dragScope = dragScope

    this.dragStream = createDragStream(this.wrapper)
    dragScope.add(() => {
      this.dragStream?.cleanup()
      this.dragStream = null
    })

    const unsubscribeDrag = effect(() => {
      const drag = this.dragStream!.signal.value
      if (!drag) return

      const width = this.wrapper.getBoundingClientRect().width
      const relX = utils.clampToUnit(drag.x / width)

      if (drag.type === 'start') {
        this.isDragging = true
        this.emit('dragstart', relX)
      } else if (drag.type === 'move') {
        this.emit('drag', relX)
      } else if (drag.type === 'end') {
        this.isDragging = false
        this.emit('dragend', relX)
      }
    }, [this.dragStream.signal])

    dragScope.add(unsubscribeDrag)
  }

  /**
   * Tears down the drag stream + its effect by disposing their child scope
   * (see dragScope above), then clears the field so the next initDrag()
   * starts from a clean, freshly-created child of the current this.scope.
   * Safe to call when drag was never initialized (dragScope is null, or
   * already disposed from a prior destroy()) -- Scope#dispose() is a no-op
   * the second time.
   */
  private disposeDrag() {
    this.dragScope?.dispose()
    this.dragScope = null
  }

  private calculateInlinePadding(): void {
    const { paddingLeft, paddingRight } = getComputedStyle(this.scrollContainer)
    const padding = parseFloat(paddingLeft) + parseFloat(paddingRight)
    this.containerInlinePadding = Number.isNaN(padding) ? 0 : padding
  }

  private initHtml(): [HTMLElement, ShadowRoot] {
    const div = document.createElement('div')
    const shadow = div.attachShadow({ mode: 'open' })

    const cspNonce =
      this.options.cspNonce && typeof this.options.cspNonce === 'string' ? this.options.cspNonce.replace(/"/g, '') : ''

    shadow.innerHTML = `
      <style${cspNonce ? ` nonce="${cspNonce}"` : ''}>
        :host {
          user-select: none;
          min-width: 1px;
        }
        :host audio {
          display: block;
          width: 100%;
        }
        :host .scroll {
          overflow-x: auto;
          overflow-y: hidden;
          width: 100%;
          position: relative;
        }
        :host .noScrollbar {
          scrollbar-color: transparent;
          scrollbar-width: none;
        }
        :host .noScrollbar::-webkit-scrollbar {
          display: none;
          -webkit-appearance: none;
        }
        :host .wrapper {
          position: relative;
          overflow: visible;
          z-index: 2;
        }
        :host .canvases {
          min-height: ${this.getHeight(this.options.height, this.options.splitChannels)}px;
          pointer-events: none;
        }
        :host .canvases > div {
          position: relative;
        }
        :host canvas {
          display: block;
          position: absolute;
          top: 0;
          image-rendering: pixelated;
        }
        :host .progress {
          pointer-events: none;
          position: absolute;
          z-index: 2;
          top: 0;
          left: 0;
          width: 0;
          height: 100%;
          overflow: hidden;
        }
        :host .progress > div {
          position: relative;
        }
        :host .cursor {
          pointer-events: none;
          position: absolute;
          z-index: 5;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 2px;
        }
      </style>

      <div class="scroll" part="scroll">
        <div class="wrapper" part="wrapper">
          <div class="canvases" part="canvases"></div>
          <div class="progress" part="progress"></div>
          <div class="cursor" part="cursor"></div>
        </div>
      </div>
    `

    return [div, shadow]
  }

  /** Wavesurfer itself calls this method. Do not call it manually. */
  setOptions(options: WaveSurferOptions) {
    if (this.options.container !== options.container) {
      const newParent = this.parentFromOptionsContainer(options.container)
      newParent.appendChild(this.container)

      this.parent = newParent
    }

    if (options.dragToSeek === true || typeof options.dragToSeek === 'object') {
      this.initDrag()
    } else {
      this.disposeDrag()
    }

    this.options = options

    // Re-render the waveform
    this.reRender()
  }

  getWrapper(): HTMLElement {
    return this.wrapper
  }

  getWidth(): number {
    return this.scrollContainer.clientWidth - this.containerInlinePadding
  }

  getScroll(): number {
    return this.scrollContainer.scrollLeft
  }

  setScroll(pixels: number) {
    this.scrollContainer.scrollLeft = pixels
  }

  setScrollPercentage(percent: number) {
    const { scrollWidth } = this.scrollContainer
    const scrollStart = scrollWidth * percent
    this.setScroll(scrollStart)
  }

  /**
   * The currently visible time range, derived from scroll position and
   * audio duration -- `{startTime: 0, endTime: duration}` when the waveform
   * isn't scrollable. Read-only; consumers (e.g. the timeline plugin) should
   * subscribe/effect off it rather than recomputing scroll math themselves.
   */
  getVisibleRange(): Signal<{ startTime: number; endTime: number }> {
    return this.visibleRange
  }

  destroy() {
    // Removes the click/dblclick DOM listeners and disconnects the resize
    // observer (both registered on this.scope in initEvents()/
    // ensureInputEvents() above), plus the scroll/drag streams.
    this.scope.dispose()
    // A Renderer instance IS reused after WaveSurfer.destroy(): a subsequent
    // load() reaches render(), and setOptions() reaches reRender(). A
    // disposed Scope hands back pre-disposed children from child(), so
    // without recreating here, render()/reRender()'s own scope resets would
    // install permanently-disposed scrollRenderScope/delayScope and any
    // lazy-render scroll subscription registered afterward would be torn
    // down the instant it's added (see renderMultiCanvas()). Recreate fresh
    // scopes exactly as Player/WaveSurfer do.
    this.scope = new Scope()
    this.scrollRenderScope = this.scope.child()
    this.delayScope = this.scope.child()

    // Flip so the next render() re-runs initEvents() via ensureInputEvents(),
    // reviving the click/dblclick listeners, scroll/drag streams, and resize
    // observer just disposed via the (now-replaced) this.scope above.
    this.inputEventsInitialized = false

    this.container.remove()
  }

  private createDelay(delayMs = 10): () => Promise<void> {
    let cancelTimeout: (() => void) | undefined
    let cancelReject: (() => void) | undefined
    let rejectFn: (() => void) | undefined

    // Cancels the pending scope.timeout() (if any) and rejects its promise
    // (if still pending). Runs both when a new delay() call supersedes the
    // previous one and when the CURRENT delayScope is disposed (by the next
    // render() pass or destroy()) -- registered on delayScope below so scope
    // disposal triggers it just like the removed manual clearTimeout() did.
    const onClear = () => {
      cancelTimeout?.()
      cancelTimeout = undefined
      cancelReject?.()
      cancelReject = undefined
      if (rejectFn) {
        rejectFn()
        rejectFn = undefined
      }
    }

    return () => {
      return new Promise<void>((resolve, reject) => {
        // Cancel any pending delay from a previous call
        onClear()
        // Store reject function for cleanup
        rejectFn = reject
        // Register on the CURRENT delayScope so the next render() pass and
        // destroy() can both cancel this pending delay
        cancelTimeout = this.delayScope.timeout(() => {
          rejectFn = undefined
          cancelReject?.()
          cancelReject = undefined
          resolve()
        }, delayMs)
        cancelReject = this.delayScope.add(onClear)
      })
    }
  }

  private getHeight(
    optionsHeight?: WaveSurferOptions['height'],
    optionsSplitChannel?: WaveSurferOptions['splitChannels'],
  ): number {
    const numberOfChannels = this.audioData?.numberOfChannels || 1
    return utils.resolveChannelHeight({
      optionsHeight,
      optionsSplitChannels: optionsSplitChannel,
      parentHeight: this.parent.clientHeight,
      numberOfChannels,
      defaultHeight: utils.DEFAULT_HEIGHT,
    })
  }

  private convertColorValues(
    color?: WaveSurferOptions['waveColor'],
    ctx?: CanvasRenderingContext2D,
  ): string | CanvasGradient {
    return utils.resolveColorValue(color, this.getPixelRatio(), ctx?.canvas.height)
  }

  private getPixelRatio(): number {
    return utils.getPixelRatio(window.devicePixelRatio)
  }

  private renderBarWaveform(
    channelData: ChannelData,
    options: WaveSurferOptions,
    ctx: CanvasRenderingContext2D,
    vScale: number,
  ) {
    const { width, height } = ctx.canvas
    const { halfHeight, barWidth, barRadius, barIndexScale, barSpacing, barMinHeight } = utils.calculateBarRenderConfig(
      {
        width,
        height,
        length: (channelData[0] || []).length,
        options,
        pixelRatio: this.getPixelRatio(),
      },
    )

    const segments = utils.calculateBarSegments({
      channelData,
      barIndexScale,
      barSpacing,
      barWidth,
      halfHeight,
      vScale,
      canvasHeight: height,
      barAlign: options.barAlign,
      barMinHeight,
    })

    ctx.beginPath()

    for (const segment of segments) {
      if (barRadius && 'roundRect' in ctx) {
        ;(
          ctx as CanvasRenderingContext2D & {
            roundRect: (
              x: number,
              y: number,
              width: number,
              height: number,
              radii?: number | DOMPointInit | DOMPointInit[],
            ) => void
          }
        ).roundRect(segment.x, segment.y, segment.width, segment.height, barRadius)
      } else {
        ctx.rect(segment.x, segment.y, segment.width, segment.height)
      }
    }

    ctx.fill()
    ctx.closePath()
  }

  private renderLineWaveform(
    channelData: ChannelData,
    _options: WaveSurferOptions,
    ctx: CanvasRenderingContext2D,
    vScale: number,
  ) {
    const { width, height } = ctx.canvas
    const paths = utils.calculateLinePaths({ channelData, width, height, vScale })

    ctx.beginPath()

    for (const path of paths) {
      if (!path.length) continue
      ctx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) {
        const point = path[i]
        ctx.lineTo(point.x, point.y)
      }
    }

    ctx.fill()
    ctx.closePath()
  }

  private renderWaveform(channelData: ChannelData, options: WaveSurferOptions, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.convertColorValues(options.waveColor, ctx)

    if (options.renderFunction) {
      options.renderFunction(channelData, ctx)
      return
    }

    const vScale = utils.calculateVerticalScale({
      channelData,
      barHeight: options.barHeight,
      normalize: options.normalize,
      maxPeak: options.maxPeak,
    })

    if (utils.shouldRenderBars(options)) {
      this.renderBarWaveform(channelData, options, ctx, vScale)
      return
    }

    this.renderLineWaveform(channelData, options, ctx, vScale)
  }

  private renderSingleCanvas(
    data: ChannelData,
    options: WaveSurferOptions,
    width: number,
    height: number,
    offset: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
  ) {
    const pixelRatio = this.getPixelRatio()
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.left = `${Math.round(offset)}px`
    canvasContainer.appendChild(canvas)

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    if (options.renderFunction) {
      ctx.fillStyle = this.convertColorValues(options.waveColor, ctx)
      options.renderFunction(data, ctx)
    } else {
      this.renderWaveform(data, options, ctx)
    }

    // Draw a progress canvas
    if (canvas.width > 0 && canvas.height > 0) {
      const progressCanvas = canvas.cloneNode() as HTMLCanvasElement
      const progressCtx = progressCanvas.getContext('2d') as CanvasRenderingContext2D
      progressCtx.drawImage(canvas, 0, 0)
      // Set the composition method to draw only where the waveform is drawn
      progressCtx.globalCompositeOperation = 'source-in'
      progressCtx.fillStyle = this.convertColorValues(
        options.progressColor as WaveSurferOptions['waveColor'],
        progressCtx,
      )
      // This rectangle acts as a mask thanks to the composition method
      progressCtx.fillRect(0, 0, canvas.width, canvas.height)
      progressContainer.appendChild(progressCanvas)
    }
  }

  private renderMultiCanvas(
    channelData: ChannelData,
    options: WaveSurferOptions,
    width: number,
    height: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
  ) {
    const pixelRatio = this.getPixelRatio()
    const { clientWidth } = this.scrollContainer
    const totalWidth = width / pixelRatio

    const plan = utils.computeCanvasPlan({ clientWidth, totalWidth, options })
    let drawnIndexes: Record<number, boolean> = {}

    // Nothing to render
    if (plan.singleCanvasWidth === 0) return

    // Draw a single canvas
    const draw = (index: number) => {
      const slot = plan.slots[index]
      if (!slot) return
      if (drawnIndexes[index]) return
      drawnIndexes[index] = true
      const data = utils.sliceChannelData({ channelData, offset: slot.offset, clampedWidth: slot.width, totalWidth })
      this.renderSingleCanvas(data, options, slot.width, height, slot.offset, canvasContainer, progressContainer)
    }

    // Clear canvases to avoid too many DOM nodes
    const clearCanvases = () => {
      if (utils.shouldClearCanvases(Object.keys(drawnIndexes).length)) {
        canvasContainer.innerHTML = ''
        progressContainer.innerHTML = ''
        drawnIndexes = {}
      }
    }

    // Render all canvases if the waveform doesn't scroll
    if (!this.isScrollable.value) {
      for (let i = 0; i < plan.numCanvases; i++) {
        draw(i)
      }
      return
    }

    // Lazy rendering
    const initialRange = utils.getLazyRenderRange({
      scrollLeft: this.scrollContainer.scrollLeft,
      totalWidth,
      numCanvases: plan.numCanvases,
    })
    initialRange.forEach((index) => draw(index))

    // Subscribe to visibleRange to draw additional canvases as the user
    // scrolls. visibleRange is the trigger; the DOM scrollLeft read below
    // stays the source of truth for the pixel math, unchanged from before.
    if (plan.numCanvases > 1) {
      const unsubscribe = effect(() => {
        const { scrollLeft } = this.scrollContainer
        clearCanvases()
        utils
          .getLazyRenderRange({ scrollLeft, totalWidth, numCanvases: plan.numCanvases })
          .forEach((index) => draw(index))
      }, [this.visibleRange])

      this.scrollRenderScope.add(unsubscribe)
    }
  }

  private renderChannel(
    channelData: ChannelData,
    { overlay, ...options }: WaveSurferOptions & { overlay?: boolean },
    width: number,
    channelIndex: number,
  ) {
    // A container for canvases
    const canvasContainer = document.createElement('div')
    const height = this.getHeight(options.height, options.splitChannels)
    canvasContainer.style.height = `${height}px`
    if (overlay && channelIndex > 0) {
      canvasContainer.style.marginTop = `-${height}px`
    }
    this.canvasWrapper.style.minHeight = `${height}px`
    this.canvasWrapper.appendChild(canvasContainer)

    // A container for progress canvases
    const progressContainer = canvasContainer.cloneNode() as HTMLElement
    this.progressWrapper.appendChild(progressContainer)

    // Render the waveform
    this.renderMultiCanvas(channelData, options, width, height, canvasContainer, progressContainer)
  }

  async render(audioData: AudioBuffer) {
    // Revive the input pipeline if this instance is being reused after a
    // destroy() (no-op otherwise, see ensureInputEvents()).
    this.ensureInputEvents()

    // Clear previous timeouts
    this.delayScope.dispose()
    this.delayScope = this.scope.child()

    // Clear scroll subscriptions from previous render
    this.scrollRenderScope.dispose()
    this.scrollRenderScope = this.scope.child()

    // Clear the canvases
    this.canvasWrapper.innerHTML = ''
    this.progressWrapper.innerHTML = ''

    // Width
    if (this.options.width != null) {
      this.scrollContainer.style.width =
        typeof this.options.width === 'number' ? `${this.options.width}px` : this.options.width
    }

    // Determine the width of the waveform
    const pixelRatio = this.getPixelRatio()
    const parentWidth = this.scrollContainer.clientWidth - this.containerInlinePadding
    const { scrollWidth, isScrollable, useParentWidth, width } = utils.calculateWaveformLayout({
      duration: audioData.duration,
      minPxPerSec: this.options.minPxPerSec || 0,
      parentWidth,
      fillParent: this.options.fillParent,
      pixelRatio,
    })

    // Whether the container should scroll
    this.isScrollable.set(isScrollable)

    // Set the width of the wrapper
    this.wrapper.style.width = useParentWidth ? '100%' : `${scrollWidth}px`

    // Set additional styles
    this.scrollContainer.style.overflowX = this.isScrollable.value ? 'auto' : 'hidden'
    this.scrollContainer.classList.toggle('noScrollbar', !!this.options.hideScrollbar)
    this.cursor.style.backgroundColor = `${this.options.cursorColor || this.options.progressColor}`
    this.cursor.style.width = `${this.options.cursorWidth}px`

    // Layout is now settled (wrapper width + scrollContainer overflow both
    // just set above): re-read the DOM's actual scroll metrics into
    // scrollStream so visibleRange (and any other percentages/bounds
    // consumer) reflects reality immediately, instead of staying pinned to
    // whatever scrollWidth/clientWidth existed when the stream was created
    // (construction time, or the previous render's layout) until the next
    // 'scroll' DOM event happens to fire.
    this.scrollStream?.refresh()

    this.audioData = audioData
    this.audioDuration.set(audioData.duration)

    this.emit('render')

    // Render the waveform
    if (this.options.splitChannels) {
      // Render a waveform for each channel
      for (let i = 0; i < audioData.numberOfChannels; i++) {
        const options = { ...this.options, ...this.options.splitChannels?.[i] }
        this.renderChannel([audioData.getChannelData(i)], options, width, i)
      }
    } else {
      // Render a single waveform for the first two channels (left and right)
      const channels = [audioData.getChannelData(0)]
      if (audioData.numberOfChannels > 1) channels.push(audioData.getChannelData(1))
      this.renderChannel(channels, this.options, width, 0)
    }

    // Must be emitted asynchronously for backward compatibility
    Promise.resolve().then(() => this.emit('rendered'))
  }

  reRender() {
    this.scrollRenderScope.dispose()
    this.scrollRenderScope = this.scope.child()

    // Return if the waveform has not been rendered yet
    if (!this.audioData) return

    // Remember the current cursor position
    const { scrollWidth } = this.scrollContainer
    const { right: before } = this.progressWrapper.getBoundingClientRect()

    // Re-render the waveform
    this.render(this.audioData)

    // Adjust the scroll position so that the cursor stays in the same place
    if (!this.isScrollable.value && this.scrollContainer.scrollLeft) {
      this.scrollContainer.scrollLeft = 0
    } else if (this.isScrollable.value && scrollWidth !== this.scrollContainer.scrollWidth) {
      const { right: after } = this.progressWrapper.getBoundingClientRect()
      const delta = utils.roundToHalfAwayFromZero(after - before)
      this.scrollContainer.scrollLeft += delta
    }
  }

  zoom(minPxPerSec: number) {
    this.options.minPxPerSec = minPxPerSec
    this.reRender()
  }

  private scrollIntoView(progress: number, isPlaying = false) {
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer
    const progressWidth = progress * scrollWidth
    const startEdge = scrollLeft
    const endEdge = scrollLeft + clientWidth
    const middle = clientWidth / 2

    if (this.isDragging) {
      // Scroll when dragging close to the edge of the viewport
      const minGap = 30
      if (progressWidth + minGap > endEdge) {
        this.scrollContainer.scrollLeft += minGap
      } else if (progressWidth - minGap < startEdge) {
        this.scrollContainer.scrollLeft -= minGap
      }
    } else {
      if (progressWidth < startEdge || progressWidth > endEdge) {
        this.scrollContainer.scrollLeft = progressWidth - (this.options.autoCenter ? middle : 0)
      }

      // Keep the cursor centered when playing
      const center = progressWidth - scrollLeft - middle
      if (isPlaying && this.options.autoCenter && center > 0) {
        const duration = this.audioData?.duration
        if (duration === undefined || duration <= 0) {
          this.scrollContainer.scrollLeft += center
          return
        }

        const pixelsPerSecond = scrollWidth / duration
        if (pixelsPerSecond <= LOW_ZOOM_PIXELS_PER_SECOND_THRESHOLD) {
          this.scrollContainer.scrollLeft += Math.min(center, SMOOTH_SCROLL_MAX_DELTA)
        } else {
          this.scrollContainer.scrollLeft += center
        }
      }
    }
  }

  renderProgress(progress: number, isPlaying?: boolean) {
    if (isNaN(progress)) return
    const percents = progress * 100
    this.canvasWrapper.style.clipPath = `polygon(${percents}% 0%, 100% 0%, 100% 100%, ${percents}% 100%)`
    this.progressWrapper.style.width = `${percents}%`
    this.cursor.style.left = `${percents}%`
    this.cursor.style.transform = this.options.cursorWidth
      ? `translateX(-${progress * this.options.cursorWidth}px)`
      : ''

    // Only scroll if we have valid audio data to prevent race conditions during loading
    if (this.isScrollable.value && this.options.autoScroll && this.audioData && this.audioData.duration > 0) {
      this.scrollIntoView(progress, isPlaying)
    }
  }

  async exportImage(format: string, quality: number, type: 'dataURL' | 'blob'): Promise<string[] | Blob[]> {
    const canvases = this.canvasWrapper.querySelectorAll('canvas')
    if (!canvases.length) {
      throw new Error('No waveform data')
    }

    // Data URLs
    if (type === 'dataURL') {
      const images = Array.from(canvases).map((canvas) => canvas.toDataURL(format, quality))
      return Promise.resolve(images)
    }

    // Blobs
    return Promise.all(
      Array.from(canvases).map((canvas) => {
        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Could not export image'))
              }
            },
            format,
            quality,
          )
        })
      }),
    )
  }
}

export default Renderer
