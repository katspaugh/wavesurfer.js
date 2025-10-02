/**
 * Enhanced Renderer - uses streams and resource management
 * Maintains backward compatibility while providing stream-based updates
 */

import { makeDraggable } from './draggable.js'
import EventEmitter from './event-emitter.js'
import { ResourcePool } from './utils/resources.js'
import { Subject } from './streams/index.js'
import type { WaveSurferOptions } from './wavesurfer.js'
import type { StateStore } from './state/store.js'
import type { WaveSurferState } from './state/state.types.js'
import * as waveform from './core/waveform.js'

type RendererEvents = {
  click: [relativeX: number, relativeY: number]
  dblclick: [relativeX: number, relativeY: number]
  drag: [relativeX: number]
  dragstart: [relativeX: number]
  dragend: [relativeX: number]
  scroll: [relativeStart: number, relativeEnd: number, scrollLeft: number, scrollRight: number]
  render: []
  rendered: []
}

class Renderer extends EventEmitter<RendererEvents> {
  private static MAX_CANVAS_WIDTH = 8000
  private static MAX_NODES = 10

  private options: WaveSurferOptions
  private parent: HTMLElement
  private container: HTMLElement
  private scrollContainer: HTMLElement
  private wrapper: HTMLElement
  private canvasWrapper: HTMLElement
  private progressWrapper: HTMLElement
  private cursor: HTMLElement

  private resources = new ResourcePool()
  private timeouts: Array<() => void> = []
  private isScrollable = false
  private audioData: AudioBuffer | null = null
  private lastContainerWidth = 0
  private isDragging = false
  private unsubscribeOnScroll: (() => void)[] = []

  private store?: StateStore<WaveSurferState>
  private resizeSubject = new Subject<void>()
  private scrollSubject = new Subject<{ scrollLeft: number; scrollWidth: number; clientWidth: number }>()

  constructor(options: WaveSurferOptions, audioElement?: HTMLElement, store?: StateStore<WaveSurferState>) {
    super()

    this.options = options
    this.store = store

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
    this.initStreams()
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

  private initStreams() {
    // Debounced resize handling via stream
    const resizeSub = this.resizeSubject
      .debounce(100)
      .subscribe(() => this.onContainerResize())

    this.resources.add({ dispose: () => resizeSub.unsubscribe() })

    // Scroll events via stream
    const scrollSub = this.scrollSubject.subscribe(({ scrollLeft, scrollWidth, clientWidth }) => {
      const startX = scrollLeft / scrollWidth
      const endX = (scrollLeft + clientWidth) / scrollWidth
      this.emit('scroll', startX, endX, scrollLeft, scrollLeft + clientWidth)

      // Update state if available
      if (this.store) {
        this.store.update((state) => ({
          ...state,
          view: {
            ...state.view,
            scrollLeft,
            containerWidth: clientWidth,
            waveformWidth: scrollWidth,
          },
        }))
      }
    })

    this.resources.add({ dispose: () => scrollSub.unsubscribe() })
  }

  private initEvents() {
    const getClickPosition = (e: MouseEvent): [number, number] => {
      const rect = this.wrapper.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const relativeX = waveform.pixelToRelative(x, rect.width)
      const relativeY = waveform.pixelToRelative(y, rect.height)
      return [relativeX, relativeY]
    }

    // Click listener
    this.wrapper.addEventListener('click', (e) => {
      const [x, y] = getClickPosition(e)
      this.emit('click', x, y)
    })

    // Double click listener
    this.wrapper.addEventListener('dblclick', (e) => {
      const [x, y] = getClickPosition(e)
      this.emit('dblclick', x, y)
    })

    // Drag
    if (this.options.dragToSeek === true || typeof this.options.dragToSeek === 'object') {
      this.initDrag()
    }

    // Scroll listener
    this.scrollContainer.addEventListener('scroll', () => {
      const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer
      this.scrollSubject.next({ scrollLeft, scrollWidth, clientWidth })
    })

    // Resize observer
    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => {
        this.resizeSubject.next()
      })
      resizeObserver.observe(this.scrollContainer)

      this.resources.add({
        dispose: () => resizeObserver.disconnect(),
      })
    }
  }

  private onContainerResize() {
    const width = this.parent.clientWidth
    if (width === this.lastContainerWidth && this.options.height !== 'auto') return
    this.lastContainerWidth = width
    this.reRender()
  }

  private initDrag() {
    const cleanup = makeDraggable(
      this.wrapper,
      (_, __, x) => {
        const relativeX = waveform.pixelToRelative(x, this.wrapper.getBoundingClientRect().width)
        this.emit('drag', waveform.clamp(relativeX, 0, 1))
      },
      (x) => {
        this.isDragging = true
        const relativeX = waveform.pixelToRelative(x, this.wrapper.getBoundingClientRect().width)
        this.emit('dragstart', waveform.clamp(relativeX, 0, 1))
      },
      (x) => {
        this.isDragging = false
        const relativeX = waveform.pixelToRelative(x, this.wrapper.getBoundingClientRect().width)
        this.emit('dragend', waveform.clamp(relativeX, 0, 1))
      },
    )

    this.resources.addCleanup(cleanup)
  }

  private getHeight(
    optionsHeight?: WaveSurferOptions['height'],
    optionsSplitChannel?: WaveSurferOptions['splitChannels'],
  ): number {
    const defaultHeight = 128
    const numberOfChannels = this.audioData?.numberOfChannels || 1
    if (optionsHeight == null) return defaultHeight
    if (!isNaN(Number(optionsHeight))) return Number(optionsHeight)
    if (optionsHeight === 'auto') {
      const height = this.parent.clientHeight || defaultHeight
      if (optionsSplitChannel?.every((channel) => !channel.overlay)) return height / numberOfChannels
      return height
    }
    return defaultHeight
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
    this.resources.dispose()
    this.container.remove()
    this.unsubscribeOnScroll.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeOnScroll = []
    this.resizeSubject.complete()
    this.scrollSubject.complete()
    super.destroy() // Clean up EventEmitter streams and listeners
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

  private scrollIntoView(progress: number, isPlaying = false) {
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer
    const progressWidth = progress * scrollWidth
    const startEdge = scrollLeft
    const endEdge = scrollLeft + clientWidth
    const middle = clientWidth / 2

    if (this.isDragging) {
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

      const center = progressWidth - scrollLeft - middle
      if (isPlaying && this.options.autoCenter && center > 0) {
        this.scrollContainer.scrollLeft += Math.min(center, 10)
      }
    }
  }

  private convertColorValues(color?: WaveSurferOptions['waveColor']): string | CanvasGradient {
    if (!Array.isArray(color)) return color || ''
    if (color.length < 2) return color[0] || ''

    const canvasElement = document.createElement('canvas')
    const ctx = canvasElement.getContext('2d') as CanvasRenderingContext2D
    const gradientHeight = canvasElement.height * (window.devicePixelRatio || 1)
    const gradient = ctx.createLinearGradient(0, 0, 0, gradientHeight)

    const colorStopPercentage = 1 / (color.length - 1)
    color.forEach((color, index) => {
      const offset = index * colorStopPercentage
      gradient.addColorStop(offset, color)
    })

    return gradient
  }

  private renderBarWaveform(
    channelData: Array<Float32Array | number[]>,
    options: WaveSurferOptions,
    ctx: CanvasRenderingContext2D,
    vScale: number,
  ) {
    const topChannel = channelData[0]
    const bottomChannel = channelData[1] || channelData[0]
    const length = topChannel.length

    const { width, height } = ctx.canvas
    const halfHeight = height / 2
    const pixelRatio = window.devicePixelRatio || 1

    const barWidth = options.barWidth ? options.barWidth * pixelRatio : 1
    const barGap = options.barGap ? options.barGap * pixelRatio : options.barWidth ? barWidth / 2 : 0
    const barRadius = options.barRadius || 0
    const barIndexScale = width / (barWidth + barGap) / length

    const rectFn = barRadius && 'roundRect' in ctx ? 'roundRect' : 'rect'

    ctx.beginPath()

    let prevX = 0
    let maxTop = 0
    let maxBottom = 0
    for (let i = 0; i <= length; i++) {
      const x = Math.round(i * barIndexScale)

      if (x > prevX) {
        const topBarHeight = Math.round(maxTop * halfHeight * vScale)
        const bottomBarHeight = Math.round(maxBottom * halfHeight * vScale)
        const barHeight = topBarHeight + bottomBarHeight || 1

        let y = halfHeight - topBarHeight
        if (options.barAlign === 'top') {
          y = 0
        } else if (options.barAlign === 'bottom') {
          y = height - barHeight
        }

        ctx[rectFn](prevX * (barWidth + barGap), y, barWidth, barHeight, barRadius)

        prevX = x
        maxTop = 0
        maxBottom = 0
      }

      const magnitudeTop = Math.abs(topChannel[i] || 0)
      const magnitudeBottom = Math.abs(bottomChannel[i] || 0)
      if (magnitudeTop > maxTop) maxTop = magnitudeTop
      if (magnitudeBottom > maxBottom) maxBottom = magnitudeBottom
    }

    ctx.fill()
    ctx.closePath()
  }

  private renderLineWaveform(
    channelData: Array<Float32Array | number[]>,
    _options: WaveSurferOptions,
    ctx: CanvasRenderingContext2D,
    vScale: number,
  ) {
    const drawChannel = (index: number) => {
      const channel = channelData[index] || channelData[0]
      const length = channel.length
      const { height } = ctx.canvas
      const halfHeight = height / 2
      const hScale = ctx.canvas.width / length

      ctx.moveTo(0, halfHeight)

      let prevX = 0
      let max = 0
      for (let i = 0; i <= length; i++) {
        const x = Math.round(i * hScale)

        if (x > prevX) {
          const h = Math.round(max * halfHeight * vScale) || 1
          const y = halfHeight + h * (index === 0 ? -1 : 1)
          ctx.lineTo(prevX, y)
          prevX = x
          max = 0
        }

        const value = Math.abs(channel[i] || 0)
        if (value > max) max = value
      }

      ctx.lineTo(prevX, halfHeight)
    }

    ctx.beginPath()
    drawChannel(0)
    drawChannel(1)
    ctx.fill()
    ctx.closePath()
  }

  private renderWaveform(
    channelData: Array<Float32Array | number[]>,
    options: WaveSurferOptions,
    ctx: CanvasRenderingContext2D,
  ) {
    ctx.fillStyle = this.convertColorValues(options.waveColor)

    if (options.renderFunction) {
      options.renderFunction(channelData, ctx)
      return
    }

    let vScale = options.barHeight || 1
    if (options.normalize) {
      const max = Array.from(channelData[0]).reduce((max, value) => Math.max(max, Math.abs(value)), 0)
      vScale = max ? vScale / max : vScale
    }

    if (options.barWidth || options.barGap || options.barAlign) {
      this.renderBarWaveform(channelData, options, ctx, vScale)
      return
    }

    this.renderLineWaveform(channelData, options, ctx, vScale)
  }

  private renderSingleCanvas(
    data: Array<Float32Array | number[]>,
    options: WaveSurferOptions,
    width: number,
    height: number,
    offset: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
  ) {
    const pixelRatio = window.devicePixelRatio || 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.left = `${Math.round(offset)}px`
    canvasContainer.appendChild(canvas)

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    this.renderWaveform(data, options, ctx)

    if (options.progressColor) {
      const progressCanvas = canvas.cloneNode() as HTMLCanvasElement
      const progressCtx = progressCanvas.getContext('2d') as CanvasRenderingContext2D
      progressCtx.drawImage(canvas, 0, 0)
      progressCtx.globalCompositeOperation = 'source-in'
      progressCtx.fillStyle = this.convertColorValues(options.progressColor)
      progressCtx.fillRect(0, 0, canvas.width, canvas.height)
      progressContainer.appendChild(progressCanvas)
    }
  }

  private renderMultiCanvas(
    channelData: Array<Float32Array | number[]>,
    options: WaveSurferOptions,
    width: number,
    height: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
  ) {
    const pixelRatio = window.devicePixelRatio || 1
    const { clientWidth } = this.scrollContainer
    const totalWidth = width / pixelRatio

    let singleCanvasWidth = Math.min(Renderer.MAX_CANVAS_WIDTH, clientWidth, totalWidth)
    let drawnIndexes: Record<number, boolean> = {}

    if (options.barWidth || options.barGap) {
      const barWidth = options.barWidth || 0.5
      const barGap = options.barGap || barWidth / 2
      const totalBarWidth = barWidth + barGap
      if (singleCanvasWidth % totalBarWidth !== 0) {
        singleCanvasWidth = Math.floor(singleCanvasWidth / totalBarWidth) * totalBarWidth
      }
    }

    if (singleCanvasWidth === 0) return

    const draw = (index: number) => {
      if (index < 0 || index >= numCanvases) return
      if (drawnIndexes[index]) return
      drawnIndexes[index] = true
      const offset = index * singleCanvasWidth
      let clampedWidth = Math.min(totalWidth - offset, singleCanvasWidth)

      if (options.barWidth || options.barGap) {
        const barWidth = options.barWidth || 0.5
        const barGap = options.barGap || barWidth / 2
        const totalBarWidth = barWidth + barGap
        clampedWidth = Math.floor(clampedWidth / totalBarWidth) * totalBarWidth
      }

      if (clampedWidth <= 0) return
      const data = channelData.map((channel) => {
        const start = Math.floor((offset / totalWidth) * channel.length)
        const end = Math.floor(((offset + clampedWidth) / totalWidth) * channel.length)
        return channel.slice(start, end)
      })
      this.renderSingleCanvas(data, options, clampedWidth, height, offset, canvasContainer, progressContainer)
    }

    const clearCanvases = () => {
      if (Object.keys(drawnIndexes).length > Renderer.MAX_NODES) {
        canvasContainer.innerHTML = ''
        progressContainer.innerHTML = ''
        drawnIndexes = {}
      }
    }

    const numCanvases = Math.ceil(totalWidth / singleCanvasWidth)

    if (!this.isScrollable) {
      for (let i = 0; i < numCanvases; i++) {
        draw(i)
      }
      return
    }

    const viewPosition = this.scrollContainer.scrollLeft / totalWidth
    const startCanvas = Math.floor(viewPosition * numCanvases)

    draw(startCanvas - 1)
    draw(startCanvas)
    draw(startCanvas + 1)

    if (numCanvases > 1) {
      const unsubscribe = this.on('scroll', () => {
        const { scrollLeft } = this.scrollContainer
        const canvasIndex = Math.floor((scrollLeft / totalWidth) * numCanvases)
        clearCanvases()
        draw(canvasIndex - 1)
        draw(canvasIndex)
        draw(canvasIndex + 1)
      })

      this.unsubscribeOnScroll.push(unsubscribe)
    }
  }

  private renderChannel(
    channelData: Array<Float32Array | number[]>,
    { overlay, ...options }: WaveSurferOptions & { overlay?: boolean },
    width: number,
    channelIndex: number,
  ) {
    const canvasContainer = document.createElement('div')
    const height = this.getHeight(options.height, options.splitChannels)
    canvasContainer.style.height = `${height}px`
    if (overlay && channelIndex > 0) {
      canvasContainer.style.marginTop = `-${height}px`
    }
    this.canvasWrapper.style.minHeight = `${height}px`
    this.canvasWrapper.appendChild(canvasContainer)

    const progressContainer = canvasContainer.cloneNode() as HTMLElement
    this.progressWrapper.appendChild(progressContainer)

    this.renderMultiCanvas(channelData, options, width, height, canvasContainer, progressContainer)
  }

  async render(audioData: AudioBuffer) {
    this.audioData = audioData

    // Clear canvases
    this.canvasWrapper.innerHTML = ''
    this.progressWrapper.innerHTML = ''

    // Update state
    if (this.store && audioData) {
      this.store.update((state) => ({
        ...state,
        audio: {
          ...state.audio,
          decodedData: audioData,
          duration: audioData.duration,
          channelCount: audioData.numberOfChannels,
          sampleRate: audioData.sampleRate,
        },
      }))
    }

    if (this.options.width != null) {
      this.scrollContainer.style.width =
        typeof this.options.width === 'number' ? `${this.options.width}px` : this.options.width
    }

    // Calculate dimensions
    const pixelRatio = window.devicePixelRatio || 1
    const parentWidth = this.scrollContainer.clientWidth
    const scrollWidth = Math.ceil(audioData.duration * (this.options.minPxPerSec || 0))

    this.isScrollable = scrollWidth > parentWidth
    const useParentWidth = this.options.fillParent && !this.isScrollable
    const width = (useParentWidth ? parentWidth : scrollWidth) * pixelRatio

    this.wrapper.style.width = useParentWidth ? '100%' : `${scrollWidth}px`

    this.scrollContainer.style.overflowX = this.isScrollable ? 'auto' : 'hidden'
    this.scrollContainer.classList.toggle('noScrollbar', !!this.options.hideScrollbar)

    this.cursor.style.backgroundColor = `${this.options.cursorColor || this.options.progressColor}`
    this.cursor.style.width = `${this.options.cursorWidth}px`

    this.emit('render')

    // Render waveform
    if (this.options.splitChannels) {
      for (let i = 0; i < audioData.numberOfChannels; i++) {
        const options = { ...this.options, ...this.options.splitChannels?.[i] }
        this.renderChannel([audioData.getChannelData(i)], options, width, i)
      }
    } else {
      const channels = [audioData.getChannelData(0)]
      if (audioData.numberOfChannels > 1) channels.push(audioData.getChannelData(1))
      this.renderChannel(channels, this.options, width, 0)
    }

    Promise.resolve().then(() => this.emit('rendered'))
  }

  reRender() {
    this.unsubscribeOnScroll.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeOnScroll = []

    if (!this.audioData) return

    const { scrollWidth } = this.scrollContainer
    const { right: before } = this.progressWrapper.getBoundingClientRect()

    this.render(this.audioData)

    if (this.isScrollable && scrollWidth !== this.scrollContainer.scrollWidth) {
      const { right: after } = this.progressWrapper.getBoundingClientRect()
      let delta = after - before
      delta *= 2
      delta = delta < 0 ? Math.floor(delta) : Math.ceil(delta)
      delta /= 2
      this.scrollContainer.scrollLeft += delta
    }
  }

  zoom(minPxPerSec: number) {
    this.options.minPxPerSec = minPxPerSec

    // Update state
    if (this.store) {
      this.store.update((state) => ({
        ...state,
        view: {
          ...state.view,
          minPxPerSec,
          zoom: waveform.calculateZoomLevel(minPxPerSec),
        },
      }))
    }

    this.reRender()
  }

  async exportImage(format: string, quality: number, type: 'dataURL' | 'blob'): Promise<string[] | Blob[]> {
    const canvases = this.canvasWrapper.querySelectorAll('canvas')
    if (!canvases.length) {
      throw new Error('No waveform data')
    }

    if (type === 'dataURL') {
      const images = Array.from(canvases).map((canvas) => canvas.toDataURL(format, quality))
      return Promise.resolve(images)
    }

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
