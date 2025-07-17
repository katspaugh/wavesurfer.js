/**
 * Spectrogram plugin
 *
 * Render a spectrogram visualisation of the audio.
 *
 * @author Pavel Denisov (https://github.com/akreal)
 * @see https://github.com/wavesurfer-js/wavesurfer.js/pull/337
 *
 * @example
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     SpectrogramPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */

// @ts-nocheck

// Import centralized FFT functionality
import FFT, { 
  hzToScale,
  scaleToHz,
  createFilterBankForScale,
  applyFilterBank,
  setupColorMap, 
  freqType, 
  unitType, 
  getLabelFrequency, 
  createWrapperClickHandler
} from '../fft.js'

/**
 * Spectrogram plugin for wavesurfer.
 */
import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import createElement from '../dom.js'

// Import the worker using rollup-plugin-web-worker-loader
import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'

export type SpectrogramPluginOptions = {
  /** Selector of element or element in which to render */
  container?: string | HTMLElement
  /** Number of samples to fetch to FFT. Must be a power of 2. */
  fftSamples?: number
  /** Height of the spectrogram view in CSS pixels */
  height?: number
  /** Set to true to display frequency labels. */
  labels?: boolean
  labelsBackground?: string
  labelsColor?: string
  labelsHzColor?: string
  /** Size of the overlapping window. Must be < fftSamples. Auto deduced from canvas size by default. */
  noverlap?: number
  /** The window function to be used. */
  windowFunc?:
    | 'bartlett'
    | 'bartlettHann'
    | 'blackman'
    | 'cosine'
    | 'gauss'
    | 'hamming'
    | 'hann'
    | 'lanczoz'
    | 'rectangular'
    | 'triangular'
  /** Some window functions have this extra value. (Between 0 and 1) */
  alpha?: number
  /** Min frequency to scale spectrogram. */
  frequencyMin?: number
  /** Max frequency to scale spectrogram. Set this to samplerate/2 to draw whole range of spectrogram. */
  frequencyMax?: number
  /** Sample rate of the audio when using pre-computed spectrogram data. Required when using frequenciesDataUrl. */
  sampleRate?: number
  /**
   * Based on: https://manual.audacityteam.org/man/spectrogram_settings.html
   * - Linear: Linear The linear vertical scale goes linearly from 0 kHz to 20 kHz frequency by default.
   * - Logarithmic: This view is the same as the linear view except that the vertical scale is logarithmic.
   * - Mel: The name Mel comes from the word melody to indicate that the scale is based on pitch comparisons. This is the default scale.
   * - Bark: This is a psychoacoustical scale based on subjective measurements of loudness. It is related to, but somewhat less popular than, the Mel scale.
   * - ERB: The Equivalent Rectangular Bandwidth scale or ERB is a measure used in psychoacoustics, which gives an approximation to the bandwidths of the filters in human hearing
   */
  scale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  /**
   * Increases / decreases the brightness of the display.
   * For small signals where the display is mostly "blue" (dark) you can increase this value to see brighter colors and give more detail.
   * If the display has too much "white", decrease this value.
   * The default is 20dB and corresponds to a -20 dB signal at a particular frequency being displayed as "white". */
  gainDB?: number
  /**
   * Affects the range of signal sizes that will be displayed as colors.
   * The default is 80 dB and means that you will not see anything for signals 80 dB below the value set for "Gain".
   */
  rangeDB?: number
  /**
   * A 256 long array of 4-element arrays. Each entry should contain a float between 0 and 1 and specify r, g, b, and alpha.
   * Each entry should contain a float between 0 and 1 and specify r, g, b, and alpha.
   * - gray: Gray scale.
   * - igray: Inverted gray scale.
   * - roseus: From https://github.com/dofuuz/roseus/blob/main/roseus/cmap/roseus.py
   */
  colorMap?: number[][] | 'gray' | 'igray' | 'roseus'
  /** Render a spectrogram for each channel independently when true. */
  splitChannels?: boolean
  /** URL with pre-computed spectrogram JSON data, the data must be a Uint8Array[][] **/
  frequenciesDataUrl?: string
  /** Maximum width of individual canvas elements in pixels (default: 30000) */
  maxCanvasWidth?: number
   /** Use web worker for FFT calculations (default: false) */
   useWebWorker?: boolean
}

export type SpectrogramPluginEvents = BasePluginEvents & {
  ready: []
  click: [relativeX: number]
}

class SpectrogramPlugin extends BasePlugin<SpectrogramPluginEvents, SpectrogramPluginOptions> {
  private static MAX_CANVAS_WIDTH = 30000
  private static MAX_NODES = 10
  
  private frequenciesDataUrl?: string
  private container: HTMLElement
  private wrapper: HTMLElement
  private labelsEl: HTMLCanvasElement
  private canvases: HTMLCanvasElement[] = []
  private canvasContainer: HTMLElement
  private colorMap: number[][]
  private fftSamples: SpectrogramPluginOptions['fftSamples']
  private height: SpectrogramPluginOptions['height']
  private noverlap: SpectrogramPluginOptions['noverlap']
  private windowFunc: SpectrogramPluginOptions['windowFunc']
  private alpha: SpectrogramPluginOptions['alpha']
  private frequencyMin: SpectrogramPluginOptions['frequencyMin']
  private frequencyMax: SpectrogramPluginOptions['frequencyMax']
  private gainDB: SpectrogramPluginOptions['gainDB']
  private rangeDB: SpectrogramPluginOptions['rangeDB']
  private scale: SpectrogramPluginOptions['scale']
  private numMelFilters: number
  private numLogFilters: number
  private numBarkFilters: number
  private numErbFilters: number

  // Web worker support
  private useWebWorker: boolean = false
  private worker: Worker | null = null
  private workerPromises: Map<string, { resolve: Function; reject: Function }> = new Map()
  
  // Performance optimization properties
  private cachedFrequencies: Uint8Array[][] | null = null
  private cachedResampledData: Uint8Array[][] | null = null
  private cachedBuffer: AudioBuffer | null = null
  private cachedWidth = 0
  private renderTimeout: number | null = null
  private isRendering = false
  private lastZoomLevel = 0
  private renderThrottleMs = 50 // Reduced frequency for better performance
  private zoomThreshold = 0.05 // More sensitive zoom detection
  private drawnCanvases: Record<number, boolean> = {}
  private pendingBitmaps = new Set<Promise<ImageBitmap>>()
  private isScrollable = false
  private scrollUnsubscribe: (() => void) | null = null
  private _onWrapperClick: (e: MouseEvent) => void

  static create(options?: SpectrogramPluginOptions) {
    return new SpectrogramPlugin(options || {})
  }

  constructor(options: SpectrogramPluginOptions) {
    super(options)

    this.frequenciesDataUrl = options.frequenciesDataUrl

    // Validate that sampleRate is provided when using frequenciesDataUrl
    if (this.frequenciesDataUrl && !options.sampleRate) {
      throw new Error('sampleRate option is required when using frequenciesDataUrl')
    }

    this.container =
      'string' == typeof options.container ? document.querySelector(options.container) : options.container

    // Web worker option (disabled by default)
    this.useWebWorker = options.useWebWorker === true

    // Set up color map using shared utility
    this.colorMap = setupColorMap(options.colorMap)

    this.fftSamples = options.fftSamples || 512
    this.height = options.height || 200
    this.noverlap = options.noverlap || null // Will be calculated later based on canvas size
    this.windowFunc = options.windowFunc || 'hann'
    this.alpha = options.alpha

    // Getting file's original samplerate is difficult(#1248).
    // So set 12kHz default to render like wavesurfer.js 5.x.
    this.frequencyMin = options.frequencyMin || 0
    this.frequencyMax = options.frequencyMax || 0

    this.gainDB = options.gainDB ?? 20
    this.rangeDB = options.rangeDB ?? 80
    this.scale = options.scale || 'mel'

    // Other values will currently cause a misalignment between labels and the spectrogram
    this.numMelFilters = this.fftSamples / 2
    this.numLogFilters = this.fftSamples / 2
    this.numBarkFilters = this.fftSamples / 2
    this.numErbFilters = this.fftSamples / 2

    // Override the default max canvas width if provided
    if (options.maxCanvasWidth) {
      SpectrogramPlugin.MAX_CANVAS_WIDTH = options.maxCanvasWidth
    }

    // Set default performance settings
    this.renderThrottleMs = 50
    this.zoomThreshold = 0.05

    this.createWrapper()
    this.createCanvas()

    // Initialize worker if enabled
    if (this.useWebWorker) {
      this.initializeWorker()
    }
  }

  private initializeWorker() {
    // Skip worker initialization in SSR environments (Next.js server-side)
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      console.warn('Worker not available in this environment, using main thread calculation')
      return
    }

    try {
      // Create worker using imported worker constructor
      this.worker = new SpectrogramWorker()

      this.worker.onmessage = (e) => {
        const { type, id, result, error } = e.data

        if (type === 'frequenciesResult') {
          const promise = this.workerPromises.get(id)
          if (promise) {
            this.workerPromises.delete(id)
            if (error) {
              promise.reject(new Error(error))
            } else {
              promise.resolve(result)
            }
          }
        }
      }

      this.worker.onerror = (error) => {
        console.warn('Spectrogram worker error, falling back to main thread:', error)
        // Fallback to main thread calculation
        this.worker = null
      }
    } catch (error) {
      console.warn('Failed to initialize worker, falling back to main thread:', error)
      this.worker = null
    }
  }

  onInit() {
    // Recreate DOM elements if they were destroyed
    if (!this.wrapper) {
      this.createWrapper()
    }
    if (!this.canvasContainer) {
      this.createCanvas()
    }

    // Always get fresh container reference to avoid stale references
    this.container = this.wavesurfer.getWrapper()
    this.container.appendChild(this.wrapper)

    if (this.wavesurfer.options.fillParent) {
      Object.assign(this.wrapper.style, {
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'hidden',
      })
    }
    this.subscriptions.push(this.wavesurfer.on('redraw', () => this.throttledRender()))
  
    // Trigger initial render after re-initialization
    // This ensures the spectrogram appears even if no redraw event is fired
    if (this.wavesurfer.getDecodedData()) {
      // Use setTimeout to ensure DOM is fully ready
      setTimeout(() => {
        this.throttledRender()
      }, 0)
    }
  }

  public destroy() {
    this.unAll()
    
    // Clean up any direct event listeners (if they exist)
    if (this.wavesurfer) {
      // Note: _onReady and _onRender methods may not exist, but the original code had these
      // We should be cautious and only call un if the methods exist
      if (typeof this._onReady === 'function') {
        this.wavesurfer.un('ready', this._onReady)
      }
      if (typeof this._onRender === 'function') {
        this.wavesurfer.un('redraw', this._onRender)
      }
    }
    
    // Clean up performance optimization resources
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
      this.renderTimeout = null
    }
    
    // Clean up scroll listener
    if (this.scrollUnsubscribe) {
      this.scrollUnsubscribe()
      this.scrollUnsubscribe = null
    }
    
    // Cancel pending bitmap operations
    this.pendingBitmaps.clear()

    // Clean up worker
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    
    this.cachedFrequencies = null
    this.cachedResampledData = null
    this.cachedBuffer = null
    
    // Clean up DOM elements properly
    this.clearCanvases()
    if (this.canvasContainer) {
      this.canvasContainer.remove()
      this.canvasContainer = null
    }
    if (this.wrapper) {
      this.wrapper.remove()
      this.wrapper = null
    }
    if (this.labelsEl) {
      // Properly remove labels canvas from DOM before nullifying reference
      this.labelsEl.remove()
      this.labelsEl = null
    }
    
    // Reset state for potential re-initialization
    this.container = null
    this.isRendering = false
    this.lastZoomLevel = 0
    this.wavesurfer = null
    this.util = null
    this.options = null
    
    super.destroy()
  }

  public async loadFrequenciesData(url: string | URL) {
    const resp = await fetch(url)
    if (!resp.ok) {
      throw new Error('Unable to fetch frequencies data')
    }
    const data = await resp.json()
    this.drawSpectrogram(data)
  }

  public async getFrequenciesData(): Uint8Array[][] | null {
    const decodedData = this.wavesurfer?.getDecodedData();
    if (!decodedData) {
      return null;
    }

    if (this.cachedBuffer === decodedData && this.cachedFrequencies) {
      // Check if we can use cached frequencies
      return this.cachedFrequencies;
    } else {
      // Calculate new frequencies and cache them
      const frequencies = await this.getFrequencies(decodedData)
      this.cachedFrequencies = frequencies
      this.cachedBuffer = decodedData
      return frequencies;
    }
  }

  /** Clear cached frequency data to force recalculation */
  public clearCache() {
    this.cachedFrequencies = null
    this.cachedResampledData = null
    this.cachedBuffer = null
    this.cachedWidth = 0
    this.lastZoomLevel = 0
  }

  private createWrapper() {
    this.wrapper = createElement('div', {
      style: {
        display: 'block',
        position: 'relative',
        userSelect: 'none',
      },
    })

    // if labels are active
    if (this.options.labels) {
      this.labelsEl = createElement(
        'canvas',
        {
          part: 'spec-labels',
          style: {
            position: 'absolute',
            zIndex: 9,
            width: '55px',
            height: '100%',
          },
        },
        this.wrapper,
      )
    }

    // Create wrapper click handler using shared utility
    this._onWrapperClick = createWrapperClickHandler(this.wrapper, this.emit.bind(this))
    this.wrapper.addEventListener('click', this._onWrapperClick)
  }

  private createCanvas() {
    this.canvasContainer = createElement(
      'div',
      {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          zIndex: 4,
        },
      },
      this.wrapper,
    )
  }

  private createSingleCanvas(width: number, height: number, offset: number): HTMLCanvasElement {
    const canvas = createElement('canvas', {
      style: {
        position: 'absolute',
        left: `${Math.round(offset)}px`,
        top: '0',
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 4,
      },
    })
    
    canvas.width = Math.round(width)
    canvas.height = Math.round(height)
    
    this.canvasContainer.appendChild(canvas)
    return canvas
  }

  private clearCanvases() {
    this.canvases.forEach(canvas => canvas.remove())
    this.canvases = []
    this.drawnCanvases = {}
  }

  private clearExcessCanvases() {
    // Clear canvases to avoid too many DOM nodes
    if (Object.keys(this.drawnCanvases).length > SpectrogramPlugin.MAX_NODES) {
      this.clearCanvases()
    }
  }

  private throttledRender() {
    // Clear any pending render
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
    }
    
    // Skip if already rendering
    if (this.isRendering) {
      return
    }
    
    // Check if zoom level changed significantly
    const currentZoom = this.wavesurfer?.options.minPxPerSec || 0
    const zoomDiff = Math.abs(currentZoom - this.lastZoomLevel) / Math.max(currentZoom, this.lastZoomLevel, 1)
    
    if (zoomDiff < this.zoomThreshold && this.cachedFrequencies) {
      // Small zoom change - just re-render with cached data
      this.renderTimeout = window.setTimeout(() => {
        this.fastRender()
      }, this.renderThrottleMs)
    } else {
      // Significant zoom change - full re-render
      this.renderTimeout = window.setTimeout(() => {
        this.render()
      }, this.renderThrottleMs)
    }
  }

  private async render() {
    if (this.isRendering) return
    this.isRendering = true
    
    try {
      if (this.frequenciesDataUrl) {
        await this.loadFrequenciesData(this.frequenciesDataUrl)
      } else {
        const decodedData = this.wavesurfer?.getDecodedData()
        if (decodedData) {
          const frequencies = await this.getFrequenciesData();
          this.drawSpectrogram(this.cachedFrequencies);
        }
      }
      this.lastZoomLevel = this.wavesurfer?.options.minPxPerSec || 0
    } finally {
      this.isRendering = false
    }
  }
  
  private fastRender() {
    if (this.isRendering || !this.cachedFrequencies) return
    this.isRendering = true
    
    try {
      // Use cached frequencies for fast re-render
      this.drawSpectrogram(this.cachedFrequencies)
      this.lastZoomLevel = this.wavesurfer?.options.minPxPerSec || 0
    } finally {
      this.isRendering = false
    }
  }

    private drawSpectrogram(frequenciesData: Uint8Array[][]): void {
    if (!isNaN(frequenciesData[0][0])) {
      // data is 1ch [sample, freq] format
      // to [channel, sample, freq] format
      frequenciesData = [frequenciesData]
    }

    // Clear existing canvases
    this.clearCanvases()

    // Set the height to fit all channels
    const totalHeight = this.height * frequenciesData.length
    this.wrapper.style.height = totalHeight + 'px'

    const totalWidth = this.getWidth()
    const maxCanvasWidth = Math.min(SpectrogramPlugin.MAX_CANVAS_WIDTH, totalWidth)
    
    // Nothing to render
    if (totalWidth === 0 || totalHeight === 0) return

    // Calculate number of canvases needed
    const numCanvases = Math.ceil(totalWidth / maxCanvasWidth)

    // Smart resampling based on zoom level
    let resampledData: Uint8Array[][]
    const originalDataWidth = frequenciesData[0]?.length || 0
    const needsResampling = totalWidth !== originalDataWidth
    
    if (!needsResampling) {
      // At high zoom levels, use original data directly - much faster!
      resampledData = frequenciesData
    } else if (this.cachedResampledData && this.cachedWidth === totalWidth) {
      // Use cached resampled data
      resampledData = this.cachedResampledData
    } else {
      // Only resample when actually needed
      resampledData = this.efficientResample(frequenciesData, totalWidth)
      this.cachedResampledData = resampledData
      this.cachedWidth = totalWidth
    }

    // Maximum frequency represented in `frequenciesData`
    // Use buffer.sampleRate if available (from getFrequencies), otherwise use the provided sampleRate
    const freqFrom = this.buffer?.sampleRate ? this.buffer.sampleRate / 2 : (this.options.sampleRate || 0) / 2

    // Minimum and maximum frequency we want to draw
    const freqMin = this.frequencyMin
    const freqMax = this.frequencyMax

    // Draw background if needed
    const shouldDrawBackground = freqMax > freqFrom
    const bgColor = shouldDrawBackground ? this.colorMap[this.colorMap.length - 1] : null

    // Function to draw a single canvas
    const drawCanvas = (canvasIndex: number) => {
      if (canvasIndex < 0 || canvasIndex >= numCanvases) return
      if (this.drawnCanvases[canvasIndex]) return
      
      this.drawnCanvases[canvasIndex] = true

      const offset = canvasIndex * maxCanvasWidth
      const canvasWidth = Math.min(maxCanvasWidth, totalWidth - offset)

      if (canvasWidth <= 0) return

      const canvas = this.createSingleCanvas(canvasWidth, totalHeight, offset)
      this.canvases.push(canvas)
      const ctx = canvas.getContext('2d')

      if (!ctx) return

      // Draw background if needed
      if (shouldDrawBackground && bgColor) {
        ctx.fillStyle = `rgba(${bgColor[0] * 255}, ${bgColor[1] * 255}, ${bgColor[2] * 255}, ${bgColor[3]})`
        ctx.fillRect(0, 0, canvasWidth, totalHeight)
      }

      // Render each channel for this canvas segment  
      for (let c = 0; c < resampledData.length; c++) {
        this.drawSpectrogramSegment(
          resampledData[c],
          ctx,
          canvasWidth,
          this.height,
          c * this.height,
          offset,
          totalWidth,
          freqFrom,
          freqMin,
          freqMax,
        )
      }
    }

    // Store rendering parameters for lazy loading
    this.isScrollable = totalWidth > this.getWrapperWidth()

    // Clear previous scroll listener
    if (this.scrollUnsubscribe) {
      this.scrollUnsubscribe()
      this.scrollUnsubscribe = null
    }

    if (!this.isScrollable || numCanvases <= 3) {
      // Draw all canvases if not scrollable or few canvases
      for (let i = 0; i < numCanvases; i++) {
        drawCanvas(i)
      }
    } else {
      // Implement lazy rendering with scroll listener
      const renderVisibleCanvases = () => {
        const wrapper = this.wavesurfer?.getWrapper()
        if (!wrapper) return

        const scrollLeft = wrapper.scrollLeft || 0
        const containerWidth = wrapper.clientWidth || 0
        
        // Calculate visible range with some buffer
        const bufferRatio = 0.5 // Render 50% extra on each side
        const visibleStart = Math.max(0, scrollLeft - containerWidth * bufferRatio)
        const visibleEnd = Math.min(totalWidth, scrollLeft + containerWidth * (1 + bufferRatio))
        
        const startCanvasIndex = Math.floor((visibleStart / totalWidth) * numCanvases)
        const endCanvasIndex = Math.min(Math.ceil((visibleEnd / totalWidth) * numCanvases), numCanvases - 1)

        // Clear excess canvases if we have too many
        if (Object.keys(this.drawnCanvases).length > SpectrogramPlugin.MAX_NODES) {
          this.clearExcessCanvases()
        }

        // Draw visible canvases
        for (let i = startCanvasIndex; i <= endCanvasIndex; i++) {
          drawCanvas(i)
        }
      }

      // Initial render of visible canvases
      renderVisibleCanvases()

      // Set up scroll listener for lazy loading
      let scrollTimeout: number | null = null
      const onScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout)
        scrollTimeout = window.setTimeout(renderVisibleCanvases, 16) // 60fps
      }

      const wrapper = this.wavesurfer?.getWrapper()
      if (wrapper) {
        wrapper.addEventListener('scroll', onScroll, { passive: true })
        this.scrollUnsubscribe = () => {
          wrapper.removeEventListener('scroll', onScroll)
          if (scrollTimeout) clearTimeout(scrollTimeout)
        }
      }
    }

    if (this.options.labels) {
      this.loadLabels(
        this.options.labelsBackground,
        '12px',
        '12px',
        '',
        this.options.labelsColor,
        this.options.labelsHzColor || this.options.labelsColor,
        'center',
        '#specLabels',
        frequenciesData.length,
      )
    }

    this.emit('ready')
  }

    private drawSpectrogramSegment(
    resampledPixels: Uint8Array[],
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    height: number,
    yOffset: number,
    xOffset: number,
    totalWidth: number,
    freqFrom: number,
    freqMin: number,
    freqMax: number,
  ): void {
    // Data is already resampled for the total width
    const bitmapHeight = resampledPixels[0].length

    // Calculate which portion of the resampled data corresponds to this canvas
    const startIndex = Math.floor((xOffset / totalWidth) * resampledPixels.length)
    const endIndex = Math.min(Math.ceil(((xOffset + canvasWidth) / totalWidth) * resampledPixels.length), resampledPixels.length)
    const segmentPixels = resampledPixels.slice(startIndex, endIndex)

    if (segmentPixels.length === 0) return

    // Create ImageData for this segment
    const segmentWidth = segmentPixels.length
    const imageData = new ImageData(segmentWidth, bitmapHeight)
    const data = imageData.data

    // Always use quality rendering - users want accurate spectrograms
    this.fillImageDataQuality(data, segmentPixels, segmentWidth, bitmapHeight)

    // Calculate frequency scaling
    const rMin = hzToScale(freqMin, this.scale) / hzToScale(freqFrom, this.scale)
    const rMax = hzToScale(freqMax, this.scale) / hzToScale(freqFrom, this.scale)
    const rMax1 = Math.min(1, rMax)

    // Create and draw the bitmap - manage async properly
    const bitmapPromise = createImageBitmap(
      imageData,
      0,
      Math.round(bitmapHeight * (1 - rMax1)),
      segmentWidth,
      Math.round(bitmapHeight * (rMax1 - rMin)),
    )

    // Track pending bitmap for cleanup
    this.pendingBitmaps.add(bitmapPromise)
    
    bitmapPromise.then((bitmap) => {
      // Remove from pending set
      this.pendingBitmaps.delete(bitmapPromise)
      
      // Check if canvas is still valid before drawing
      if (ctx.canvas.parentNode) {
        const drawHeight = (height * rMax1) / rMax
        const drawY = yOffset + height * (1 - rMax1 / rMax)
        
        ctx.drawImage(bitmap, 0, drawY, canvasWidth, drawHeight)
        
        // Clean up bitmap to free memory
        if ('close' in bitmap) {
          bitmap.close()
        }
      }
    }).catch((error) => {
      // Clean up on error
      this.pendingBitmaps.delete(bitmapPromise)
    })
  }



  private getWidth() {
    return this.wavesurfer.getWrapper().offsetWidth
  }

  private getWrapperWidth() {
    return this.wavesurfer?.getWrapper()?.clientWidth || 0
  }

  private async calculateFrequenciesWithWorker(buffer: AudioBuffer): Promise<Uint8Array[][]> {
    if (!this.worker) {
      throw new Error('Worker not available')
    }

    const fftSamples = this.fftSamples
    const channels =
      (this.options.splitChannels ?? this.wavesurfer?.options.splitChannels) ? buffer.numberOfChannels : 1
    
    // Calculate noverlap
    let noverlap = this.noverlap
    if (!noverlap) {
      const totalWidth = this.getWidth()
      const uniqueSamplesPerPx = buffer.length / totalWidth
      noverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx))
    }

    // Prepare audio data for worker
    const audioData: Float32Array[] = []
    for (let c = 0; c < channels; c++) {
      audioData.push(buffer.getChannelData(c))
    }

    // Generate unique ID for this request
    const id = `${Date.now()}_${Math.random()}`

    // Create promise for worker response
    const promise = new Promise<Uint8Array[][]>((resolve, reject) => {
      this.workerPromises.set(id, { resolve, reject })

      // Set timeout to avoid hanging
      setTimeout(() => {
        if (this.workerPromises.has(id)) {
          this.workerPromises.delete(id)
          reject(new Error('Worker timeout'))
        }
      }, 30000) // 30 second timeout
    })

    // Send message to worker
    this.worker.postMessage({
      type: 'calculateFrequencies',
      id,
      audioData,
      options: {
        startTime: 0,
        endTime: buffer.duration,
        sampleRate: buffer.sampleRate,
        fftSamples: this.fftSamples,
        windowFunc: this.windowFunc,
        alpha: this.alpha,
        noverlap,
        scale: this.scale,
        gainDB: this.gainDB,
        rangeDB: this.rangeDB,
        splitChannels: this.options.splitChannels || false,
      },
    })

    return promise
  }

  private async getFrequencies(buffer: AudioBuffer): Promise<Uint8Array[][]> {
    this.frequencyMax = this.frequencyMax || buffer.sampleRate / 2
    this.buffer = buffer

    if (!buffer) return []

     // Use worker if enabled and available
     if (this.useWebWorker && this.worker) {
      try {
        return await this.calculateFrequenciesWithWorker(buffer)
      } catch (error) {
        console.warn('Worker calculation failed, falling back to main thread:', error)
        // Fall through to main thread calculation
      }
    }

    const fftSamples = this.fftSamples
    const channels =
      (this.options.splitChannels ?? this.wavesurfer?.options.splitChannels) ? buffer.numberOfChannels : 1

    // This may differ from file samplerate. Browser resamples audio.
    const sampleRate = buffer.sampleRate
    const frequencies: Uint8Array[][] = []

    // Calculate noverlap and hop size (same logic as worker for consistency)
    let noverlap = this.noverlap
    if (!noverlap) {
      const totalWidth = this.getWidth()
      const uniqueSamplesPerPx = buffer.length / totalWidth
      noverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx))
    }

    // Calculate hop size (same as worker for consistency)
    let actualNoverlap = noverlap || Math.max(0, Math.round(fftSamples * 0.5))
    const maxOverlap = fftSamples * 0.5
    actualNoverlap = Math.min(actualNoverlap, maxOverlap)
    const minHopSize = Math.max(64, fftSamples * 0.25)
    const hopSize = Math.max(minHopSize, fftSamples - actualNoverlap)

    // Create FFT instance (reuse if possible for performance)
    const fft = new FFT(fftSamples, sampleRate, this.windowFunc, this.alpha)

    // Create filter bank based on scale using centralized function
    const numFilters = this.fftSamples / 2
    const filterBank = createFilterBankForScale(this.scale, numFilters, this.fftSamples, sampleRate)

    for (let c = 0; c < channels; c++) {
      // for each channel
      const channelData = buffer.getChannelData(c)
      const channelFreq: Uint8Array[] = []

      // Use same hop size calculation as worker for consistency
      for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
        const segment = channelData.slice(sample, sample + fftSamples)
        let spectrum = fft.calculateSpectrum(segment)
        
        if (filterBank) {
          spectrum = applyFilterBank(spectrum, filterBank)
        }
        
        // Convert to uint8 color indices
        const freqBins = new Uint8Array(spectrum.length)
        const gainPlusRange = this.gainDB + this.rangeDB
        
        for (let j = 0; j < spectrum.length; j++) {
          const magnitude = spectrum[j] > 1e-12 ? spectrum[j] : 1e-12
          const valueDB = 20 * Math.log10(magnitude)
          
          if (valueDB < -gainPlusRange) {
            freqBins[j] = 0
          } else if (valueDB > -this.gainDB) {
            freqBins[j] = 255
          } else {
            freqBins[j] = Math.round(((valueDB + this.gainDB) / this.rangeDB) * 255)
          }
        }
        channelFreq.push(freqBins)
      }
      frequencies.push(channelFreq)
    }

    return frequencies
  }



  private loadLabels(
    bgFill,
    fontSizeFreq,
    fontSizeUnit,
    fontType,
    textColorFreq,
    textColorUnit,
    textAlign,
    container,
    channels,
  ) {
    const frequenciesHeight = this.height
    bgFill = bgFill || 'rgba(68,68,68,0)'
    fontSizeFreq = fontSizeFreq || '12px'
    fontSizeUnit = fontSizeUnit || '12px'
    fontType = fontType || 'Helvetica'
    textColorFreq = textColorFreq || '#fff'
    textColorUnit = textColorUnit || '#fff'
    textAlign = textAlign || 'center'
    container = container || '#specLabels'
    const bgWidth = 55
    const getMaxY = frequenciesHeight || 512
    const labelIndex = 5 * (getMaxY / 256)
    const freqStart = this.frequencyMin
    const step = (this.frequencyMax - freqStart) / labelIndex

    // prepare canvas element for labels
    const ctx = this.labelsEl.getContext('2d')
    const dispScale = window.devicePixelRatio
    this.labelsEl.height = this.height * channels * dispScale
    this.labelsEl.width = bgWidth * dispScale
    ctx.scale(dispScale, dispScale)

    if (!ctx) {
      return
    }

    for (let c = 0; c < channels; c++) {
      // for each channel
      // fill background
      ctx.fillStyle = bgFill
      ctx.fillRect(0, c * getMaxY, bgWidth, (1 + c) * getMaxY)
      ctx.fill()
      let i

      // render labels
      for (i = 0; i <= labelIndex; i++) {
        ctx.textAlign = textAlign
        ctx.textBaseline = 'middle'

        const freq = getLabelFrequency(i, labelIndex, this.frequencyMin, this.frequencyMax, this.scale)
        const label = freqType(freq)
        const units = unitType(freq)
        const x = 16
        let y = (1 + c) * getMaxY - (i / labelIndex) * getMaxY

        // Make sure label remains in view
        y = Math.min(Math.max(y, c * getMaxY + 10), (1 + c) * getMaxY - 10)

        // unit label
        ctx.fillStyle = textColorUnit
        ctx.font = fontSizeUnit + ' ' + fontType
        ctx.fillText(units, x + 24, y)
        // freq label
        ctx.fillStyle = textColorFreq
        ctx.font = fontSizeFreq + ' ' + fontType
        ctx.fillText(label, x, y)
      }
    }
  }

  private efficientResample(frequenciesData: Uint8Array[][], targetWidth: number): Uint8Array[][] {
    return frequenciesData.map(channelFreq => this.resampleChannel(channelFreq, targetWidth))
  }

  private resampleChannel(oldMatrix: Uint8Array[], targetWidth: number): Uint8Array[] {
    const oldColumns = oldMatrix.length
    const freqBins = oldMatrix[0]?.length || 0
    
    // Fast path for no resampling needed
    if (oldColumns === targetWidth || targetWidth === 0) {
      return oldMatrix
    }
    
    const ratio = oldColumns / targetWidth
    
    // Always use quality resampling for accurate spectrograms
    const newMatrix = new Array(targetWidth)
    
    if (ratio >= 1) {
      // Downsampling with proper averaging
      for (let i = 0; i < targetWidth; i++) {
        const start = Math.floor(i * ratio)
        const end = Math.min(Math.ceil((i + 1) * ratio), oldColumns)
        const count = end - start
        
        // Always create new column to avoid reference issues
        const column = new Uint8Array(freqBins)
        if (count === 1) {
          // Single source column - copy data
          column.set(oldMatrix[start])
        } else {
          // Average multiple source columns
          for (let k = 0; k < freqBins; k++) {
            let sum = 0
            for (let j = start; j < end; j++) {
              sum += oldMatrix[j][k]
            }
            column[k] = Math.round(sum / count)
          }
        }
        newMatrix[i] = column
      }
    } else {
      // Upsampling with linear interpolation for quality
      for (let i = 0; i < targetWidth; i++) {
        const srcIndex = i * ratio
        const leftIndex = Math.floor(srcIndex)
        const rightIndex = Math.min(leftIndex + 1, oldColumns - 1)
        const weight = srcIndex - leftIndex
        
        const column = new Uint8Array(freqBins)
        
        if (weight === 0 || leftIndex === rightIndex) {
          // Exact match or at boundary - use nearest neighbor
          column.set(oldMatrix[leftIndex])
        } else {
          // Linear interpolation for better quality
          const leftColumn = oldMatrix[leftIndex]
          const rightColumn = oldMatrix[rightIndex]
          const invWeight = 1 - weight
          for (let k = 0; k < freqBins; k++) {
            column[k] = Math.round(leftColumn[k] * invWeight + rightColumn[k] * weight)
          }
        }
        newMatrix[i] = column
      }
    }

    return newMatrix
  }

  private fillImageDataQuality(data: Uint8ClampedArray, segmentPixels: Uint8Array[], segmentWidth: number, bitmapHeight: number): void {
    // High quality rendering - process all pixels
    const colorMap = this.colorMap
    for (let i = 0; i < segmentWidth; i++) {
      const column = segmentPixels[i]
      for (let j = 0; j < bitmapHeight; j++) {
        const colorIndex = column[j]
        const color = colorMap[colorIndex]
        const pixelIndex = ((bitmapHeight - j - 1) * segmentWidth + i) * 4
        
        // Write RGBA values
        data[pixelIndex] = color[0] * 255
        data[pixelIndex + 1] = color[1] * 255
        data[pixelIndex + 2] = color[2] * 255
        data[pixelIndex + 3] = color[3] * 255
      }
    }
  }

}

export default SpectrogramPlugin
