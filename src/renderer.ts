import EventEmitter from './event-emitter.js'

export type RendererStyleOptions = {
  height: number
  waveColor: string
  progressColor: string
  cursorColor?: string
  cursorWidth: number
  minPxPerSec: number
  fillParent: boolean
  barWidth?: number
  barGap?: number
  barRadius?: number
  barHeight?: number
  hideScrollbar?: boolean
  autoCenter?: boolean
  autoScroll?: boolean
}

type RendererEvents = {
  click: [relativeX: number]
  drag: [relativeX: number]
  scroll: [relativeStart: number, relativeEnd: number]
  render: []
}

class Renderer extends EventEmitter<RendererEvents> {
  private static MAX_CANVAS_WIDTH = 4000
  private options: Partial<RendererStyleOptions> & { height: number } = {
    height: 0,
  }
  private container: HTMLElement
  private scrollContainer: HTMLElement
  private wrapper: HTMLElement
  private canvasWrapper: HTMLElement
  private progressWrapper: HTMLElement
  private cursor: HTMLElement
  private timeout: ReturnType<typeof setTimeout> | null = null
  private isScrolling = false
  private audioData: AudioBuffer | null = null
  private resizeObserver: ResizeObserver | null = null
  private isDragging = false

  constructor(container: HTMLElement | string | null, options: RendererStyleOptions) {
    super()

    this.options = { ...options }

    if (typeof container === 'string') {
      container = document.querySelector(container) as HTMLElement | null
    }
    if (!container) {
      throw new Error('Container not found')
    }

    const [div, shadow] = this.initHtml()
    container.appendChild(div)
    this.container = div
    this.scrollContainer = shadow.querySelector('.scroll') as HTMLElement
    this.wrapper = shadow.querySelector('.wrapper') as HTMLElement
    this.canvasWrapper = shadow.querySelector('.canvases') as HTMLElement
    this.progressWrapper = shadow.querySelector('.progress') as HTMLElement
    this.cursor = shadow.querySelector('.cursor') as HTMLElement

    this.initEvents()
  }

  private initEvents() {
    // Add a click listener
    this.wrapper.addEventListener('click', (e) => {
      const rect = this.wrapper.getBoundingClientRect()
      const x = e.clientX - rect.left
      const relativeX = x / rect.width
      this.emit('click', relativeX)
    })

    // Drag
    this.initDrag()

    // Add a scroll listener
    this.scrollContainer.addEventListener('scroll', () => {
      const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer
      const startX = scrollLeft / scrollWidth
      const endX = (scrollLeft + clientWidth) / scrollWidth
      this.emit('scroll', startX, endX)
    })

    // Re-render the waveform on container resize
    this.resizeObserver = new ResizeObserver(() => {
      this.delay(() => this.reRender(), 100)
    })
    this.resizeObserver.observe(this.scrollContainer)
  }

  private initDrag() {
    this.wrapper.addEventListener('mousedown', (e) => {
      const minDx = 5
      const x = e.clientX

      const move = (e: MouseEvent) => {
        const diff = Math.abs(e.clientX - x)
        if (diff >= minDx) {
          this.isDragging = true
          const rect = this.wrapper.getBoundingClientRect()
          this.emit('drag', Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
        }
      }

      const up = () => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
        this.isDragging = false
      }

      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    })
  }

  private initHtml(): [HTMLElement, ShadowRoot] {
    const div = document.createElement('div')
    const shadow = div.attachShadow({ mode: 'open' })

    shadow.innerHTML = `
      <style>
        :host {
          user-select: none;
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
          position: relative;
          height: ${this.options.height}px;
        }
        :host canvas {
          display: block;
          position: absolute;
          top: 0;
          image-rendering: pixelated;
          height: ${this.options.height}px;
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
        :host .cursor {
          pointer-events: none;
          position: absolute;
          z-index: 5;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 2px;
          width: ${this.options.cursorWidth}px;
          background-color: ${this.options.cursorColor || this.options.progressColor};
        }
      </style>

      <div class="scroll" part="scroll">
        <div class="wrapper">
          <div class="canvases"></div>
          <div class="progress"></div>
          <div class="cursor" part="cursor"></div>
        </div>
      </div>
    `

    return [div, shadow]
  }

  setOptions(options: RendererStyleOptions) {
    this.options = options
    // Re-render the waveform
    this.reRender()
  }

  getWrapper(): HTMLElement {
    return this.wrapper
  }

  getScroll(): number {
    return this.scrollContainer.scrollLeft
  }

  destroy() {
    this.container.remove()
    this.resizeObserver?.disconnect()
  }

  private delay(fn: () => void, delayMs = 10): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    return new Promise((resolve) => {
      this.timeout = setTimeout(() => {
        resolve(fn())
      }, delayMs)
    })
  }

  // Convert array of color values to linear gradient
	private convertColorValues(color: string | string[] = "") {
		if (!Array.isArray(color)) return color;
    if (color.length < 2) return color.length === 1 ? color[0] : "";
    
    const canvasElement = this.canvasWrapper.children[0] as HTMLCanvasElement;
		const gradient = canvasElement.getContext('2d')?.createLinearGradient(0, 0, 0, canvasElement.height) || "";

		if (gradient) {
			const colorStopPercentage = 1 / (color.length - 1);
			color.forEach((color, index) => {
				const offset = index * colorStopPercentage;
				gradient.addColorStop(offset, color);
			});
		}

		return gradient;
	}

  private async renderPeaks(audioData: AudioBuffer, width: number, height: number, pixelRatio: number) {
    const barWidth =
      this.options.barWidth != null && !isNaN(this.options.barWidth) ? this.options.barWidth * pixelRatio : 1
    const barGap =
      this.options.barGap != null && !isNaN(this.options.barGap)
        ? this.options.barGap * pixelRatio
        : this.options.barWidth
        ? barWidth / 2
        : 0
    const barRadius = this.options.barRadius || 0
    const scaleY = this.options.barHeight || 1

    const leftChannel = audioData.getChannelData(0)
    const len = leftChannel.length
    const barCount = Math.floor(width / (barWidth + barGap))
    const barIndexScale = barCount / len
    const halfHeight = height / 2
    const isMono = audioData.numberOfChannels === 1
    const rightChannel = isMono ? leftChannel : audioData.getChannelData(1)
    const useNegative = isMono && rightChannel.some((v: number) => v < 0)

    const draw = (start: number, end: number) => {
      let prevX = 0
      let prevLeft = 0
      let prevRight = 0

      const canvas = document.createElement('canvas')
      canvas.width = Math.round((width * (end - start)) / len)
      canvas.height = this.options.height
      canvas.style.width = `${Math.floor(canvas.width / pixelRatio)}px`
      canvas.style.height = `${this.options.height}px`
      canvas.style.left = `${Math.floor((start * width) / pixelRatio / len)}px`
      this.canvasWrapper.appendChild(canvas)

      const ctx = canvas.getContext('2d', {
        desynchronized: true,
      }) as CanvasRenderingContext2D

      ctx.beginPath()
      ctx.fillStyle = this.convertColorValues(this.options.waveColor)

      // Firefox shim until 2023.04.11
      if (!ctx.roundRect) ctx.roundRect = ctx.fillRect

      for (let i = start; i < end; i++) {
        const barIndex = Math.round((i - start) * barIndexScale)

        if (barIndex > prevX) {
          const leftBarHeight = Math.round(prevLeft * halfHeight * scaleY)
          const rightBarHeight = Math.round(prevRight * halfHeight * scaleY)

          ctx.roundRect(
            prevX * (barWidth + barGap),
            halfHeight - leftBarHeight,
            barWidth,
            leftBarHeight + (rightBarHeight || 1),
            barRadius,
          )

          prevX = barIndex
          prevLeft = 0
          prevRight = 0
        }

        const leftValue = useNegative ? leftChannel[i] : Math.abs(leftChannel[i])
        const rightValue = useNegative ? rightChannel[i] : Math.abs(rightChannel[i])

        if (leftValue > prevLeft) {
          prevLeft = leftValue
        }
        // If stereo, both channels are drawn as max values
        // If mono with negative values, the bottom channel will be the min negative values
        if (useNegative ? rightValue < -prevRight : rightValue > prevRight) {
          prevRight = rightValue < 0 ? -rightValue : rightValue
        }
      }

      ctx.fill()
      ctx.closePath()

      // Draw a progress canvas
      const progressCanvas = canvas.cloneNode() as HTMLCanvasElement
      this.progressWrapper.appendChild(progressCanvas)
      const progressCtx = progressCanvas.getContext('2d', {
        desynchronized: true,
      }) as CanvasRenderingContext2D
      if (canvas.width > 0 && canvas.height > 0) {
        progressCtx.drawImage(canvas, 0, 0)
      }
      // Set the composition method to draw only where the waveform is drawn
      progressCtx.globalCompositeOperation = 'source-in'
      progressCtx.fillStyle = this.options.progressColor ?? ''
      // This rectangle acts as a mask thanks to the composition method
      progressCtx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Clear the canvas
    this.canvasWrapper.innerHTML = ''
    this.progressWrapper.innerHTML = ''

    // Determine the currently visible part of the waveform
    const { scrollLeft, scrollWidth, clientWidth } = this.scrollContainer
    const scale = len / scrollWidth
    let viewportWidth = Math.min(Renderer.MAX_CANVAS_WIDTH, clientWidth)
    viewportWidth -= viewportWidth % ((barWidth + barGap) / pixelRatio)
    const start = Math.floor(Math.abs(scrollLeft) * scale)
    const end = Math.ceil(start + viewportWidth * scale)

    // Draw the visible portion of the waveform
    draw(start, end)

    // Draw the rest of the waveform with a timeout for better performance
    const step = end - start
    for (let i = end; i < len; i += step) {
      await this.delay(() => {
        draw(i, Math.min(len, i + step))
      })
    }
    for (let i = start - 1; i >= 0; i -= step) {
      await this.delay(() => {
        draw(Math.max(0, i - step), i)
      })
    }
  }

  render(audioData: AudioBuffer) {
    // Determine the width of the waveform
    const pixelRatio = window.devicePixelRatio || 1
    const parentWidth = this.scrollContainer.clientWidth
    const scrollWidth = Math.ceil(audioData.duration * (this.options.minPxPerSec || 0))

    // Whether the container should scroll
    this.isScrolling = scrollWidth > parentWidth
    const useParentWidth = this.options.fillParent && !this.isScrolling

    // Width and height of the waveform in pixels
    const width = (useParentWidth ? parentWidth : scrollWidth) * pixelRatio
    const { height } = this.options

    // Set the width of the wrapper
    this.wrapper.style.width = useParentWidth ? '100%' : `${scrollWidth}px`

    // Set additional styles
    this.scrollContainer.style.overflowX = this.isScrolling ? 'auto' : 'hidden'
    this.scrollContainer.classList.toggle('noScrollbar', !!this.options.hideScrollbar)
    this.cursor.style.backgroundColor = `${this.options.cursorColor || this.options.progressColor}`
    this.cursor.style.width = `${this.options.cursorWidth}px`
    this.canvasWrapper.style.height = `${this.options.height}px`

    // Render the waveform
    this.renderPeaks(audioData, width, height, pixelRatio)
    this.audioData = audioData

    this.emit('render')
  }

  reRender() {
    // Return if the waveform has not been rendered yet
    if (!this.audioData) return

    // Remember the current cursor position
    const oldCursorPosition = this.progressWrapper.clientWidth

    // Set the new zoom level and re-render the waveform
    this.render(this.audioData)

    // Adjust the scroll position so that the cursor stays in the same place
    const newCursortPosition = this.progressWrapper.clientWidth
    this.scrollContainer.scrollLeft += newCursortPosition - oldCursorPosition
  }

  zoom(minPxPerSec: number) {
    this.options.minPxPerSec = minPxPerSec
    this.reRender()
  }

  private scrollIntoView(progress: number, isPlaying = false) {
    const { clientWidth, scrollLeft, scrollWidth } = this.scrollContainer
    const progressWidth = scrollWidth * progress
    const center = clientWidth / 2
    const minScroll = isPlaying && this.options.autoCenter && !this.isDragging ? center : clientWidth

    if (progressWidth > scrollLeft + minScroll || progressWidth < scrollLeft) {
      // Scroll to the center
      if (this.options.autoCenter && !this.isDragging) {
        // If the cursor is in viewport but not centered, scroll to the center slowly
        const minDiff = center / 20
        if (progressWidth - (scrollLeft + center) >= minDiff && progressWidth < scrollLeft + clientWidth) {
          this.scrollContainer.scrollLeft += minDiff
        } else {
          // Otherwise, scroll to the center immediately
          this.scrollContainer.scrollLeft = progressWidth - center
        }
      } else if (this.isDragging) {
        // Scroll just a little bit to allow for some space between the cursor and the edge
        const gap = 10
        this.scrollContainer.scrollLeft =
          progressWidth < scrollLeft ? progressWidth - gap : progressWidth - clientWidth + gap
      } else {
        // Scroll to the beginning
        this.scrollContainer.scrollLeft = progressWidth
      }
    }

    // Emit the scroll event
    {
      const { scrollLeft } = this.scrollContainer
      const startX = scrollLeft / scrollWidth
      const endX = (scrollLeft + clientWidth) / scrollWidth
      this.emit('scroll', startX, endX)
    }
  }

  renderProgress(progress: number, isPlaying?: boolean) {
    if (isNaN(progress)) return
    this.progressWrapper.style.width = `${progress * 100}%`
    this.cursor.style.left = `${progress * 100}%`
    this.cursor.style.marginLeft = Math.round(progress * 100) === 100 ? `-${this.options.cursorWidth}px` : ''

    if (this.isScrolling && this.options.autoScroll) {
      this.scrollIntoView(progress, isPlaying)
    }
  }
}

export default Renderer
