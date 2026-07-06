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
  createSparseFilterBankForScale,
  applySparseFilterBank,
  magnitudesToColorIndices,
  magnitudesToDb,
  dbToColorIndices,
  createPreEmphasisTilt,
  getBinFrequencies,
  SILENCE_FLOOR_DB,
  AUTO_GAIN_BUFFER_BUDGET_BYTES,
  setupColorMap,
  freqType,
  unitType,
  getLabelFrequency,
  createWrapperClickHandler,
} from '../fft.js'

/**
 * Spectrogram plugin for wavesurfer.
 */
import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import createElement, { isHTMLElement } from '../dom.js'

// Import the worker using rollup-plugin-web-worker-loader
import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'

export type SpectrogramPluginOptions = {
  /** Selector of element or element in which to render */
  container?: string | HTMLElement
  /** Number of samples per analysis window. Must be a power of 2, unless fftSize is set (then any integer from 2 to fftSize). */
  fftSamples?: number
  /**
   * Length of the zero-padded FFT, in samples. Must be a power of two, and at least fftSamples.
   * When set, each fftSamples-long analysis window is zero-padded to fftSize before the FFT, which
   * only adds interpolated frequency bins (fftSize / 2 in total) - it does not improve the true
   * frequency resolution, and the time resolution (window and hop) is unchanged. Same split as
   * win_length vs n_fft in librosa/scipy or AnalyserNode.fftSize. When fftSize is set, fftSamples
   * may be any integer from 2 up to fftSize (the power-of-two requirement moves to fftSize).
   * (default: fftSamples)
   */
  fftSize?: number
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
   * Praat-style display pre-emphasis in dB per octave, applied before quantization: each bin
   * gets preEmphasis * log2(binHz / 1000) dB - 0 dB at 1 kHz, boosting higher frequencies and
   * attenuating lower ones (Praat's default is 6). Counteracts the natural ~-6 dB/oct spectral
   * slope of speech so formants above 1 kHz stay visible. Set 0 to disable. Only applies when
   * frequencies are computed from audio, not to pre-computed frequenciesDataUrl data.
   * (default: 0)
   */
  preEmphasis?: number
  /**
   * Praat-style autoscaling: map the loudest bin of the computed spectrogram (found after
   * pre-emphasis) to the last colormap entry and everything rangeDB below it to the first,
   * instead of using the fixed gainDB white point. gainDB is ignored while enabled. With
   * splitChannels, a single maximum serves all channels, so inter-channel level differences
   * are preserved (a quieter channel renders lighter); per-channel scaling was rejected to
   * keep channels comparable. If the whole signal is digital silence, the spectrogram is left
   * blank instead of amplifying the numeric floor. SpectrogramPlugin only - the windowed
   * variant computes segments lazily and has no global maximum. No effect with
   * frequenciesDataUrl. (default: false)
   */
  autoGain?: boolean
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
  /**
   * Max time in milliseconds to wait for the web worker FFT result before the calculation is
   * rejected (and falls back to the main thread). Set to 0 to disable the timeout. Only used when
   * useWebWorker is true. (default: 30000)
   */
  workerTimeout?: number
  /**
   * Whether a failed or timed-out worker calculation silently recomputes the FFT on the main
   * thread. The default keeps that historical behavior. Set to false to emit an 'error' event
   * and skip rendering instead - on long files a main-thread FFT can freeze the page, which is
   * usually worse than a missing spectrogram. After a worker failure the worker is re-created
   * on the next render either way. Only applies when useWebWorker is true and a worker could
   * actually be created; environments without Worker support always compute on the main
   * thread. (default: true)
   */
  fallbackToMainThread?: boolean
}

export type SpectrogramPluginEvents = BasePluginEvents & {
  ready: []
  click: [relativeX: number]
  error: [error: Error]
}

// Exact for all safe-integer powers of two; deliberately not bitwise (Int32 truncation would
// accept values like 2^32 + 1)
const isPowerOfTwo = (value: number) => Number.isInteger(value) && value >= 2 && Number.isInteger(Math.log2(value))

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
  private fftSize: SpectrogramPluginOptions['fftSize']
  private height: SpectrogramPluginOptions['height']
  private noverlap: SpectrogramPluginOptions['noverlap']
  private windowFunc: SpectrogramPluginOptions['windowFunc']
  private alpha: SpectrogramPluginOptions['alpha']
  private frequencyMin: SpectrogramPluginOptions['frequencyMin']
  private frequencyMax: SpectrogramPluginOptions['frequencyMax']
  private gainDB: SpectrogramPluginOptions['gainDB']
  private rangeDB: SpectrogramPluginOptions['rangeDB']
  private preEmphasis: number
  private autoGain: boolean
  private autoGainBudgetBytes = AUTO_GAIN_BUFFER_BUDGET_BYTES
  private scale: SpectrogramPluginOptions['scale']
  private numMelFilters: number
  private numLogFilters: number
  private numBarkFilters: number
  private numErbFilters: number

  // Web worker support
  private useWebWorker: boolean = false
  private worker: Worker | null = null
  private workerTimeout = 30000
  private fallbackToMainThread = true
  private workerConstructionFailed = false
  private workerPromises: Map<string, { resolve: Function; reject: Function; timer?: ReturnType<typeof setTimeout> }> =
    new Map()

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
    this.workerTimeout = options.workerTimeout ?? 30000
    this.fallbackToMainThread = options.fallbackToMainThread ?? true

    // Set up color map using shared utility
    this.colorMap = setupColorMap(options.colorMap)

    this.fftSize = options.fftSize
    // With fftSize set, fftSamples is a validated analysis-window length: only absent values get
    // the default. Without it, the historical coercion of falsy values is preserved.
    this.fftSamples = this.fftSize != null ? (options.fftSamples ?? 512) : options.fftSamples || 512
    this.height = options.height || 200
    this.noverlap = options.noverlap || null // Will be calculated later based on canvas size

    // The transform length must be a power of two; with fftSize set, fftSamples is just the
    // analysis window length and only needs to fit inside the transform
    const fftLength = this.fftSize ?? this.fftSamples
    if (!isPowerOfTwo(fftLength)) {
      throw new TypeError(
        `fftSize (or fftSamples when fftSize is not set) must be a power of two and at least 2, got ${fftLength}`,
      )
    }
    if (
      this.fftSize != null &&
      (!Number.isInteger(this.fftSamples) || this.fftSamples < 2 || this.fftSamples > this.fftSize)
    ) {
      throw new TypeError(`fftSamples must be an integer between 2 and fftSize, got ${this.fftSamples}`)
    }
    if (options.noverlap != null && !Number.isInteger(options.noverlap)) {
      throw new TypeError(`noverlap must be an integer number of samples, got ${options.noverlap}`)
    }
    this.windowFunc = options.windowFunc || 'hann'
    this.alpha = options.alpha

    // Getting file's original samplerate is difficult(#1248).
    // So set 12kHz default to render like wavesurfer.js 5.x.
    this.frequencyMin = options.frequencyMin || 0
    this.frequencyMax = options.frequencyMax || 0

    this.gainDB = options.gainDB ?? 20
    this.rangeDB = options.rangeDB ?? 80
    this.scale = options.scale || 'mel'
    this.preEmphasis = options.preEmphasis ?? 0
    this.autoGain = options.autoGain ?? false

    if (options.gainDB != null && !Number.isFinite(options.gainDB)) {
      throw new TypeError(`gainDB must be a finite number, got ${options.gainDB}`)
    }
    if (options.rangeDB != null && (!Number.isFinite(options.rangeDB) || options.rangeDB <= 0)) {
      throw new TypeError(`rangeDB must be a finite positive number, got ${options.rangeDB}`)
    }
    if (options.preEmphasis != null && !Number.isFinite(options.preEmphasis)) {
      throw new TypeError(`preEmphasis must be a finite number, got ${options.preEmphasis}`)
    }
    if (options.alpha != null) {
      if (!Number.isFinite(options.alpha)) {
        throw new TypeError(`alpha must be a finite number, got ${options.alpha}`)
      }
      if (this.windowFunc === 'gauss' && options.alpha <= 0) {
        throw new TypeError(`alpha must be positive for the gauss window, got ${options.alpha}`)
      }
    }

    // Rendering and labels derive their geometry from the computed data, so these follow the
    // transform length
    this.numMelFilters = fftLength / 2
    this.numLogFilters = fftLength / 2
    this.numBarkFilters = fftLength / 2
    this.numErbFilters = fftLength / 2

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
            if (promise.timer) clearTimeout(promise.timer)
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
        this.disposeWorker(new Error('Worker error'))
      }

      this.worker.onmessageerror = (event) => {
        console.warn('Spectrogram worker message error, falling back to main thread:', event)
        this.disposeWorker(new Error('Worker message error'))
      }
    } catch (error) {
      console.warn('Failed to initialize worker, falling back to main thread:', error)
      this.worker = null
      // Construction failure (e.g. CSP worker-src denial) is permanent for this environment:
      // latch it so computations don't retry it, unlike runtime failures of a live worker
      this.workerConstructionFailed = true
    }
  }

  // Terminate the worker and reject in-flight requests so callers fall back to the main thread
  // immediately instead of waiting out the worker timeout (or hanging when it is disabled)
  private disposeWorker(error: Error) {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.workerPromises.forEach((promise) => {
      if (promise.timer) clearTimeout(promise.timer)
      promise.reject(error)
    })
    this.workerPromises.clear()
  }

  onInit() {
    // Recreate DOM elements if they were destroyed
    if (!this.wrapper) {
      this.createWrapper()
    }
    if (!this.canvasContainer) {
      this.createCanvas()
    }

    // Use the user-specified container if provided, otherwise fall back to the wavesurfer wrapper
    if (this.options.container) {
      if (typeof this.options.container === 'string') {
        const el = document.querySelector(this.options.container)
        if (el instanceof HTMLElement) {
          this.container = el
        }
      } else if (isHTMLElement(this.options.container)) {
        this.container = this.options.container
      }
    }
    if (!this.container) {
      this.container = this.wavesurfer.getWrapper()
    }
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
    this.disposeWorker(new Error('Spectrogram plugin destroyed'))

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
    const decodedData = this.wavesurfer?.getDecodedData()
    if (!decodedData) {
      return null
    }

    if (this.cachedBuffer === decodedData && this.cachedFrequencies) {
      // Check if we can use cached frequencies
      return this.cachedFrequencies
    } else {
      // Calculate new frequencies and cache them; a failed computation (empty result)
      // is not cached so the next render retries
      const frequencies = await this.getFrequencies(decodedData)
      if (frequencies.length > 0) {
        this.cachedFrequencies = frequencies
        this.cachedBuffer = decodedData
      } else if (this.cachedBuffer && this.cachedBuffer !== decodedData) {
        // The buffer changed and its computation failed: drop the previous buffer's data so
        // nothing stale can be drawn against the new audio
        this.clearCache()
      }
      return frequencies
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
    this.canvases.forEach((canvas) => canvas.remove())
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
          const frequencies = await this.getFrequenciesData()
          // Draw what this render computed (cache hit, fresh data, or empty on failure)
          // rather than whatever the cache field holds
          this.drawSpectrogram(frequencies)
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
    if (
      !frequenciesData ||
      frequenciesData.length === 0 ||
      frequenciesData.every((channel) => !channel || channel.length === 0)
    ) {
      // Nothing to draw (failed computation, or a buffer too short for a single FFT frame):
      // remove any previously drawn canvases so no stale spectrogram stays on screen
      this.clearCanvases()
      return
    }
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
    const endIndex = Math.min(
      Math.ceil(((xOffset + canvasWidth) / totalWidth) * resampledPixels.length),
      resampledPixels.length,
    )
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

    bitmapPromise
      .then((bitmap) => {
        // Remove from pending set
        this.pendingBitmaps.delete(bitmapPromise)

        try {
          // Check if canvas is still valid before drawing
          if (ctx.canvas.parentNode) {
            const drawHeight = (height * rMax1) / rMax
            const drawY = yOffset + height * (1 - rMax1 / rMax)

            ctx.drawImage(bitmap, 0, drawY, canvasWidth, drawHeight)
          }
        } finally {
          // Clean up bitmap to free memory, even if the canvas was removed before it resolved
          if ('close' in bitmap) {
            bitmap.close()
          }
        }
      })
      .catch((error) => {
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
      // Set timeout to avoid hanging; workerTimeout === 0 disables it
      const timer =
        this.workerTimeout > 0
          ? setTimeout(() => {
              if (this.workerPromises.has(id)) {
                // A timed-out result can never be consumed (its id is dropped), so dispose
                // the worker too: this stops the abandoned computation and lets the next
                // render start a fresh worker instead of queueing behind a stuck one
                this.disposeWorker(new Error('Worker timeout'))
              }
            }, this.workerTimeout)
          : undefined
      this.workerPromises.set(id, { resolve, reject, timer })

      // Send message to worker; if dispatch fails synchronously, settle and clean up immediately
      try {
        this.worker.postMessage({
          type: 'calculateFrequencies',
          id,
          audioData,
          options: {
            startTime: 0,
            endTime: buffer.duration,
            sampleRate: buffer.sampleRate,
            fftSamples: this.fftSamples,
            fftSize: this.fftSize,
            windowFunc: this.windowFunc,
            alpha: this.alpha,
            noverlap,
            scale: this.scale,
            gainDB: this.gainDB,
            rangeDB: this.rangeDB,
            preEmphasis: this.preEmphasis,
            autoGain: this.autoGain,
            autoGainBufferBudgetBytes: this.autoGainBudgetBytes,
            splitChannels: this.options.splitChannels || false,
          },
        })
      } catch (error) {
        if (timer) clearTimeout(timer)
        this.workerPromises.delete(id)
        reject(error)
      }
    })

    return promise
  }

  private async getFrequencies(buffer: AudioBuffer): Promise<Uint8Array[][]> {
    this.frequencyMax = this.frequencyMax || buffer.sampleRate / 2
    this.buffer = buffer

    if (!buffer) return []

    // Use worker if enabled and available; a worker disposed after a runtime failure is
    // re-created on the next computation (construction failures are latched as permanent)
    if (this.useWebWorker && !this.worker && !this.workerConstructionFailed && typeof Worker !== 'undefined') {
      this.initializeWorker()
    }
    if (this.useWebWorker && this.worker) {
      try {
        return await this.calculateFrequenciesWithWorker(buffer)
      } catch (error) {
        if (!this.fallbackToMainThread) {
          // Surface the failure instead of silently recomputing on the main thread, which
          // can freeze the page for long files
          this.emit('error', error instanceof Error ? error : new Error(String(error)))
          return []
        }
        console.warn('Worker calculation failed, falling back to main thread:', error)
        // Fall through to main thread calculation
      }
    }

    const fftSamples = this.fftSamples
    const fftLength = this.fftSize ?? fftSamples
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

    // Calculate hop size (same as worker for consistency); integer arithmetic so non-power-of-two
    // windows cannot produce fractional frame starts
    let actualNoverlap = noverlap || Math.max(0, Math.round(fftSamples * 0.5))
    const maxOverlap = Math.floor(fftSamples / 2)
    actualNoverlap = Math.min(actualNoverlap, maxOverlap)
    const minHopSize = Math.max(64, Math.ceil(fftSamples * 0.25))
    const hopSize = Math.max(minHopSize, fftSamples - actualNoverlap)

    // Create FFT instance (reuse if possible for performance); the window covers fftSamples
    // samples, zero-padded up to fftLength
    const fft = new FFT(fftLength, sampleRate, this.windowFunc, this.alpha, fftSamples)

    // Create filter bank based on scale using centralized function
    const numFilters = fftLength / 2
    const filterBank = createSparseFilterBankForScale(this.scale, numFilters, fftLength, sampleRate)

    // One reused frame buffer; the zero tail beyond fftSamples doubles as the FFT padding
    const frame = new Float32Array(fftLength)

    // Optional Praat display pre-emphasis, precomputed per output row
    const tilt = this.preEmphasis
      ? createPreEmphasisTilt(this.preEmphasis, getBinFrequencies(filterBank, fftLength, sampleRate))
      : null

    const computeSpectrum = (channelData: Float32Array, sample: number): Float32Array => {
      frame.set(channelData.subarray(sample, sample + fftSamples))
      let spectrum = fft.calculateSpectrum(frame)
      if (filterBank) {
        spectrum = applySparseFilterBank(spectrum, filterBank)
      }
      return spectrum
    }

    if (!this.autoGain) {
      for (let c = 0; c < channels; c++) {
        // for each channel
        const channelData = buffer.getChannelData(c)
        const channelFreq: Uint8Array[] = []

        // Use same hop size calculation as worker for consistency
        for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
          // Convert to uint8 color indices
          channelFreq.push(
            magnitudesToColorIndices(computeSpectrum(channelData, sample), -this.gainDB, this.rangeDB, tilt),
          )
        }
        frequencies.push(channelFreq)
      }
      return frequencies
    }

    // autoGain (Praat-style autoscaling): the white point is the loudest bin of the whole
    // spectrogram, found after pre-emphasis, shared across channels. Two strategies bound the
    // transient memory: below the budget the dB frames are kept between the two passes; above
    // it only the maximum is tracked and the spectra are recomputed for quantization.
    const bins = fftLength / 2
    const frameCount = buffer.length > fftSamples ? Math.floor((buffer.length - fftSamples - 1) / hopSize) + 1 : 0
    const estimatedBytes = frameCount * bins * 4 * channels
    let maxDb = -Infinity

    if (estimatedBytes < this.autoGainBudgetBytes) {
      const dbFrames: Float32Array[][] = []
      for (let c = 0; c < channels; c++) {
        const channelData = buffer.getChannelData(c)
        const channelDb: Float32Array[] = []
        for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
          const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt)
          for (let i = 0; i < db.length; i++) {
            if (db[i] > maxDb) maxDb = db[i]
          }
          channelDb.push(db)
        }
        dbFrames.push(channelDb)
      }
      const silent = maxDb < SILENCE_FLOOR_DB
      for (const channelDb of dbFrames) {
        frequencies.push(
          channelDb.map((db) => (silent ? new Uint8Array(db.length) : dbToColorIndices(db, maxDb, this.rangeDB))),
        )
      }
      return frequencies
    }

    // Over budget: pass 1 tracks only the maximum with one reused dB frame
    const dbScratch = new Float32Array(bins)
    for (let c = 0; c < channels; c++) {
      const channelData = buffer.getChannelData(c)
      for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
        const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt, dbScratch)
        for (let i = 0; i < db.length; i++) {
          if (db[i] > maxDb) maxDb = db[i]
        }
      }
    }
    const silent = maxDb < SILENCE_FLOOR_DB
    for (let c = 0; c < channels; c++) {
      const channelData = buffer.getChannelData(c)
      const channelFreq: Uint8Array[] = []
      for (let sample = 0; sample + fftSamples < channelData.length; sample += hopSize) {
        if (silent) {
          channelFreq.push(new Uint8Array(bins))
        } else {
          const db = magnitudesToDb(computeSpectrum(channelData, sample), tilt, dbScratch)
          channelFreq.push(dbToColorIndices(db, maxDb, this.rangeDB))
        }
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
    return frequenciesData.map((channelFreq) => this.resampleChannel(channelFreq, targetWidth))
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

  private fillImageDataQuality(
    data: Uint8ClampedArray,
    segmentPixels: Uint8Array[],
    segmentWidth: number,
    bitmapHeight: number,
  ): void {
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
