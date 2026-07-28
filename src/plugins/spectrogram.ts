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

// Only the shared, display-oriented FFT utilities are needed here now - the actual FFT/filter-bank/
// autoGain loop lives in computeFrequencies (spectrogram-frequencies.ts), which this file delegates to.
import {
  hzToScale,
  setupColorMap,
  getLabelFrequency,
  freqType,
  unitType,
  createWrapperClickHandler,
  AUTO_GAIN_BUFFER_BUDGET_BYTES,
} from '../fft.js'
import { computeFrequencies, type FrequencyParams } from '../spectrogram-frequencies.js'

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
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

const MAX_NODES = 10

type WorkerRequest = { resolve: (value: Uint8Array[][]) => void; reject: (reason: unknown) => void; timer?: ReturnType<typeof setTimeout> }
type WorkerFrequenciesMessage = { type: string; id: string; result?: Uint8Array[][]; error?: string }

/**
 * Test-only introspection/poking surface. The pre-port class exposed all of this as plain
 * instance fields, which the existing spectrogram unit test suite (predating this port) pokes
 * directly via `(plugin as any).field`. Closure-based setup() state isn't reachable that way -
 * `Object.assign(this, api)` (see define-plugin.ts) copies each Api value ONCE, at init time, so
 * a plain returned field would go stale the moment the closure reassigns it. This object is
 * created once per setup() run and its getters/setters read/write the actual closure variables
 * live, so `plugin.__testInternals().buffer = x` and later reads of the same call still observe
 * the plugin's real internal state. Not part of the plugin's public contract - do not use outside
 * tests.
 */
type TestInternals = {
  buffer: AudioBuffer | null
  readonly worker: Worker | null
  readonly workerPromises: Map<string, WorkerRequest>
  readonly cachedFrequencies: Uint8Array[][] | null
  readonly cachedBuffer: AudioBuffer | null
  readonly canvasContainer: HTMLElement
  readonly canvases: HTMLCanvasElement[]
  readonly drawnCanvases: Record<number, boolean>
  readonly maxCanvasWidth: number
  autoGainBudgetBytes: number
  getFrequencies: (buffer: AudioBuffer) => Promise<Uint8Array[][]>
  calculateFrequenciesWithWorker: (buffer: AudioBuffer) => Promise<Uint8Array[][]>
  drawSpectrogram: (frequenciesData: Uint8Array[][]) => void
}

type Api = {
  /** Fetch pre-computed spectrogram JSON data from a URL and render it. */
  loadFrequenciesData: (url: string | URL) => Promise<void>
  /** Get the current frequency data, computing (and caching) it from the decoded audio if needed. */
  getFrequenciesData: () => Promise<Uint8Array[][] | null>
  /** Clear cached frequency data to force recalculation. */
  clearCache: () => void
  /** @internal test-only, see TestInternals */
  __testInternals: () => TestInternals
}

const SpectrogramPlugin = definePlugin<SpectrogramPluginOptions, SpectrogramPluginEvents, Api>(
  'SpectrogramPlugin',
  (ctx, rawOptions) => {
    // setup() runs once per (re-)init, on a fresh scope - see define-plugin.ts. All the pre-port
    // class's constructor validation now lives here rather than in a constructor, since
    // definePlugin has no per-plugin constructor hook: it only runs (and can only throw) once the
    // plugin is registered with a wavesurfer instance, not at `.create()` time. This is a
    // deliberate, documented behavior change from the pre-port class (see task-2-report.md).
    const options: SpectrogramPluginOptions = rawOptions ?? {}

    const frequenciesDataUrl = options.frequenciesDataUrl
    if (frequenciesDataUrl && !options.sampleRate) {
      throw new Error('sampleRate option is required when using frequenciesDataUrl')
    }

    const useWebWorker = options.useWebWorker === true
    const workerTimeout = options.workerTimeout ?? 30000
    const fallbackToMainThread = options.fallbackToMainThread ?? true

    const colorMap = setupColorMap(options.colorMap)

    const fftSize = options.fftSize
    // With fftSize set, fftSamples is a validated analysis-window length: only absent values get
    // the default. Without it, the historical coercion of falsy values is preserved.
    const fftSamples = fftSize != null ? (options.fftSamples ?? 512) : options.fftSamples || 512
    const height = options.height || 200
    // Will be calculated later based on canvas size when not set
    let noverlap: number | null = options.noverlap || null

    // The transform length must be a power of two; with fftSize set, fftSamples is just the
    // analysis window length and only needs to fit inside the transform
    const fftLength = fftSize ?? fftSamples
    if (!isPowerOfTwo(fftLength)) {
      throw new TypeError(
        `fftSize (or fftSamples when fftSize is not set) must be a power of two and at least 2, got ${fftLength}`,
      )
    }
    if (fftSize != null && (!Number.isInteger(fftSamples) || fftSamples < 2 || fftSamples > fftSize)) {
      throw new TypeError(`fftSamples must be an integer between 2 and fftSize, got ${fftSamples}`)
    }
    if (options.noverlap != null && !Number.isInteger(options.noverlap)) {
      throw new TypeError(`noverlap must be an integer number of samples, got ${options.noverlap}`)
    }
    const windowFunc = options.windowFunc || 'hann'
    const alpha = options.alpha

    // Getting file's original samplerate is difficult(#1248).
    // So set 12kHz default to render like wavesurfer.js 5.x.
    let frequencyMin = options.frequencyMin || 0
    let frequencyMax = options.frequencyMax || 0

    const gainDB = options.gainDB ?? 20
    const rangeDB = options.rangeDB ?? 80
    const scale = options.scale || 'mel'
    const preEmphasis = options.preEmphasis ?? 0
    const autoGain = options.autoGain ?? false
    // Per-instance override of the autoGain transient-memory budget (used by tests via
    // __testInternals().autoGainBudgetBytes).
    let autoGainBudgetBytes = AUTO_GAIN_BUFFER_BUDGET_BYTES

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
      if (windowFunc === 'gauss' && options.alpha <= 0) {
        throw new TypeError(`alpha must be positive for the gauss window, got ${options.alpha}`)
      }
    }

    const maxCanvasWidth = options.maxCanvasWidth || 30000

    // ---- Mutable render/cache/worker state (closure-owned, replaces the pre-port instance fields) ----
    let buffer: AudioBuffer | null = null
    let worker: Worker | null = null
    let workerConstructionFailed = false
    const workerPromises = new Map<string, WorkerRequest>()

    let cachedFrequencies: Uint8Array[][] | null = null
    let cachedResampledData: Uint8Array[][] | null = null
    let cachedBuffer: AudioBuffer | null = null
    let cachedWidth = 0
    let cancelPendingRender: (() => void) | null = null
    let isRendering = false
    let lastZoomLevel = 0
    const renderThrottleMs = 50 // Reduced frequency for better performance
    const zoomThreshold = 0.05 // More sensitive zoom detection
    let drawnCanvases: Record<number, boolean> = {}
    let canvases: HTMLCanvasElement[] = []
    const pendingBitmaps = new Set<Promise<ImageBitmap>>()
    let scrollUnsubscribe: (() => void) | null = null

    // ---- DOM ----
    const wrapper = createElement('div', {
      style: {
        display: 'block',
        position: 'relative',
        userSelect: 'none',
      },
    })

    let labelsEl: HTMLCanvasElement | null = null
    if (options.labels) {
      // createElement's return type isn't narrowed by the tagName string literal ('canvas' vs
      // 'div' etc. are indistinguishable to its `string` parameter type), so it always returns
      // HTMLElement; cast to the concrete DOM type actually produced.
      labelsEl = createElement(
        'canvas',
        {
          part: 'spec-labels',
          style: {
            position: 'absolute',
            zIndex: '9',
            width: '55px',
            height: '100%',
          },
        },
        wrapper,
      ) as HTMLCanvasElement
    }

    const onWrapperClick = createWrapperClickHandler(
      wrapper,
      // createWrapperClickHandler is shared with spectrogram-windowed.ts and is intentionally
      // loosely typed (event: string, ...args: any[]); here it only ever emits 'click' with a
      // single relativeX number, matching SpectrogramPluginEvents.
      ctx.emit as (event: string, ...args: any[]) => void,
    )
    wrapper.addEventListener('click', onWrapperClick)
    ctx.scope.add(() => wrapper.removeEventListener('click', onWrapperClick))

    const canvasContainer = createElement(
      'div',
      {
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: '100%',
          zIndex: '4',
        },
      },
      wrapper,
    )

    function createSingleCanvas(width: number, height: number, offset: number): HTMLCanvasElement {
      // See the labelsEl cast above for why this cast is needed.
      const canvas = createElement('canvas', {
        style: {
          position: 'absolute',
          left: `${Math.round(offset)}px`,
          top: '0',
          width: `${width}px`,
          height: `${height}px`,
          zIndex: '4',
        },
      }) as HTMLCanvasElement

      canvas.width = Math.round(width)
      canvas.height = Math.round(height)

      canvasContainer.appendChild(canvas)
      return canvas
    }

    function clearCanvases(): void {
      canvases.forEach((canvas) => canvas.remove())
      canvases = []
      drawnCanvases = {}
    }

    function clearExcessCanvases(): void {
      // Clear canvases to avoid too many DOM nodes
      if (Object.keys(drawnCanvases).length > MAX_NODES) {
        clearCanvases()
      }
    }

    function getWidth(): number {
      return ctx.wavesurfer.getWrapper().offsetWidth
    }

    function getWrapperWidth(): number {
      return ctx.wavesurfer?.getWrapper()?.clientWidth || 0
    }

    // Terminate the worker and reject in-flight requests so callers fall back to the main thread
    // immediately instead of waiting out the worker timeout (or hanging when it is disabled)
    function disposeWorker(error: Error): void {
      if (worker) {
        worker.terminate()
        worker = null
      }
      workerPromises.forEach((promise) => {
        if (promise.timer) clearTimeout(promise.timer)
        promise.reject(error)
      })
      workerPromises.clear()
    }

    function initializeWorker(): void {
      // Skip worker initialization in SSR environments (Next.js server-side)
      if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        console.warn('Worker not available in this environment, using main thread calculation')
        return
      }

      try {
        // Create worker using imported worker constructor
        worker = new SpectrogramWorker()

        worker.onmessage = (e: MessageEvent<WorkerFrequenciesMessage>) => {
          const { type, id, result, error } = e.data

          if (type === 'frequenciesResult') {
            const promise = workerPromises.get(id)
            if (promise) {
              workerPromises.delete(id)
              if (promise.timer) clearTimeout(promise.timer)
              if (error) {
                promise.reject(new Error(error))
              } else {
                // The worker protocol guarantees exactly one of result/error is set
                promise.resolve(result as Uint8Array[][])
              }
            }
          }
        }

        worker.onerror = (error: ErrorEvent) => {
          console.warn('Spectrogram worker error, falling back to main thread:', error)
          disposeWorker(new Error('Worker error'))
        }

        worker.onmessageerror = (event: MessageEvent) => {
          console.warn('Spectrogram worker message error, falling back to main thread:', event)
          disposeWorker(new Error('Worker message error'))
        }
      } catch (error) {
        console.warn('Failed to initialize worker, falling back to main thread:', error)
        worker = null
        // Construction failure (e.g. CSP worker-src denial) is permanent for this environment:
        // latch it so computations don't retry it, unlike runtime failures of a live worker
        workerConstructionFailed = true
      }
    }

    async function calculateFrequenciesWithWorker(audioBuffer: AudioBuffer): Promise<Uint8Array[][]> {
      if (!worker) {
        throw new Error('Worker not available')
      }
      // Narrow to a local const: TS can't prove `worker` stays non-null inside the Promise
      // executor below (it's a mutable closure variable), and this avoids a non-null assertion.
      const activeWorker = worker

      const channels = (options.splitChannels ?? ctx.wavesurfer?.options.splitChannels) ? audioBuffer.numberOfChannels : 1

      // Calculate noverlap
      let requestNoverlap = noverlap
      if (!requestNoverlap) {
        const totalWidth = getWidth()
        const uniqueSamplesPerPx = audioBuffer.length / totalWidth
        requestNoverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx))
      }

      // Prepare audio data for worker
      const audioData: Float32Array[] = []
      for (let c = 0; c < channels; c++) {
        audioData.push(audioBuffer.getChannelData(c))
      }

      // Generate unique ID for this request
      const id = `${Date.now()}_${Math.random()}`

      // Create promise for worker response
      return new Promise<Uint8Array[][]>((resolve, reject) => {
        // Set timeout to avoid hanging; workerTimeout === 0 disables it
        const timer =
          workerTimeout > 0
            ? setTimeout(() => {
                if (workerPromises.has(id)) {
                  // A timed-out result can never be consumed (its id is dropped), so dispose
                  // the worker too: this stops the abandoned computation and lets the next
                  // render start a fresh worker instead of queueing behind a stuck one
                  disposeWorker(new Error('Worker timeout'))
                }
              }, workerTimeout)
            : undefined
        workerPromises.set(id, { resolve, reject, timer })

        // Send message to worker; if dispatch fails synchronously, settle and clean up immediately
        try {
          activeWorker.postMessage({
            type: 'calculateFrequencies',
            id,
            audioData,
            options: {
              startTime: 0,
              endTime: audioBuffer.duration,
              sampleRate: audioBuffer.sampleRate,
              fftSamples,
              fftSize,
              windowFunc,
              alpha,
              noverlap: requestNoverlap,
              scale,
              gainDB,
              rangeDB,
              preEmphasis,
              autoGain,
              autoGainBufferBudgetBytes: autoGainBudgetBytes,
              splitChannels: options.splitChannels || false,
            },
          })
        } catch (error) {
          if (timer) clearTimeout(timer)
          workerPromises.delete(id)
          reject(error)
        }
      })
    }

    async function getFrequencies(audioBuffer: AudioBuffer): Promise<Uint8Array[][]> {
      frequencyMax = frequencyMax || audioBuffer.sampleRate / 2
      buffer = audioBuffer

      // Use worker if enabled and available; a worker disposed after a runtime failure is
      // re-created on the next computation (construction failures are latched as permanent)
      if (useWebWorker && !worker && !workerConstructionFailed && typeof Worker !== 'undefined') {
        initializeWorker()
      }
      if (useWebWorker && worker) {
        try {
          return await calculateFrequenciesWithWorker(audioBuffer)
        } catch (error) {
          if (ctx.scope.disposed) return []

          if (!fallbackToMainThread) {
            // Surface the failure instead of silently recomputing on the main thread, which
            // can freeze the page for long files
            ctx.emit('error', error instanceof Error ? error : new Error(String(error)))
            return []
          }
          console.warn('Worker calculation failed, falling back to main thread:', error)
          // Fall through to main thread calculation
        }
      }

      const channels = (options.splitChannels ?? ctx.wavesurfer?.options.splitChannels) ? audioBuffer.numberOfChannels : 1

      // Calculate noverlap (same logic as worker for consistency)
      let mainThreadNoverlap = noverlap
      if (!mainThreadNoverlap) {
        const totalWidth = getWidth()
        const uniqueSamplesPerPx = audioBuffer.length / totalWidth
        mainThreadNoverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx))
      }

      const channelData: Float32Array[] = []
      for (let c = 0; c < channels; c++) {
        channelData.push(audioBuffer.getChannelData(c))
      }

      const params: FrequencyParams = {
        fftSamples,
        fftSize,
        windowFunc,
        alpha,
        noverlap: mainThreadNoverlap,
        scale,
        gainDB,
        rangeDB,
        preEmphasis,
        autoGain,
        autoGainBufferBudgetBytes: autoGainBudgetBytes,
        sampleRate: audioBuffer.sampleRate,
      }
      return computeFrequencies(channelData, params)
    }

    async function loadFrequenciesData(url: string | URL): Promise<void> {
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error('Unable to fetch frequencies data')
      }
      const data = await resp.json()
      if (ctx.scope.disposed) return
      // frequenciesDataUrl's contract (see SpectrogramPluginOptions.frequenciesDataUrl) is that
      // the JSON already IS a Uint8Array[][]-shaped nested array; parsed JSON can only ever
      // produce plain number arrays (never real Uint8Array instances), but every consumer below
      // only relies on indexing/length/iteration, which plain arrays support identically. Not
      // runtime-validated, matching the pre-port behavior.
      drawSpectrogram(data as Uint8Array[][])
    }

    async function getFrequenciesData(): Promise<Uint8Array[][] | null> {
      const decodedData = ctx.wavesurfer?.getDecodedData()
      if (!decodedData) {
        return null
      }

      if (cachedBuffer === decodedData && cachedFrequencies) {
        // Check if we can use cached frequencies
        return cachedFrequencies
      } else {
        // Calculate new frequencies and cache them; a failed computation (empty result)
        // is not cached so the next render retries
        const frequencies = await getFrequencies(decodedData)
        if (frequencies.length > 0) {
          cachedFrequencies = frequencies
          cachedBuffer = decodedData
        } else if (cachedBuffer && cachedBuffer !== decodedData) {
          // The buffer changed and its computation failed: drop the previous buffer's data so
          // nothing stale can be drawn against the new audio
          clearCache()
        }
        return frequencies
      }
    }

    /** Clear cached frequency data to force recalculation */
    function clearCache(): void {
      cachedFrequencies = null
      cachedResampledData = null
      cachedBuffer = null
      cachedWidth = 0
      lastZoomLevel = 0
    }

    function throttledRender(): void {
      // Clear any pending render
      cancelPendingRender?.()

      // Skip if already rendering
      if (isRendering) {
        return
      }

      // Check if zoom level changed significantly
      const currentZoom = ctx.wavesurfer?.options.minPxPerSec || 0
      const zoomDiff = Math.abs(currentZoom - lastZoomLevel) / Math.max(currentZoom, lastZoomLevel, 1)

      if (zoomDiff < zoomThreshold && cachedFrequencies) {
        // Small zoom change - just re-render with cached data
        cancelPendingRender = ctx.scope.timeout(() => {
          cancelPendingRender = null
          fastRender()
        }, renderThrottleMs)
      } else {
        // Significant zoom change - full re-render
        cancelPendingRender = ctx.scope.timeout(() => {
          cancelPendingRender = null
          void render()
        }, renderThrottleMs)
      }
    }

    async function render(): Promise<void> {
      if (isRendering) return
      isRendering = true

      try {
        if (frequenciesDataUrl) {
          await loadFrequenciesData(frequenciesDataUrl)
        } else {
          const decodedData = ctx.wavesurfer?.getDecodedData()
          if (decodedData) {
            const frequencies = await getFrequenciesData()
            if (ctx.scope.disposed || !frequencies) return
            // Draw what this render computed (cache hit, fresh data, or empty on failure)
            // rather than whatever the cache field holds
            drawSpectrogram(frequencies)
          }
        }
        lastZoomLevel = ctx.wavesurfer?.options.minPxPerSec || 0
      } finally {
        isRendering = false
      }
    }

    function fastRender(): void {
      if (isRendering || !cachedFrequencies) return
      isRendering = true

      try {
        // Use cached frequencies for fast re-render
        drawSpectrogram(cachedFrequencies)
        lastZoomLevel = ctx.wavesurfer?.options.minPxPerSec || 0
      } finally {
        isRendering = false
      }
    }

    function drawSpectrogramSegment(
      resampledPixels: Uint8Array[],
      canvasCtx: CanvasRenderingContext2D,
      canvasWidth: number,
      segmentHeight: number,
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
      fillImageDataQuality(data, segmentPixels, segmentWidth, bitmapHeight)

      // Calculate frequency scaling
      const rMin = hzToScale(freqMin, scale) / hzToScale(freqFrom, scale)
      const rMax = hzToScale(freqMax, scale) / hzToScale(freqFrom, scale)
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
      pendingBitmaps.add(bitmapPromise)

      bitmapPromise
        .then((bitmap) => {
          // Remove from pending set
          pendingBitmaps.delete(bitmapPromise)

          try {
            // Check if canvas is still valid before drawing
            if (canvasCtx.canvas.parentNode) {
              const drawHeight = (segmentHeight * rMax1) / rMax
              const drawY = yOffset + segmentHeight * (1 - rMax1 / rMax)

              canvasCtx.drawImage(bitmap, 0, drawY, canvasWidth, drawHeight)
            }
          } finally {
            // Clean up bitmap to free memory, even if the canvas was removed before it resolved
            bitmap.close()
          }
        })
        .catch(() => {
          // Clean up on error
          pendingBitmaps.delete(bitmapPromise)
        })
    }

    // Accepts either the [channel][frame][bin] shape every internal caller produces
    // (Uint8Array[][]) or a flat single-channel [frame][bin] shape (Uint8Array[]) - only
    // reachable via loadFrequenciesData's externally-supplied JSON, see
    // SpectrogramPluginOptions.frequenciesDataUrl. Both shapes are duck-type compatible for the
    // emptiness check below (Uint8Array and Uint8Array[] both have a numeric .length).
    function drawSpectrogram(input: Uint8Array[][] | Uint8Array[]): void {
      if (!input || input.length === 0 || input.every((channel) => !channel || channel.length === 0)) {
        // Nothing to draw (failed computation, or a buffer too short for a single FFT frame):
        // remove any previously drawn canvases so no stale spectrogram stays on screen
        clearCanvases()
        return
      }
      // data is 1ch [sample, freq] format -> to [channel, sample, freq] format. The global
      // (coercing) isNaN on input[0][0] discriminates the two shapes: for the flat shape
      // input[0][0] is a raw number; for the nested shape it's a Uint8Array, which isNaN's
      // ToNumber coercion turns into NaN for any frame with more than one bin. Matches the
      // pre-port duck typing exactly.
      const frequenciesData: Uint8Array[][] = isNaN(input[0][0] as unknown as number)
        ? (input as Uint8Array[][])
        : [input as Uint8Array[]]

      // Clear existing canvases
      clearCanvases()

      // Set the height to fit all channels
      const totalHeight = height * frequenciesData.length
      wrapper.style.height = totalHeight + 'px'

      const totalWidth = getWidth()
      const perCanvasWidth = Math.min(maxCanvasWidth, totalWidth)

      // Nothing to render
      if (totalWidth === 0 || totalHeight === 0) return

      // Calculate number of canvases needed
      const numCanvases = Math.ceil(totalWidth / perCanvasWidth)

      // Smart resampling based on zoom level
      let resampledData: Uint8Array[][]
      const originalDataWidth = frequenciesData[0]?.length || 0
      const needsResampling = totalWidth !== originalDataWidth

      if (!needsResampling) {
        // At high zoom levels, use original data directly - much faster!
        resampledData = frequenciesData
      } else if (cachedResampledData && cachedWidth === totalWidth) {
        // Use cached resampled data
        resampledData = cachedResampledData
      } else {
        // Only resample when actually needed
        resampledData = efficientResample(frequenciesData, totalWidth)
        cachedResampledData = resampledData
        cachedWidth = totalWidth
      }

      // Maximum frequency represented in `frequenciesData`
      // Use buffer.sampleRate if available (from getFrequencies), otherwise use the provided sampleRate
      const freqFrom = buffer?.sampleRate ? buffer.sampleRate / 2 : (options.sampleRate || 0) / 2

      // Minimum and maximum frequency we want to draw
      const freqMin = frequencyMin
      const freqMax = frequencyMax

      // Draw background if needed
      const shouldDrawBackground = freqMax > freqFrom
      const bgColor = shouldDrawBackground ? colorMap[colorMap.length - 1] : null

      // Function to draw a single canvas
      const drawCanvas = (canvasIndex: number) => {
        if (canvasIndex < 0 || canvasIndex >= numCanvases) return
        if (drawnCanvases[canvasIndex]) return

        drawnCanvases[canvasIndex] = true

        const offset = canvasIndex * perCanvasWidth
        const canvasWidth = Math.min(perCanvasWidth, totalWidth - offset)

        if (canvasWidth <= 0) return

        const canvas = createSingleCanvas(canvasWidth, totalHeight, offset)
        canvases.push(canvas)
        const canvasCtx = canvas.getContext('2d')

        if (!canvasCtx) return

        // Draw background if needed
        if (shouldDrawBackground && bgColor) {
          canvasCtx.fillStyle = `rgba(${bgColor[0] * 255}, ${bgColor[1] * 255}, ${bgColor[2] * 255}, ${bgColor[3]})`
          canvasCtx.fillRect(0, 0, canvasWidth, totalHeight)
        }

        // Render each channel for this canvas segment
        for (let c = 0; c < resampledData.length; c++) {
          drawSpectrogramSegment(
            resampledData[c],
            canvasCtx,
            canvasWidth,
            height,
            c * height,
            offset,
            totalWidth,
            freqFrom,
            freqMin,
            freqMax,
          )
        }
      }

      // Store rendering parameters for lazy loading
      const isScrollable = totalWidth > getWrapperWidth()

      // Clear previous scroll listener
      scrollUnsubscribe?.()
      scrollUnsubscribe = null

      if (!isScrollable || numCanvases <= 3) {
        // Draw all canvases if not scrollable or few canvases
        for (let i = 0; i < numCanvases; i++) {
          drawCanvas(i)
        }
      } else {
        // Implement lazy rendering with scroll listener
        const renderVisibleCanvases = () => {
          const wsWrapper = ctx.wavesurfer?.getWrapper()
          if (!wsWrapper) return

          const scrollLeft = wsWrapper.scrollLeft || 0
          const containerWidth = wsWrapper.clientWidth || 0

          // Calculate visible range with some buffer
          const bufferRatio = 0.5 // Render 50% extra on each side
          const visibleStart = Math.max(0, scrollLeft - containerWidth * bufferRatio)
          const visibleEnd = Math.min(totalWidth, scrollLeft + containerWidth * (1 + bufferRatio))

          const startCanvasIndex = Math.floor((visibleStart / totalWidth) * numCanvases)
          const endCanvasIndex = Math.min(Math.ceil((visibleEnd / totalWidth) * numCanvases), numCanvases - 1)

          // Clear excess canvases if we have too many
          if (Object.keys(drawnCanvases).length > MAX_NODES) {
            clearExcessCanvases()
          }

          // Draw visible canvases
          for (let i = startCanvasIndex; i <= endCanvasIndex; i++) {
            drawCanvas(i)
          }
        }

        // Initial render of visible canvases
        renderVisibleCanvases()

        // Set up scroll listener for lazy loading
        let scrollTimeout: ReturnType<typeof setTimeout> | null = null
        const onScroll = () => {
          if (scrollTimeout) clearTimeout(scrollTimeout)
          scrollTimeout = setTimeout(renderVisibleCanvases, 16) // 60fps
        }

        const wsWrapper = ctx.wavesurfer?.getWrapper()
        if (wsWrapper) {
          wsWrapper.addEventListener('scroll', onScroll, { passive: true })
          scrollUnsubscribe = () => {
            wsWrapper.removeEventListener('scroll', onScroll)
            if (scrollTimeout) clearTimeout(scrollTimeout)
          }
        }
      }

      if (options.labels) {
        loadLabels(
          options.labelsBackground,
          '12px',
          '12px',
          '',
          options.labelsColor,
          options.labelsHzColor || options.labelsColor,
          'center',
          frequenciesData.length,
        )
      }

      ctx.emit('ready')
    }

    function loadLabels(
      bgFill: string | undefined,
      fontSizeFreq: string,
      fontSizeUnit: string,
      fontType: string,
      textColorFreq: string | undefined,
      textColorUnit: string | undefined,
      textAlign: CanvasTextAlign,
      channels: number,
    ): void {
      if (!labelsEl) return

      const frequenciesHeight = height
      bgFill = bgFill || 'rgba(68,68,68,0)'
      fontSizeFreq = fontSizeFreq || '12px'
      fontSizeUnit = fontSizeUnit || '12px'
      fontType = fontType || 'Helvetica'
      textColorFreq = textColorFreq || '#fff'
      textColorUnit = textColorUnit || '#fff'
      textAlign = textAlign || 'center'
      const bgWidth = 55
      const getMaxY = frequenciesHeight || 512
      const labelIndex = 5 * (getMaxY / 256)

      // prepare canvas element for labels
      const canvasCtx = labelsEl.getContext('2d')
      if (!canvasCtx) return
      const dispScale = window.devicePixelRatio
      labelsEl.height = height * channels * dispScale
      labelsEl.width = bgWidth * dispScale
      canvasCtx.scale(dispScale, dispScale)

      for (let c = 0; c < channels; c++) {
        // for each channel
        // fill background
        canvasCtx.fillStyle = bgFill
        canvasCtx.fillRect(0, c * getMaxY, bgWidth, (1 + c) * getMaxY)
        canvasCtx.fill()

        // render labels
        for (let i = 0; i <= labelIndex; i++) {
          canvasCtx.textAlign = textAlign
          canvasCtx.textBaseline = 'middle'

          const freq = getLabelFrequency(i, labelIndex, frequencyMin, frequencyMax, scale)
          const label = freqType(freq)
          const units = unitType(freq)
          const x = 16
          let y = (1 + c) * getMaxY - (i / labelIndex) * getMaxY

          // Make sure label remains in view
          y = Math.min(Math.max(y, c * getMaxY + 10), (1 + c) * getMaxY - 10)

          // unit label
          canvasCtx.fillStyle = textColorUnit
          canvasCtx.font = fontSizeUnit + ' ' + fontType
          canvasCtx.fillText(units, x + 24, y)
          // freq label
          canvasCtx.fillStyle = textColorFreq
          canvasCtx.font = fontSizeFreq + ' ' + fontType
          canvasCtx.fillText(label, x, y)
        }
      }
    }

    function resampleChannel(oldMatrix: Uint8Array[], targetWidth: number): Uint8Array[] {
      const oldColumns = oldMatrix.length
      const freqBins = oldMatrix[0]?.length || 0

      // Fast path for no resampling needed
      if (oldColumns === targetWidth || targetWidth === 0) {
        return oldMatrix
      }

      const ratio = oldColumns / targetWidth

      // Always use quality resampling for accurate spectrograms
      const newMatrix: Uint8Array[] = new Array(targetWidth)

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

    function efficientResample(frequenciesData: Uint8Array[][], targetWidth: number): Uint8Array[][] {
      return frequenciesData.map((channelFreq) => resampleChannel(channelFreq, targetWidth))
    }

    function fillImageDataQuality(
      data: Uint8ClampedArray,
      segmentPixels: Uint8Array[],
      segmentWidth: number,
      bitmapHeight: number,
    ): void {
      // High quality rendering - process all pixels
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

    // ---- Wire up to wavesurfer (replaces the pre-port onInit()) ----
    let container: HTMLElement | null = null
    if (options.container) {
      if (typeof options.container === 'string') {
        const el = document.querySelector(options.container)
        if (el instanceof HTMLElement) {
          container = el
        }
      } else if (isHTMLElement(options.container)) {
        container = options.container
      }
    }
    if (!container) {
      container = ctx.wavesurfer.getWrapper()
    }
    container.appendChild(wrapper)
    ctx.scope.add(() => wrapper.remove())
    ctx.scope.add(() => canvasContainer.remove())
    ctx.scope.add(() => labelsEl?.remove())

    if (ctx.wavesurfer.options.fillParent) {
      Object.assign(wrapper.style, {
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'hidden',
      })
    }

    ctx.scope.add(ctx.wavesurfer.on('redraw', () => throttledRender()))

    // Trigger initial render after init. This ensures the spectrogram appears even if no redraw
    // event is fired.
    if (ctx.wavesurfer.getDecodedData()) {
      ctx.scope.timeout(() => throttledRender(), 0)
    }

    // Initialize worker if enabled
    if (useWebWorker) {
      initializeWorker()
    }

    // ---- Teardown (replaces the pre-port destroy() override) ----
    ctx.scope.add(() => {
      // Cancel pending bitmap operations
      pendingBitmaps.clear()

      // Clean up worker, rejecting any in-flight requests
      disposeWorker(new Error('Spectrogram plugin destroyed'))

      // Release the decoded buffer and caches
      cachedFrequencies = null
      cachedResampledData = null
      cachedBuffer = null
      buffer = null

      // Clean up scroll listener
      scrollUnsubscribe?.()
      scrollUnsubscribe = null

      clearCanvases()
    })

    const testInternals: TestInternals = {
      get buffer() {
        return buffer
      },
      set buffer(value: AudioBuffer | null) {
        buffer = value
      },
      get worker() {
        return worker
      },
      get workerPromises() {
        return workerPromises
      },
      get cachedFrequencies() {
        return cachedFrequencies
      },
      get cachedBuffer() {
        return cachedBuffer
      },
      get canvasContainer() {
        return canvasContainer
      },
      get canvases() {
        return canvases
      },
      get drawnCanvases() {
        return drawnCanvases
      },
      get maxCanvasWidth() {
        return maxCanvasWidth
      },
      get autoGainBudgetBytes() {
        return autoGainBudgetBytes
      },
      set autoGainBudgetBytes(value: number) {
        autoGainBudgetBytes = value
      },
      getFrequencies,
      calculateFrequenciesWithWorker,
      drawSpectrogram,
    }

    return {
      loadFrequenciesData,
      getFrequenciesData,
      clearCache,
      __testInternals: () => testInternals,
    }
  },
)

export default SpectrogramPlugin
