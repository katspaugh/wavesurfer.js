import { makeDraggable } from './draggable.js'
import EventEmitter from './event-emitter.js'
import * as utils from './renderer-utils.js'
import type { WaveSurferOptions } from './wavesurfer.js'

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

class Renderer extends EventEmitter<RendererEvents> {
  private options: WaveSurferOptions
  private parent: HTMLElement
  private container: HTMLElement
  private scrollContainer: HTMLElement
  private wrapper: HTMLElement
  private canvasWrapper: HTMLElement
  private progressWrapper: HTMLElement
  private cursor: HTMLElement
  private timeouts: Array<() => void> = []
  private isScrollable = false
  private audioData: AudioBuffer | null = null
  private resizeObserver: ResizeObserver | null = null
  private lastContainerWidth = 0
  private isDragging = false
  private subscriptions: (() => void)[] = []
  private unsubscribeOnScroll: (() => void)[] = []
  private dragUnsubscribe: (() => void) | null = null

  constructor(options: WaveSurferOptions, audioElement?: HTMLElement) {
    super()

    this.subscriptions = []
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

    if (audioElement) {
      shadow.appendChild(audioElement)
    }

    this.initEvents()
  }

  private parentFromOptionsContainer(container: WaveSurferOptions['container']) {
    let parent
    if (typeof container === 'string') {
      parent = document.querySelector(container) satisfies HTMLElement | null
    } else if (container instanceof HTMLElement) {
      parent = container
    }

    if (!parent) {
      throw new Error('Container not found')
    }

    return parent
  }

  private initEvents() {
    // Add a click listener
    this.wrapper.addEventListener('click', (e) => {
      const rect = this.wrapper.getBoundingClientRect()
      const [x, y] = utils.getRelativePointerPosition(rect, e.clientX, e.clientY)
      this.emit('click', x, y)
    })

    // Add a double click listener
    this.wrapper.addEventListener('dblclick', (e) => {
      const rect = this.wrapper.getBoundingClientRect()
      const [x, y] = utils.getRelativePointerPosition(rect, e.clientX, e.clientY)
      this.emit('dblclick', x, y)
    })

    // Drag
    if (this.options.dragToSeek === true || typeof this.options.dragToSeek === 'object') {
      this.initDrag()
    }

    // Add a scroll listener
    this.scrollContainer.addEventListener('scroll', () => {
      const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer
      const { startX, endX } = utils.calculateScrollPercentages({
        scrollLeft,
        scrollWidth,
        clientWidth,
      })
      this.emit('scroll', startX, endX, scrollLeft, scrollLeft + clientWidth)
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
    if (width === this.lastContainerWidth && this.options.height !== 'auto') return
    this.lastContainerWidth = width
    this.reRender()
    this.emit('resize')
  }

  private initDrag() {
    // Don't initialize drag if it's already set up
    if (this.dragUnsubscribe) return

    this.dragUnsubscribe = makeDraggable(
      this.wrapper,
      // On drag
      (_, __, x) => {
        const width = this.wrapper.getBoundingClientRect().width
        this.emit('drag', utils.clampToUnit(x / width))
      },
      // On start drag
      (x) => {
        this.isDragging = true
        const width = this.wrapper.getBoundingClientRect().width
        this.emit('dragstart', utils.clampToUnit(x / width))
      },
      // On end drag
      (x) => {
        this.isDragging = false
        const width = this.wrapper.getBoundingClientRect().width
        this.emit('dragend', utils.clampToUnit(x / width))
      },
    )

    this.subscriptions.push(this.dragUnsubscribe)
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
    }

    this.options = options

    // Re-render the waveform
    this.reRender()
  }

  getWrapper(): HTMLElement {
    return this.wrapper
  }

  getWidth(): number {
    return this.scrollContainer.clientWidth
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

  destroy() {
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.container.remove()
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    this.unsubscribeOnScroll?.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeOnScroll = []
  }

  private createDelay(delayMs = 10): () => Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    let rejectFn: (() => void) | undefined

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

    this.timeouts.push(onClear)

    return () => {
      return new Promise<void>((resolve, reject) => {
        // Clear any pending delay
        onClear()
        // Store reject function for cleanup
        rejectFn = reject
        // Set new timeout
        timeout = setTimeout(() => {
          timeout = undefined
          rejectFn = undefined
          resolve()
        }, delayMs)
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

  private convertColorValues(color?: WaveSurferOptions['waveColor']): string | CanvasGradient {
    return utils.resolveColorValue(color, this.getPixelRatio())
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
    const { halfHeight, barWidth, barRadius, barIndexScale, barSpacing } = utils.calculateBarRenderConfig({
      width,
      height,
      length: (channelData[0] || []).length,
      options,
      pixelRatio: this.getPixelRatio(),
    })

    const segments = utils.calculateBarSegments({
      channelData,
      barIndexScale,
      barSpacing,
      barWidth,
      halfHeight,
      vScale,
      canvasHeight: height,
      barAlign: options.barAlign,
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
    ctx.fillStyle = this.convertColorValues(options.waveColor)

    if (options.renderFunction) {
      options.renderFunction(channelData, ctx)
      return
    }

    const vScale = utils.calculateVerticalScale({
      channelData,
      barHeight: options.barHeight,
      normalize: options.normalize,
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
      ctx.fillStyle = this.convertColorValues(options.waveColor)
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
      progressCtx.fillStyle = this.convertColorValues(options.progressColor as WaveSurferOptions['waveColor'])
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

    const singleCanvasWidth = utils.calculateSingleCanvasWidth({ clientWidth, totalWidth, options })
    let drawnIndexes: Record<number, boolean> = {}

    // Nothing to render
    if (singleCanvasWidth === 0) return

    // Draw a single canvas
    const draw = (index: number) => {
      if (index < 0 || index >= numCanvases) return
      if (drawnIndexes[index]) return
      drawnIndexes[index] = true
      const offset = index * singleCanvasWidth
      let clampedWidth = Math.min(totalWidth - offset, singleCanvasWidth)

      // Clamp the width to the bar grid to avoid empty canvases at the end
      clampedWidth = utils.clampWidthToBarGrid(clampedWidth, options)

      if (clampedWidth <= 0) return
      const data = utils.sliceChannelData({ channelData, offset, clampedWidth, totalWidth })
      this.renderSingleCanvas(data, options, clampedWidth, height, offset, canvasContainer, progressContainer)
    }

    // Clear canvases to avoid too many DOM nodes
    const clearCanvases = () => {
      if (utils.shouldClearCanvases(Object.keys(drawnIndexes).length)) {
        canvasContainer.innerHTML = ''
        progressContainer.innerHTML = ''
        drawnIndexes = {}
      }
    }

    // Calculate how many canvases to render
    const numCanvases = Math.ceil(totalWidth / singleCanvasWidth)

    // Render all canvases if the waveform doesn't scroll
    if (!this.isScrollable) {
      for (let i = 0; i < numCanvases; i++) {
        draw(i)
      }
      return
    }

    // Lazy rendering
    const initialRange = utils.getLazyRenderRange({
      scrollLeft: this.scrollContainer.scrollLeft,
      totalWidth,
      numCanvases,
    })
    initialRange.forEach((index) => draw(index))

    // Subscribe to the scroll event to draw additional canvases
    if (numCanvases > 1) {
      const unsubscribe = this.on('scroll', () => {
        const { scrollLeft } = this.scrollContainer
        clearCanvases()
        utils.getLazyRenderRange({ scrollLeft, totalWidth, numCanvases }).forEach((index) => draw(index))
      })

      this.unsubscribeOnScroll.push(unsubscribe)
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
    this.timeouts.forEach((clear) => clear())
    this.timeouts = []

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
    const parentWidth = this.scrollContainer.clientWidth
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
    this.unsubscribeOnScroll.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeOnScroll = []

    // Return if the waveform has not been rendered yet
    if (!this.audioData) return

    // Remember the current cursor position
    const { scrollWidth } = this.scrollContainer
    const { right: before } = this.progressWrapper.getBoundingClientRect()

    // Re-render the waveform
    this.render(this.audioData)

    // Adjust the scroll position so that the cursor stays in the same place
    if (this.isScrollable && scrollWidth !== this.scrollContainer.scrollWidth) {
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
        this.scrollContainer.scrollLeft += center
      }
    }

    // Emit the scroll event
    {
      const newScroll = this.scrollContainer.scrollLeft
      const { startX, endX } = utils.calculateScrollPercentages({
        scrollLeft: newScroll,
        scrollWidth,
        clientWidth,
      })
      this.emit('scroll', startX, endX, newScroll, newScroll + clientWidth)
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

    if (this.isScrollable && this.options.autoScroll) {
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
