/**
 * Windowed Spectrogram plugin - Optimized for very long audio files
 *
 * Only renders frequency data in a sliding window around the current viewport,
 * keeping memory usage constant regardless of audio length.
 */

// @ts-nocheck

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import createElement, { isHTMLElement } from '../dom.js'
// Import centralized FFT functionality
import FFT, {
  hzToScale,
  scaleToHz,
  createSparseFilterBankForScale,
  applySparseFilterBank,
  magnitudesToColorIndices,
  createPreEmphasisTilt,
  getBinFrequencies,
  setupColorMap,
  freqType,
  unitType,
  getLabelFrequency,
  createWrapperClickHandler,
} from '../fft.js'

// Import the worker using rollup-plugin-web-worker-loader
import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'

export type WindowedSpectrogramPluginOptions = {
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
  /** Size of the overlapping window. Must be < fftSamples. */
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
  /** Max frequency to scale spectrogram. */
  frequencyMax?: number
  /** Sample rate of the audio when using pre-computed spectrogram data. */
  sampleRate?: number
  /** Frequency scale type */
  scale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  /** Gain in dB */
  gainDB?: number
  /** Range in dB */
  rangeDB?: number
  /**
   * Praat-style display pre-emphasis in dB per octave, applied before quantization: each bin
   * gets preEmphasis * log2(binHz / 1000) dB - 0 dB at 1 kHz, boosting higher frequencies and
   * attenuating lower ones (Praat's default is 6). Set 0 to disable. Note: the autoGain option
   * of SpectrogramPlugin is not available here - segments are computed lazily while scrolling,
   * so no global maximum exists. (default: 0)
   */
  preEmphasis?: number
  /** Color map */
  colorMap?: number[][] | 'gray' | 'igray' | 'roseus'
  /** Render a spectrogram for each channel independently when true. */
  splitChannels?: boolean
  /** Window size in seconds (how much data to keep in memory) */
  windowSize?: number
  /** Buffer size in pixels (how much extra to render beyond viewport) */
  bufferSize?: number
  /** Enable progressive background loading of all segments (default: true) */
  progressiveLoading?: boolean
  /** Use web worker for FFT calculations (default: true) */
  useWebWorker?: boolean
  /**
   * Whether a failed or timed-out worker calculation silently recomputes the FFT on the main
   * thread. The default keeps that historical behavior. Set to false to emit an 'error' event
   * and skip the segment instead - on long files a main-thread FFT can freeze the page. After
   * a worker failure the worker is re-created on the next computation either way. Only applies
   * when a worker could actually be created. (default: true)
   */
  fallbackToMainThread?: boolean
}

export type WindowedSpectrogramPluginEvents = BasePluginEvents & {
  ready: []
  click: [relativeX: number]
  progress: [progress: number] // Progress from 0 to 1
  error: [error: Error]
}

/**
 * Represents a segment of frequency data in the sliding window
 */
interface FrequencySegment {
  startTime: number
  endTime: number
  startPixel: number
  endPixel: number
  frequencies: Uint8Array[][]
  canvas?: HTMLCanvasElement
}

// Exact for all safe-integer powers of two; deliberately not bitwise (Int32 truncation would
// accept values like 2^32 + 1)
const isPowerOfTwo = (value: number) => Number.isInteger(value) && value >= 2 && Number.isInteger(Math.log2(value))

class WindowedSpectrogramPlugin extends BasePlugin<WindowedSpectrogramPluginEvents, WindowedSpectrogramPluginOptions> {
  private container: HTMLElement
  private wrapper: HTMLElement
  private labelsEl: HTMLCanvasElement
  private canvasContainer: HTMLElement
  private colorMap: number[][]
  private fftSamples: WindowedSpectrogramPluginOptions['fftSamples']
  private fftSize: WindowedSpectrogramPluginOptions['fftSize']
  private height: WindowedSpectrogramPluginOptions['height']
  private noverlap: WindowedSpectrogramPluginOptions['noverlap']
  private windowFunc: WindowedSpectrogramPluginOptions['windowFunc']
  private alpha: WindowedSpectrogramPluginOptions['alpha']
  private frequencyMin: WindowedSpectrogramPluginOptions['frequencyMin']
  private frequencyMax: WindowedSpectrogramPluginOptions['frequencyMax']
  private gainDB: WindowedSpectrogramPluginOptions['gainDB']
  private rangeDB: WindowedSpectrogramPluginOptions['rangeDB']
  private preEmphasis: number
  private scale: WindowedSpectrogramPluginOptions['scale']

  // Windowing properties
  private windowSize: number // seconds
  private bufferSize: number // pixels
  private progressiveLoading: boolean
  private useWebWorker: boolean
  private fallbackToMainThread: boolean
  private workerConstructionFailed = false
  private segments: Map<string, FrequencySegment> = new Map()
  private buffer: AudioBuffer | null = null
  private currentPosition = 0 // current playback position in seconds
  private pixelsPerSecond = 0
  private isRendering = false
  private renderTimeout: number | null = null

  // FFT and processing
  private fft: FFT | null = null
  private numMelFilters: number
  private numLogFilters: number
  private numBarkFilters: number
  private numErbFilters: number

  // Progressive loading
  private progressiveLoadTimeout: number | null = null
  private isProgressiveLoading = false
  private nextProgressiveSegmentTime = 0 // Track which segment to load next

  // Web worker for FFT calculations
  private worker: Worker | null = null
  private workerPromises: Map<string, { resolve: Function; reject: Function; timer?: ReturnType<typeof setTimeout> }> =
    new Map()

  static create(options?: WindowedSpectrogramPluginOptions) {
    return new WindowedSpectrogramPlugin(options || {})
  }

  constructor(options: WindowedSpectrogramPluginOptions) {
    super(options)

    this.container =
      'string' == typeof options.container ? document.querySelector(options.container) : options.container

    // Set up color map using shared utility
    this.colorMap = setupColorMap(options.colorMap)

    // FFT and processing options
    this.fftSize = options.fftSize
    // With fftSize set, fftSamples is a validated analysis-window length: only absent values get
    // the default. Without it, the historical coercion of falsy values is preserved.
    this.fftSamples = this.fftSize != null ? (options.fftSamples ?? 512) : options.fftSamples || 512
    this.height = options.height || 200
    this.noverlap = options.noverlap || null // Will be calculated later based on canvas size, like normal plugin

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
    this.frequencyMin = options.frequencyMin || 0
    this.frequencyMax = options.frequencyMax || 0
    this.gainDB = options.gainDB ?? 20
    this.rangeDB = options.rangeDB ?? 80
    this.scale = options.scale || 'mel'
    this.preEmphasis = options.preEmphasis ?? 0

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

    // Windowing options
    this.windowSize = options.windowSize || 30 // 30 seconds window
    this.bufferSize = options.bufferSize || 5000 // 5000 pixels buffer

    // Progressive loading (disabled by default to avoid system overload)
    this.progressiveLoading = options.progressiveLoading === true

    // Web worker (disabled by default in SSR environments like Next.js)
    this.useWebWorker = options.useWebWorker === true && typeof window !== 'undefined'
    this.fallbackToMainThread = options.fallbackToMainThread ?? true

    // Filter banks
    this.numMelFilters = fftLength / 2
    this.numLogFilters = fftLength / 2
    this.numBarkFilters = fftLength / 2
    this.numErbFilters = fftLength / 2

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
      // latch it so segment computations don't retry it on every segment
      this.workerConstructionFailed = true
    }
  }

  // Terminate the worker and reject in-flight requests so callers fall back to the main thread
  // immediately instead of waiting out the 30s request timeout
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

    // Set up styling
    if (this.wavesurfer.options.fillParent) {
      Object.assign(this.wrapper.style, {
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'hidden',
      })
    }

    // Listen for playback position changes
    this.subscriptions.push(
      this.wavesurfer.on('timeupdate', (currentTime) => {
        this.updatePosition(currentTime)
      }),
    )

    // Listen for scroll events
    this.subscriptions.push(
      this.wavesurfer.on('scroll', () => {
        this.handleScroll()
      }),
    )

    // Listen for zoom changes
    this.subscriptions.push(this.wavesurfer.on('redraw', () => this.handleRedraw()))

    // Listen for audio data ready
    this.subscriptions.push(
      this.wavesurfer.on('ready', () => {
        const decodedData = this.wavesurfer.getDecodedData()
        if (decodedData) {
          this.render(decodedData)
        }
      }),
    )

    // Trigger initial render after re-initialization
    // This ensures the spectrogram appears even if no redraw event is fired
    if (this.wavesurfer.getDecodedData()) {
      // Use setTimeout to ensure DOM is fully ready
      setTimeout(() => {
        this.render(this.wavesurfer.getDecodedData())
      }, 0)
    }
  }

  private createWrapper() {
    this.wrapper = createElement('div', {
      style: {
        display: 'block',
        position: 'relative',
        userSelect: 'none',
      },
    })

    // Labels canvas
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

  private handleRedraw() {
    const oldPixelsPerSecond = this.pixelsPerSecond
    this.pixelsPerSecond = this.getPixelsPerSecond()

    // Only update canvas positions if zoom changed, keep frequency data!
    if (oldPixelsPerSecond !== this.pixelsPerSecond && this.segments.size > 0) {
      this.updateSegmentPositions(oldPixelsPerSecond, this.pixelsPerSecond)
    }

    this.scheduleRender()
  }

  private updateSegmentPositions(oldPxPerSec: number, newPxPerSec: number) {
    for (const segment of this.segments.values()) {
      // Update pixel positions based on new zoom level
      segment.startPixel = segment.startTime * newPxPerSec
      segment.endPixel = segment.endTime * newPxPerSec

      // Update canvas positioning and size WITHOUT recalculating frequencies
      if (segment.canvas) {
        const segmentWidth = segment.endPixel - segment.startPixel
        segment.canvas.style.left = `${segment.startPixel}px`
        segment.canvas.style.width = `${segmentWidth}px`
      }
    }

    // Schedule a gentle re-render of visible segments only if zoom changed significantly
    const zoomRatio = newPxPerSec / oldPxPerSec
    if (zoomRatio < 0.5 || zoomRatio > 2.0) {
      this.scheduleSegmentQualityUpdate()
    }
  }

  private scheduleSegmentQualityUpdate() {
    // Debounce quality updates to avoid rapid re-renders during zoom
    if (this.qualityUpdateTimeout) {
      clearTimeout(this.qualityUpdateTimeout)
    }

    this.qualityUpdateTimeout = window.setTimeout(() => {
      this.updateVisibleSegmentQuality()
    }, 500) // Wait 500ms after zoom stops
  }

  private qualityUpdateTimeout: number | null = null

  private async updateVisibleSegmentQuality() {
    if (!this.buffer) return

    const wrapper = this.wavesurfer?.getWrapper()
    if (!wrapper) return

    // Get current viewport
    const scrollLeft = this.getScrollLeft(wrapper)
    const viewportWidth = this.getViewportWidth(wrapper)
    const pixelsPerSec = this.getPixelsPerSecond()

    const visibleStartTime = scrollLeft / pixelsPerSec
    const visibleEndTime = (scrollLeft + viewportWidth) / pixelsPerSec

    // Find segments that overlap with visible area
    const visibleSegments = Array.from(this.segments.values()).filter(
      (segment) => segment.startTime < visibleEndTime && segment.endTime > visibleStartTime,
    )

    if (visibleSegments.length === 0) {
      return
    }

    // Re-render only the visible segments with current zoom level
    for (const segment of visibleSegments) {
      if (segment.canvas) {
        await this.renderSegment(segment)
      }
    }
  }

  private getScrollLeft(wrapper: HTMLElement): number {
    // Try multiple sources for scroll position
    if (wrapper.scrollLeft) return wrapper.scrollLeft
    if (wrapper.parentElement?.scrollLeft) return wrapper.parentElement.scrollLeft
    if (document.documentElement.scrollLeft) return document.documentElement.scrollLeft
    if (document.body.scrollLeft) return document.body.scrollLeft
    if (window.scrollX) return window.scrollX
    if (window.pageXOffset) return window.pageXOffset

    // Look for scrollable ancestors
    let element = wrapper.parentElement
    while (element) {
      const computedStyle = window.getComputedStyle(element)
      if (computedStyle.overflowX === 'scroll' || computedStyle.overflowX === 'auto') {
        if (element.scrollLeft > 0) return element.scrollLeft
      }
      element = element.parentElement
    }

    return 0
  }

  private getViewportWidth(wrapper: HTMLElement): number {
    const wrapperWidth = wrapper.offsetWidth || wrapper.clientWidth
    const parentWidth = wrapper.parentElement?.offsetWidth || wrapper.parentElement?.clientWidth
    const windowWidth = window.innerWidth

    // Use the smallest reasonable width
    if (parentWidth && parentWidth < wrapperWidth) return parentWidth
    return Math.min(wrapperWidth || 800, windowWidth * 0.8)
  }

  private handleScroll() {
    const wrapper = this.wavesurfer?.getWrapper()

    // Use the same scroll detection logic as renderVisibleWindow
    let scrollLeft = 0

    if (wrapper?.scrollLeft) {
      scrollLeft = wrapper.scrollLeft
    } else if (wrapper?.parentElement?.scrollLeft) {
      scrollLeft = wrapper.parentElement.scrollLeft
    } else if (document.documentElement.scrollLeft || document.body.scrollLeft) {
      scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft
    } else if (window.scrollX || window.pageXOffset) {
      scrollLeft = window.scrollX || window.pageXOffset
    } else if (wrapper) {
      // Look for scrollable ancestors
      let element = wrapper.parentElement
      while (element && scrollLeft === 0) {
        const computedStyle = window.getComputedStyle(element)
        if (computedStyle.overflowX === 'scroll' || computedStyle.overflowX === 'auto') {
          if (element.scrollLeft > 0) {
            scrollLeft = element.scrollLeft
            break
          }
        }
        element = element.parentElement
      }
    }

    const pixelsPerSec = this.getPixelsPerSecond()
    const currentViewTime = scrollLeft / pixelsPerSec

    this.scheduleRender()
  }

  private updatePosition(currentTime: number) {
    this.currentPosition = currentTime
    this.scheduleRender()
  }

  private scheduleRender() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
    }
    this.renderTimeout = window.setTimeout(() => {
      this.renderVisibleWindow()
    }, 16) // 60fps
  }

  private async renderVisibleWindow() {
    if (this.isRendering || !this.buffer) return
    this.isRendering = true

    try {
      const wrapper = this.wavesurfer?.getWrapper()
      if (!wrapper) return

      // Use helper functions for consistency
      const scrollLeft = this.getScrollLeft(wrapper)
      const actualViewportWidth = this.getViewportWidth(wrapper)
      const pixelsPerSec = this.getPixelsPerSecond()
      const totalAudioDuration = this.buffer.duration

      const visibleStartTime = scrollLeft / pixelsPerSec
      const visibleEndTime = (scrollLeft + actualViewportWidth) / pixelsPerSec

      // Reasonable buffer time based on visible duration
      const visibleDuration = visibleEndTime - visibleStartTime
      let bufferTimeSeconds = Math.min(2, visibleDuration * 0.5) // Buffer is at most half the visible duration or 2s

      if (visibleDuration > 30) {
        console.warn(`⚠️ Large visible duration: ${visibleDuration.toFixed(1)}s - limiting buffer`)
        bufferTimeSeconds = 1 // Smaller buffer for very zoomed out views
      }

      const windowStartTime = Math.max(0, visibleStartTime - bufferTimeSeconds)
      const windowEndTime = Math.min(this.buffer.duration, visibleEndTime + bufferTimeSeconds)

      // Generate segments for this window
      await this.generateSegments(windowStartTime, windowEndTime)

      // Don't clean up old segments - keep them all in memory for performance
    } finally {
      this.isRendering = false
    }
  }

  private async generateSegments(startTime: number, endTime: number) {
    if (!this.buffer) return

    const pixelsPerSec = this.getPixelsPerSecond()
    const containerWidth = this.getWidth() // Get full container width
    const totalAudioDuration = this.buffer.duration

    // Progressive loading always uses fixed segment sizes, never fill container mode
    const isProgressiveLoadCall = this.isProgressiveLoading && endTime - startTime <= 35 // Progressive loading uses ~30s segments

    // Calculate if this is a short audio that should fill the container
    const totalAudioPixelWidth = totalAudioDuration * pixelsPerSec
    const shouldFillContainer =
      !isProgressiveLoadCall && totalAudioPixelWidth <= containerWidth && totalAudioDuration <= 60 // 60s max for fill mode

    let segmentPixelWidth: number
    let segmentDuration: number

    if (isProgressiveLoadCall) {
      // For progressive loading, respect the requested time range exactly
      segmentDuration = endTime - startTime
      segmentPixelWidth = segmentDuration * pixelsPerSec
    } else if (shouldFillContainer) {
      // For short audio, create one segment that fills the entire container width
      segmentPixelWidth = containerWidth
      segmentDuration = totalAudioDuration // Use full audio duration
    } else {
      // For long audio viewport rendering, use windowing approach
      segmentPixelWidth = 15000 // 15000 pixels per segment
      segmentDuration = segmentPixelWidth / pixelsPerSec // Calculate duration based on pixel width
    }

    // Show existing segments
    if (this.segments.size > 0) {
      for (const [key, segment] of this.segments) {
      }
    }

    // Check coverage first to avoid duplicate work
    const uncoveredRanges = this.findUncoveredTimeRanges(startTime, endTime, segmentDuration)

    if (uncoveredRanges.length === 0) {
      return
    }

    let newSegmentsCreated = 0

    // Only generate segments for uncovered ranges
    for (const range of uncoveredRanges) {
      // Create segments covering this uncovered range
      for (let time = range.start; time < range.end; time += segmentDuration) {
        const segmentStart = time
        const segmentEnd = Math.min(time + segmentDuration, range.end, this.buffer.duration)
        const segmentKey = `${Math.floor(segmentStart * 10)}_${Math.floor(segmentEnd * 10)}`

        // Double-check if segment already exists (shouldn't happen but be safe)
        if (this.segments.has(segmentKey)) {
          continue
        }

        newSegmentsCreated++

        // Calculate frequency data for this segment
        const freqStartTime = performance.now()
        const frequencies = await this.calculateFrequencies(segmentStart, segmentEnd)
        const freqEndTime = performance.now()

        if (frequencies && frequencies.length > 0) {
          const segment: FrequencySegment = {
            startTime: segmentStart,
            endTime: segmentEnd,
            startPixel: shouldFillContainer ? 0 : segmentStart * pixelsPerSec, // Start at 0 for fill mode
            endPixel: shouldFillContainer ? containerWidth : segmentEnd * pixelsPerSec, // End at container width for fill mode
            frequencies: frequencies,
          }

          this.segments.set(segmentKey, segment)

          // Render this segment
          const renderStartTime = performance.now()
          await this.renderSegment(segment)
          const renderEndTime = performance.now()

          // Emit progress update
          this.emitProgress()
        } else {
        }
      }
    }

    // Start progressive loading if not already running
    if (!this.isProgressiveLoading) {
      this.startProgressiveLoading()
    }
  }

  private findUncoveredTimeRanges(
    startTime: number,
    endTime: number,
    segmentDuration: number,
  ): Array<{ start: number; end: number }> {
    // Get all existing segments sorted by start time
    const existingSegments = Array.from(this.segments.values()).sort((a, b) => a.startTime - b.startTime)

    const uncoveredRanges: Array<{ start: number; end: number }> = []
    let currentTime = startTime

    for (const segment of existingSegments) {
      // If there's a gap before this segment
      if (currentTime < segment.startTime && currentTime < endTime) {
        const gapEnd = Math.min(segment.startTime, endTime)
        uncoveredRanges.push({
          start: currentTime,
          end: gapEnd,
        })
      }

      // Move past this segment
      currentTime = Math.max(currentTime, segment.endTime)

      // If we've covered the requested range, stop
      if (currentTime >= endTime) {
        break
      }
    }

    // If there's still uncovered time at the end
    if (currentTime < endTime) {
      uncoveredRanges.push({
        start: currentTime,
        end: endTime,
      })
    }

    return uncoveredRanges
  }

  private startProgressiveLoading() {
    if (this.isProgressiveLoading || !this.buffer || !this.progressiveLoading) return

    this.isProgressiveLoading = true
    this.nextProgressiveSegmentTime = 0 // Start from the beginning

    // Start loading after a short delay to not interfere with user interactions
    this.progressiveLoadTimeout = window.setTimeout(() => {
      this.progressiveLoadNextSegment()
    }, 1000) // Wait 1 second before starting
  }

  private async progressiveLoadNextSegment() {
    if (!this.buffer || !this.isProgressiveLoading) return

    // For progressive loading, use fixed time-based segments (not pixel-based)
    const segmentDuration = 30 // 30 seconds per segment for progressive loading
    const totalDuration = this.buffer.duration

    // Check if we've reached the end
    if (this.nextProgressiveSegmentTime >= totalDuration) {
      this._stopProgressiveLoading()
      return
    }

    const segmentStart = this.nextProgressiveSegmentTime
    const segmentEnd = Math.min(segmentStart + segmentDuration, totalDuration)

    // Check if this segment is already loaded
    const segmentKey = `${Math.floor(segmentStart * 10)}_${Math.floor(segmentEnd * 10)}`
    const isAlreadyLoaded = this.segments.has(segmentKey)

    if (!isAlreadyLoaded) {
      try {
        await this.generateSegments(segmentStart, segmentEnd)
      } catch (error) {
        console.warn('Progressive loading failed:', error)
        this._stopProgressiveLoading()
        return
      }
    }

    // Move to next segment
    this.nextProgressiveSegmentTime = segmentEnd

    // Schedule next progressive load
    this.progressiveLoadTimeout = window.setTimeout(() => {
      this.progressiveLoadNextSegment()
    }, 2000) // Wait 2 seconds between segments
  }

  private _stopProgressiveLoading() {
    this.isProgressiveLoading = false
    if (this.progressiveLoadTimeout) {
      clearTimeout(this.progressiveLoadTimeout)
      this.progressiveLoadTimeout = null
    }
  }

  /** Get the current loading progress as a percentage (0-100) */
  public getLoadingProgress(): number {
    if (!this.buffer) return 0

    const totalDuration = this.buffer.duration

    if (totalDuration === 0) return 100
    if (!this.isProgressiveLoading && this.segments.size === 0) return 0

    // Calculate progress based on how far we've progressed through the audio
    const progress = Math.min(100, (this.nextProgressiveSegmentTime / totalDuration) * 100)

    // If progressive loading is complete, return 100%
    if (!this.isProgressiveLoading && this.nextProgressiveSegmentTime >= totalDuration) {
      return 100
    }

    return progress
  }

  private emitProgress() {
    const progress = this.getLoadingProgress() / 100 // Convert to 0-1 range
    this.emit('progress', progress)
  }

  private async calculateFrequencies(startTime: number, endTime: number): Promise<Uint8Array[][]> {
    if (!this.buffer) return []

    const calcStartTime = performance.now()
    const sampleRate = this.buffer.sampleRate
    const channels = this.options.splitChannels ? this.buffer.numberOfChannels : 1

    // Try to use web worker first; a worker disposed after a runtime failure is re-created
    // on the next computation (construction failures are latched as permanent)
    if (this.useWebWorker && !this.worker && !this.workerConstructionFailed && typeof Worker !== 'undefined') {
      this.initializeWorker()
    }
    if (this.worker) {
      try {
        const result = await this.calculateFrequenciesWithWorker(startTime, endTime)
        const totalTime = performance.now() - calcStartTime
        return result
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

    // Fallback to main thread calculation
    return this.calculateFrequenciesMainThread(startTime, endTime)
  }

  private async calculateFrequenciesWithWorker(startTime: number, endTime: number): Promise<Uint8Array[][]> {
    if (!this.buffer || !this.worker) {
      throw new Error('Worker not available')
    }

    const sampleRate = this.buffer.sampleRate
    const channels = this.options.splitChannels ? this.buffer.numberOfChannels : 1

    // Calculate noverlap
    let noverlap = this.noverlap
    if (!noverlap) {
      const segmentDuration = endTime - startTime
      const pixelsPerSec = this.getPixelsPerSecond()
      const segmentWidth = segmentDuration * pixelsPerSec
      const startSample = Math.floor(startTime * sampleRate)
      const endSample = Math.floor(endTime * sampleRate)
      const uniqueSamplesPerPx = (endSample - startSample) / segmentWidth
      noverlap = Math.max(0, Math.round(this.fftSamples - uniqueSamplesPerPx))
    }

    // Prepare audio data for worker
    const audioData: Float32Array[] = []
    for (let c = 0; c < channels; c++) {
      audioData.push(this.buffer.getChannelData(c))
    }

    // Generate unique ID for this request
    const id = `${Date.now()}_${Math.random()}`

    // Create promise for worker response
    const promise = new Promise<Uint8Array[][]>((resolve, reject) => {
      // Set timeout to avoid hanging
      const timer = setTimeout(() => {
        if (this.workerPromises.has(id)) {
          // A timed-out result can never be consumed (its id is dropped), so dispose the
          // worker too: this stops the abandoned computation and lets the next segment
          // start a fresh worker instead of queueing behind a stuck one
          this.disposeWorker(new Error('Worker timeout'))
        }
      }, 30000) // 30 second timeout
      this.workerPromises.set(id, { resolve, reject, timer })

      // Send message to worker; if dispatch fails synchronously, settle and clean up immediately
      try {
        this.worker.postMessage({
          type: 'calculateFrequencies',
          id,
          audioData,
          options: {
            startTime,
            endTime,
            sampleRate,
            fftSamples: this.fftSamples,
            fftSize: this.fftSize,
            windowFunc: this.windowFunc,
            alpha: this.alpha,
            noverlap,
            scale: this.scale,
            gainDB: this.gainDB,
            rangeDB: this.rangeDB,
            preEmphasis: this.preEmphasis,
            splitChannels: this.options.splitChannels || false,
          },
        })
      } catch (error) {
        clearTimeout(timer)
        this.workerPromises.delete(id)
        reject(error)
      }
    })

    return promise
  }

  private async calculateFrequenciesMainThread(startTime: number, endTime: number): Promise<Uint8Array[][]> {
    if (!this.buffer) return []

    const sampleRate = this.buffer.sampleRate
    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.floor(endTime * sampleRate)
    const channels = this.options.splitChannels ? this.buffer.numberOfChannels : 1

    // Initialize FFT if needed; the window covers fftSamples samples, zero-padded up to fftLength
    const fftLength = this.fftSize ?? this.fftSamples
    if (!this.fft || this.fft.bufferSize !== fftLength || this.fft.windowLength !== this.fftSamples) {
      this.fft = new FFT(fftLength, sampleRate, this.windowFunc, this.alpha, this.fftSamples)
    }

    // Calculate noverlap like the normal plugin
    let noverlap = this.noverlap
    if (!noverlap) {
      const segmentDuration = endTime - startTime
      const pixelsPerSec = this.getPixelsPerSecond()
      const segmentWidth = segmentDuration * pixelsPerSec
      const uniqueSamplesPerPx = (endSample - startSample) / segmentWidth
      noverlap = Math.max(0, Math.round(this.fftSamples - uniqueSamplesPerPx))
    }

    // OPTIMIZATION: For windowed mode, reduce overlap to speed up processing; integer
    // arithmetic so non-power-of-two windows cannot produce fractional frame starts
    const maxOverlap = Math.floor(this.fftSamples / 2)
    noverlap = Math.min(noverlap, maxOverlap)
    const minHopSize = Math.max(64, Math.ceil(this.fftSamples * 0.25))
    const hopSize = Math.max(minHopSize, this.fftSamples - noverlap)

    const frequencies: Uint8Array[][] = []

    const fftStartTime = performance.now()
    let totalFFTs = 0

    // Create the filter bank once for all frames and channels
    const filterBank = this.getFilterBank(sampleRate)

    // Optional Praat display pre-emphasis, precomputed per output row
    const tilt = this.preEmphasis
      ? createPreEmphasisTilt(this.preEmphasis, getBinFrequencies(filterBank, fftLength, sampleRate))
      : null

    // One reused frame buffer; the zero tail beyond fftSamples doubles as the FFT padding
    const frame = new Float32Array(fftLength)

    for (let c = 0; c < channels; c++) {
      const channelData = this.buffer.getChannelData(c)
      const channelFreq: Uint8Array[] = []

      for (let sample = startSample; sample + this.fftSamples < endSample; sample += hopSize) {
        frame.set(channelData.subarray(sample, sample + this.fftSamples))
        let spectrum = this.fft.calculateSpectrum(frame)
        totalFFTs++

        // Apply filter bank if needed
        if (filterBank) {
          spectrum = applySparseFilterBank(spectrum, filterBank)
        }

        // Convert to uint8 color indices
        channelFreq.push(magnitudesToColorIndices(spectrum, -this.gainDB, this.rangeDB, tilt))
      }
      frequencies.push(channelFreq)
    }

    const fftEndTime = performance.now()

    return frequencies
  }

  private async renderSegment(segment: FrequencySegment) {
    const segmentWidth = segment.endPixel - segment.startPixel
    const totalHeight = this.height * segment.frequencies.length

    // Create canvas for this segment
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(segmentWidth)
    canvas.height = Math.round(totalHeight)
    canvas.style.position = 'absolute'
    canvas.style.left = `${segment.startPixel}px`
    canvas.style.top = '0'
    canvas.style.width = `${segmentWidth}px`
    canvas.style.height = `${totalHeight}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get frequency scaling parameters like the normal plugin
    const freqFrom = this.buffer?.sampleRate ? this.buffer.sampleRate / 2 : 0
    const freqMin = this.frequencyMin
    const freqMax = this.frequencyMax || freqFrom

    // Render frequency data to canvas with proper scaling
    for (let c = 0; c < segment.frequencies.length; c++) {
      await this.renderChannelToCanvas(
        segment.frequencies[c],
        ctx,
        segmentWidth,
        this.height,
        c * this.height,
        freqFrom,
        freqMin,
        freqMax,
      )
    }

    // Remove old canvas if this segment was previously rendered
    if (segment.canvas) {
      segment.canvas.remove()
    }

    // Add canvas to container
    segment.canvas = canvas
    this.canvasContainer.appendChild(canvas)
  }

  private async renderChannelToCanvas(
    channelFreq: Uint8Array[],
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    yOffset: number,
    freqFrom: number,
    freqMin: number,
    freqMax: number,
  ) {
    if (channelFreq.length === 0) return

    const freqBins = channelFreq[0].length
    const imageData = new ImageData(channelFreq.length, freqBins)
    const data = imageData.data

    // Fill image data
    for (let i = 0; i < channelFreq.length; i++) {
      const column = channelFreq[i]
      for (let j = 0; j < freqBins; j++) {
        const colorIndex = Math.min(255, Math.max(0, column[j]))
        const color = this.colorMap[colorIndex]
        const pixelIndex = ((freqBins - j - 1) * channelFreq.length + i) * 4

        data[pixelIndex] = color[0] * 255
        data[pixelIndex + 1] = color[1] * 255
        data[pixelIndex + 2] = color[2] * 255
        data[pixelIndex + 3] = color[3] * 255
      }
    }

    // Calculate frequency scaling like the normal plugin
    const rMin = hzToScale(freqMin, this.scale) / hzToScale(freqFrom, this.scale)
    const rMax = hzToScale(freqMax, this.scale) / hzToScale(freqFrom, this.scale)
    const rMax1 = Math.min(1, rMax)

    // Use the same frequency scaling approach as the regular spectrogram plugin
    const drawHeight = (height * rMax1) / rMax
    const drawY = yOffset + height * (1 - rMax1 / rMax)
    const bitmapSourceY = Math.round(freqBins * (1 - rMax1))
    const bitmapSourceHeight = Math.round(freqBins * (rMax1 - rMin))

    // Create and draw bitmap with proper frequency scaling
    const bitmap = await createImageBitmap(imageData, 0, bitmapSourceY, channelFreq.length, bitmapSourceHeight)

    ctx.drawImage(bitmap, 0, drawY, width, drawHeight)

    // Clean up
    if ('close' in bitmap) {
      bitmap.close()
    }
  }

  private clearAllSegments() {
    for (const segment of this.segments.values()) {
      if (segment.canvas) {
        segment.canvas.remove()
      }
    }
    this.segments.clear()
  }

  private getFilterBank(sampleRate: number) {
    const fftLength = this.fftSize ?? this.fftSamples
    const numFilters = fftLength / 2
    return createSparseFilterBankForScale(this.scale, numFilters, fftLength, sampleRate)
  }

  private _onWrapperClick = (e: MouseEvent) => {
    const rect = this.wrapper.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const relativeWidth = rect.width
    const relativePosition = relativeX / relativeWidth
    this.emit('click', relativePosition)
  }

  private freqType(freq: number) {
    return freq >= 1000 ? (freq / 1000).toFixed(1) : Math.round(freq)
  }

  private unitType(freq: number) {
    return freq >= 1000 ? 'kHz' : 'Hz'
  }

  private getLabelFrequency(index: number, labelIndex: number) {
    const scaleMin = hzToScale(this.frequencyMin, this.scale)
    const scaleMax = hzToScale(this.frequencyMax, this.scale)
    return scaleToHz(scaleMin + (index / labelIndex) * (scaleMax - scaleMin), this.scale)
  }

  private loadLabels(
    bgFill?: string,
    fontSizeFreq?: string,
    fontSizeUnit?: string,
    fontType?: string,
    textColorFreq?: string,
    textColorUnit?: string,
    textAlign?: string,
    container?: string,
    channels?: number,
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

    // prepare canvas element for labels
    const ctx = this.labelsEl.getContext('2d')
    if (!ctx) {
      return
    }
    const dispScale = window.devicePixelRatio
    this.labelsEl.height = this.height * channels * dispScale
    this.labelsEl.width = bgWidth * dispScale
    ctx.scale(dispScale, dispScale)

    for (let c = 0; c < channels; c++) {
      // for each channel
      // fill background
      ctx.fillStyle = bgFill
      ctx.fillRect(0, c * getMaxY, bgWidth, (1 + c) * getMaxY)
      ctx.fill()
      let i

      // render labels
      for (i = 0; i <= labelIndex; i++) {
        ctx.textAlign = textAlign as CanvasTextAlign
        ctx.textBaseline = 'middle'

        const freq = this.getLabelFrequency(i, labelIndex)
        const label = this.freqType(freq)
        const units = this.unitType(freq)
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
        ctx.fillText(label.toString(), x, y)
      }
    }
  }

  async render(audioData: AudioBuffer) {
    this.buffer = audioData
    this.pixelsPerSecond = this.getPixelsPerSecond()
    this.frequencyMax = this.frequencyMax || audioData.sampleRate / 2

    // Set wrapper height
    const channels = this.options.splitChannels ? audioData.numberOfChannels : 1
    this.wrapper.style.height = this.height * channels + 'px'

    // Clear existing data and reset progressive loading
    this.clearAllSegments()
    this.nextProgressiveSegmentTime = 0

    // Render frequency labels if enabled
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
        channels,
      )
    }

    // Start initial render
    this.scheduleRender()
    this.emit('ready')
  }

  destroy() {
    this.unAll()

    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
      this.renderTimeout = null
    }

    if (this.qualityUpdateTimeout) {
      clearTimeout(this.qualityUpdateTimeout)
      this.qualityUpdateTimeout = null
    }

    // Stop progressive loading
    this.stopProgressiveLoading()
    this.nextProgressiveSegmentTime = 0

    // Clean up worker and any pending worker promises
    this.disposeWorker(new Error('Plugin destroyed'))

    this.clearAllSegments()

    // Clean up DOM elements properly
    if (this.canvasContainer) {
      this.canvasContainer.remove()
      this.canvasContainer = null
    }
    if (this.wrapper) {
      this.wrapper.remove()
      this.wrapper = null
    }
    if (this.labelsEl) {
      this.labelsEl.remove()
      this.labelsEl = null
    }

    // Reset state for potential re-initialization
    this.container = null
    this.buffer = null
    this.fft = null
    this.isRendering = false
    this.currentPosition = 0
    this.pixelsPerSecond = 0

    super.destroy()
  }

  // Add width calculation methods like the normal plugin
  private getWidth() {
    return this.wavesurfer?.getWrapper()?.offsetWidth || 0
  }

  private getPixelsPerSecond() {
    // Handle default case when no zoom is specified
    const minPxPerSec = this.wavesurfer?.options.minPxPerSec
    if (minPxPerSec && minPxPerSec > 0) {
      return minPxPerSec
    }

    // For windowed mode, enforce a minimum zoom level so we never try to fit entire audio on screen
    const WINDOWED_MIN_PX_PER_SEC = 50 // At least 50 pixels per second for windowed mode

    // Fallback: calculate based on wrapper width and audio duration
    if (this.buffer) {
      const wrapperWidth = this.getWidth()
      const calculatedPxPerSec = wrapperWidth > 0 ? wrapperWidth / this.buffer.duration : 100

      // For windowed mode, we want to show only a small portion of audio at a time
      // Use the maximum of calculated value and our minimum to ensure reasonable zoom
      const finalPxPerSec = Math.max(calculatedPxPerSec, WINDOWED_MIN_PX_PER_SEC)

      return finalPxPerSec
    }

    return WINDOWED_MIN_PX_PER_SEC
  }

  /** Stop progressive loading if it's currently running */
  public stopProgressiveLoading() {
    this.isProgressiveLoading = false
    if (this.progressiveLoadTimeout) {
      clearTimeout(this.progressiveLoadTimeout)
      this.progressiveLoadTimeout = null
    }
  }

  /** Restart progressive loading from the beginning */
  public restartProgressiveLoading() {
    this.stopProgressiveLoading()
    this.nextProgressiveSegmentTime = 0
    if (this.progressiveLoading) {
      this.startProgressiveLoading()
    }
  }
}

export default WindowedSpectrogramPlugin
