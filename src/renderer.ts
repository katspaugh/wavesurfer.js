import EventEmitter from './event-emitter.js'
import { isHTMLElement } from './dom.js'
import * as utils from './renderer-utils.js'
import type { WaveSurferOptions } from './wavesurfer.js'
import { createDragStream } from './reactive/drag-stream.js'
import { createScrollStream } from './reactive/scroll-stream.js'
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
  private isScrollable = false
  private audioData: AudioBuffer | null = null
  private resizeObserver: ResizeObserver | null = null
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
  private disposeDragStream: (() => void) | null = null
  private dragStream: { signal: any; cleanup: () => void } | null = null
  private scrollStream: { scrollData: any; percentages: any; bounds: any; cleanup: () => void } | null = null
  private containerInlinePadding = 0
  private audioDuration = signal(0)
  private visibleRange: ComputedSignal<{ startTime: number; endTime: number }>

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

    // initEvents() creates this.scrollStream, so visibleRange must be built
    // after it.
    this.initEvents()

    // visibleRange is instance-lifetime state, deliberately NOT disposed via
    // this.scope -- mirroring the WaveSurferState computeds precedent (see
    // wavesurfer.ts's constructor comment near createWaveSurferState). Why:
    // destroy() disposes and recreates `this.scope` to support the documented
    // destroy -> load() reuse contract, but this.scrollStream/initEvents()
    // only ever run once, from this constructor. If visibleRange's dispose
    // were registered on this.scope, it would be permanently disposed after
    // the FIRST destroy() with nothing left to recreate it -- breaking
    // getVisibleRange() forever for any reused instance (and for future
    // consumers like minimap/spectrogram). So visibleRange itself is never
    // disposed; it depends on this.audioDuration (owned by this instance,
    // never disposed) and, transitively through the recompute body below, on
    // this.scrollStream.percentages, which the scope cleanup below DOES
    // dispose at destroy() (and nulls out this.scrollStream). The recompute
    // body defends against that by falling back to the non-scrollable
    // {0, duration} shape whenever this.scrollStream is null, instead of
    // throwing. Net effect after a destroy(): visibleRange freezes at its
    // last live value until the next render() (which still fires, since
    // audioDuration.set() is unaffected by the scope reset) recomputes it to
    // {startTime: 0, endTime: newDuration} -- the same "not scrollable"
    // shape reported before any scroll ever happened. This mirrors the
    // pre-existing behavior of the 'scroll' event itself, which also stops
    // firing after the first destroy() for the same reason (scrollStream is
    // never recreated) -- not a regression introduced by visibleRange.
    this.visibleRange = computed(() => {
      const duration = this.audioDuration.value
      if (!this.isScrollable || duration === 0 || !this.scrollStream) {
        return { startTime: 0, endTime: duration }
      }
      const { startX, endX } = this.scrollStream.percentages.value
      return { startTime: startX * duration, endTime: endX * duration }
    }, [this.audioDuration, this.scrollStream!.percentages])
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
    this.wrapper.addEventListener('click', this.onClickWrapper)

    // Add a double click listener
    this.wrapper.addEventListener('dblclick', this.onDblClickWrapper)

    // Drag
    if (this.options.dragToSeek === true || typeof this.options.dragToSeek === 'object') {
      this.initDrag()
    }

    // Add a scroll listener using reactive stream
    this.scrollStream = createScrollStream(this.scrollContainer)
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
      this.resizeObserver = new ResizeObserver(() => {
        delay()
          .then(() => this.onContainerResize())
          .catch(() => undefined)
      })
      this.resizeObserver.observe(this.scrollContainer)
    }
  }

  private onContainerResize() {
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

    this.dragStream = createDragStream(this.wrapper)
    this.disposeDragStream = this.scope.add(() => {
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

    this.scope.add(unsubscribeDrag)
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

    if (options.dragToSeek === true || typeof this.options.dragToSeek === 'object') {
      this.initDrag()
    } else {
      this.disposeDragStream?.()
      this.disposeDragStream = null
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
    // Remove DOM event listeners
    this.wrapper.removeEventListener('click', this.onClickWrapper)
    this.wrapper.removeEventListener('dblclick', this.onDblClickWrapper)

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

    this.container.remove()
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }

  private createDelay(delayMs = 10): () => Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    let rejectFn: (() => void) | undefined
    let deregister: (() => void) | undefined

    const onClear = () => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = undefined
      }
      if (rejectFn) {
        rejectFn()
        rejectFn = undefined
      }
    }

    return () => {
      return new Promise<void>((resolve, reject) => {
        // Drop the previous registration (a no-op if its delayScope was
        // already replaced by render()) and clear any pending delay
        deregister?.()
        onClear()
        // Store reject function for cleanup
        rejectFn = reject
        // Set new timeout
        timeout = setTimeout(() => {
          timeout = undefined
          rejectFn = undefined
          resolve()
        }, delayMs)
        // Register on the CURRENT delayScope so the next render() pass and
        // destroy() can both cancel this pending delay
        deregister = this.delayScope.add(onClear)
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
    if (!this.isScrollable) {
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
    this.isScrollable = isScrollable

    // Set the width of the wrapper
    this.wrapper.style.width = useParentWidth ? '100%' : `${scrollWidth}px`

    // Set additional styles
    this.scrollContainer.style.overflowX = this.isScrollable ? 'auto' : 'hidden'
    this.scrollContainer.classList.toggle('noScrollbar', !!this.options.hideScrollbar)
    this.cursor.style.backgroundColor = `${this.options.cursorColor || this.options.progressColor}`
    this.cursor.style.width = `${this.options.cursorWidth}px`

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
    if (!this.isScrollable && this.scrollContainer.scrollLeft) {
      this.scrollContainer.scrollLeft = 0
    } else if (this.isScrollable && scrollWidth !== this.scrollContainer.scrollWidth) {
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
    if (this.isScrollable && this.options.autoScroll && this.audioData && this.audioData.duration > 0) {
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
