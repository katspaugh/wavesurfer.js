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

  private store?: StateStore<any>
  private resizeSubject = new Subject<void>()
  private scrollSubject = new Subject<{ scrollLeft: number; scrollWidth: number; clientWidth: number }>()

  constructor(options: WaveSurferOptions, audioElement?: HTMLElement, store?: StateStore<any>) {
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

  // Placeholder for render - full implementation would be extensive
  async render(audioData: AudioBuffer) {
    this.audioData = audioData

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

    // Calculate dimensions using pure function
    const pixelRatio = window.devicePixelRatio || 1
    const parentWidth = this.scrollContainer.clientWidth
    const dimensions = waveform.calculateWaveformDimensions({
      duration: audioData.duration,
      minPxPerSec: this.options.minPxPerSec || 0,
      containerWidth: parentWidth,
      fillParent: this.options.fillParent ?? true,
    })

    this.isScrollable = dimensions.isScrollable
    this.wrapper.style.width = dimensions.isScrollable ? `${dimensions.width}px` : '100%'

    this.scrollContainer.style.overflowX = dimensions.isScrollable ? 'auto' : 'hidden'
    this.scrollContainer.classList.toggle('noScrollbar', !!this.options.hideScrollbar)

    this.cursor.style.backgroundColor = `${this.options.cursorColor || this.options.progressColor}`
    this.cursor.style.width = `${this.options.cursorWidth}px`

    this.emit('render')

    // Actual rendering implementation would go here
    // This is a simplified version for the architecture demonstration

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
