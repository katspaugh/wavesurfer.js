/**
 * Segment manager for windowed spectrogram rendering.
 *
 * Extracted from the pre-unification `spectrogram-windowed.ts` (Phase 4, Task 3): owns the
 * sliding-window segment map, LRU-ish (farthest-first) eviction, uncovered-time-range
 * detection, and progressive background loading. Consumed by two callers - the merged
 * `spectrogram.ts` when `rendering: 'windowed'`, and the deprecated `spectrogram-windowed.ts`
 * shim - both of which just wire a `SegmentManagerDeps` to their own DOM/worker/wavesurfer
 * state and otherwise share this exact logic, so the windowed rendering strategy can't drift
 * between the two entry points again.
 *
 * Deliberately host-agnostic: no direct references to `WaveSurfer`, `ctx.scope`, or the
 * worker protocol - everything environment-specific comes in through `SegmentManagerDeps`
 * (including the timer, which callers wire to `ctx.scope.timeout` so progressive-load timers
 * are torn down automatically on plugin destroy - see define-plugin.ts's Scope-ownership
 * convention). This is what makes the eviction math, uncovered-range detection, and
 * progressive scheduling unit-testable in isolation (see spectrogram-windowing.test.ts).
 */

import { hzToScale } from '../fft.js'

/** One lazily-computed slice of the sliding window's frequency data. */
export interface FrequencySegment {
  startTime: number
  endTime: number
  startPixel: number
  endPixel: number
  frequencies: Uint8Array[][]
  canvas?: HTMLCanvasElement
}

export interface TimeRange {
  start: number
  end: number
}

/** Everything SegmentManager needs from its host, injected so the class has zero DOM/wavesurfer/Scope coupling of its own. */
export interface SegmentManagerDeps {
  /** Full rendering width in CSS pixels (the wavesurfer wrapper's width). */
  getWidth(): number
  /** Current horizontal zoom, in pixels per second of audio. */
  getPixelsPerSecond(): number
  /** Decoded buffer duration in seconds, or null when no buffer is loaded yet. */
  getBufferDuration(): number | null
  /** Scroll position of the viewport, in CSS pixels. */
  getScrollLeft(): number
  /** Visible viewport width, in CSS pixels. */
  getViewportWidth(): number
  /** Compute (main thread or worker, host's choice) the frequency grid for one segment's time range. */
  computeSegmentFrequencies(startTime: number, endTime: number): Promise<Uint8Array[][]>
  /** Draw (or redraw) one segment's canvas and attach/update it in the DOM. */
  renderSegment(segment: FrequencySegment): Promise<void>
  /** Report overall loading progress, 0-1. */
  emitProgress(progress: number): void
  /** True once the host's lifecycle (plugin destroy / scope dispose) has ended. */
  isDisposed(): boolean
  /** Scope.timeout-shaped: schedule `fn` after `ms`, returning a canceller. */
  setTimer(fn: () => void, ms: number): () => void
}

export interface SegmentManagerOptions {
  /** Enable progressive background loading of the whole buffer (default: false). */
  progressiveLoading?: boolean
  /** Cap on retained segments before farthest-from-view ones are evicted (default: 48). */
  maxRetainedSegments?: number
}

// Fixed-size progressive-loading segments (seconds); independent of viewport zoom, unlike
// the pixel-width-driven segments generateSegments creates for on-demand viewport rendering.
const PROGRESSIVE_SEGMENT_SECONDS = 30
// A generateSegments() call is treated as "the progressive loader asking" (fixed-size
// segments, never fill-container mode) rather than "the viewport asking" when its requested
// span is no bigger than one progressive segment plus a little slack.
const PROGRESSIVE_CALL_MAX_SPAN_SECONDS = 35
// Viewport-driven (non-fill-container) segments target this pixel width.
const VIEWPORT_SEGMENT_PIXEL_WIDTH = 15000
// Short audio (<= this many seconds, and narrower than the container) renders as one segment
// filling the whole container instead of being chopped into windowed segments.
const FILL_CONTAINER_MAX_DURATION_SECONDS = 60
const PROGRESSIVE_LOADING_START_DELAY_MS = 1000
const PROGRESSIVE_LOADING_STEP_DELAY_MS = 2000
// Buffer added on each side of the visible range when deciding what to render.
const VIEWPORT_BUFFER_MAX_SECONDS = 2
const VIEWPORT_BUFFER_FALLBACK_SECONDS = 1
const VIEWPORT_BUFFER_LARGE_VISIBLE_DURATION_SECONDS = 30

export class SegmentManager {
  readonly segments = new Map<string, FrequencySegment>()
  isProgressiveLoading = false
  nextProgressiveSegmentTime = 0
  maxRetainedSegments: number
  progressiveLoading: boolean

  private readonly deps: SegmentManagerDeps
  private cancelProgressiveTimer: (() => void) | null = null

  constructor(deps: SegmentManagerDeps, options: SegmentManagerOptions = {}) {
    this.deps = deps
    this.maxRetainedSegments = options.maxRetainedSegments ?? 48
    this.progressiveLoading = options.progressiveLoading ?? false
  }

  clearAllSegments(): void {
    for (const segment of this.segments.values()) {
      segment.canvas?.remove()
    }
    this.segments.clear()
  }

  /**
   * Evict segments whose midpoint is farthest from currentTime once the retained count
   * exceeds maxRetainedSegments, so memory usage stays bounded regardless of audio length.
   */
  evictDistantSegments(currentTime: number): void {
    if (this.segments.size <= this.maxRetainedSegments) return

    const entries = Array.from(this.segments.entries())
    // Farthest-from-currentTime first
    entries.sort((a, b) => {
      const distA = Math.abs((a[1].startTime + a[1].endTime) / 2 - currentTime)
      const distB = Math.abs((b[1].startTime + b[1].endTime) / 2 - currentTime)
      return distB - distA
    })

    const numToEvict = this.segments.size - this.maxRetainedSegments
    for (let i = 0; i < numToEvict; i++) {
      const [key, segment] = entries[i]
      segment.canvas?.remove()
      this.segments.delete(key)
    }
  }

  /** Which sub-ranges of [startTime, endTime) aren't already covered by an existing segment. */
  findUncoveredTimeRanges(startTime: number, endTime: number, _segmentDuration: number): TimeRange[] {
    const existingSegments = Array.from(this.segments.values()).sort((a, b) => a.startTime - b.startTime)

    const uncoveredRanges: TimeRange[] = []
    let currentTime = startTime

    for (const segment of existingSegments) {
      if (currentTime < segment.startTime && currentTime < endTime) {
        const gapEnd = Math.min(segment.startTime, endTime)
        uncoveredRanges.push({ start: currentTime, end: gapEnd })
      }
      currentTime = Math.max(currentTime, segment.endTime)
      if (currentTime >= endTime) break
    }

    if (currentTime < endTime) {
      uncoveredRanges.push({ start: currentTime, end: endTime })
    }

    return uncoveredRanges
  }

  /**
   * Midpoint (in seconds) of the currently visible viewport. Returns null when there's no
   * buffer loaded yet or the host can't report a zoom level, so callers have nothing sensible
   * to anchor eviction on.
   */
  getCurrentViewMidpoint(): number | null {
    if (this.deps.getBufferDuration() === null) return null
    const pixelsPerSec = this.deps.getPixelsPerSecond()
    if (!pixelsPerSec) return null

    const scrollLeft = this.deps.getScrollLeft()
    const viewportWidth = this.deps.getViewportWidth()
    const visibleStartTime = scrollLeft / pixelsPerSec
    const visibleEndTime = (scrollLeft + viewportWidth) / pixelsPerSec
    return (visibleStartTime + visibleEndTime) / 2
  }

  /** Generate (and render) segments covering any part of [startTime, endTime) not already loaded. */
  async generateSegments(startTime: number, endTime: number): Promise<void> {
    const totalAudioDuration = this.deps.getBufferDuration()
    if (totalAudioDuration === null) return

    const pixelsPerSec = this.deps.getPixelsPerSecond()
    const containerWidth = this.deps.getWidth()

    // Progressive loading always uses fixed segment sizes, never fill-container mode
    const isProgressiveLoadCall = this.isProgressiveLoading && endTime - startTime <= PROGRESSIVE_CALL_MAX_SPAN_SECONDS

    const totalAudioPixelWidth = totalAudioDuration * pixelsPerSec
    const shouldFillContainer =
      !isProgressiveLoadCall &&
      totalAudioPixelWidth <= containerWidth &&
      totalAudioDuration <= FILL_CONTAINER_MAX_DURATION_SECONDS

    let segmentDuration: number
    if (isProgressiveLoadCall) {
      // For progressive loading, respect the requested time range exactly
      segmentDuration = endTime - startTime
    } else if (shouldFillContainer) {
      // For short audio, create one segment that fills the entire container width
      segmentDuration = totalAudioDuration
    } else {
      // For long audio viewport rendering, use a fixed pixel-width windowing approach
      segmentDuration = VIEWPORT_SEGMENT_PIXEL_WIDTH / pixelsPerSec
    }

    // Check coverage first to avoid duplicate work
    const uncoveredRanges = this.findUncoveredTimeRanges(startTime, endTime, segmentDuration)
    if (uncoveredRanges.length === 0) return

    for (const range of uncoveredRanges) {
      for (let time = range.start; time < range.end; time += segmentDuration) {
        const segmentStart = time
        const segmentEnd = Math.min(time + segmentDuration, range.end, totalAudioDuration)
        const segmentKey = `${Math.floor(segmentStart * 10)}_${Math.floor(segmentEnd * 10)}`

        // Double-check if segment already exists (shouldn't happen but be safe)
        if (this.segments.has(segmentKey)) continue

        const frequencies = await this.deps.computeSegmentFrequencies(segmentStart, segmentEnd)
        if (this.deps.isDisposed()) return

        if (frequencies && frequencies.length > 0) {
          const segment: FrequencySegment = {
            startTime: segmentStart,
            endTime: segmentEnd,
            startPixel: shouldFillContainer ? 0 : segmentStart * pixelsPerSec,
            endPixel: shouldFillContainer ? containerWidth : segmentEnd * pixelsPerSec,
            frequencies,
          }

          this.segments.set(segmentKey, segment)

          await this.deps.renderSegment(segment)
          if (this.deps.isDisposed()) return

          this.deps.emitProgress(this.getLoadingProgress() / 100)
        }
      }
    }

    // Start progressive loading if not already running
    if (!this.isProgressiveLoading) {
      this.startProgressiveLoading()
    }
  }

  /** Render (generate + evict) whatever the current viewport needs, plus a small buffer on each side. */
  async renderVisibleWindow(): Promise<void> {
    const totalAudioDuration = this.deps.getBufferDuration()
    if (totalAudioDuration === null) return

    const pixelsPerSec = this.deps.getPixelsPerSecond()
    const scrollLeft = this.deps.getScrollLeft()
    const viewportWidth = this.deps.getViewportWidth()

    const visibleStartTime = scrollLeft / pixelsPerSec
    const visibleEndTime = (scrollLeft + viewportWidth) / pixelsPerSec

    const visibleDuration = visibleEndTime - visibleStartTime
    let bufferTimeSeconds = Math.min(VIEWPORT_BUFFER_MAX_SECONDS, visibleDuration * 0.5)
    if (visibleDuration > VIEWPORT_BUFFER_LARGE_VISIBLE_DURATION_SECONDS) {
      bufferTimeSeconds = VIEWPORT_BUFFER_FALLBACK_SECONDS
    }

    const windowStartTime = Math.max(0, visibleStartTime - bufferTimeSeconds)
    const windowEndTime = Math.min(totalAudioDuration, visibleEndTime + bufferTimeSeconds)

    await this.generateSegments(windowStartTime, windowEndTime)
    if (this.deps.isDisposed()) return

    // Evict segments far from the current view so memory stays bounded regardless of audio
    // length, instead of keeping every segment ever rendered
    this.evictDistantSegments(this.getCurrentViewMidpoint() ?? (windowStartTime + windowEndTime) / 2)
  }

  /** Re-position (and, on a large enough zoom change, schedule a re-render of) segments after a zoom change. */
  updateSegmentPositions(oldPxPerSec: number, newPxPerSec: number): boolean {
    for (const segment of this.segments.values()) {
      segment.startPixel = segment.startTime * newPxPerSec
      segment.endPixel = segment.endTime * newPxPerSec
      if (segment.canvas) {
        const segmentWidth = segment.endPixel - segment.startPixel
        segment.canvas.style.left = `${segment.startPixel}px`
        segment.canvas.style.width = `${segmentWidth}px`
      }
    }
    const zoomRatio = newPxPerSec / oldPxPerSec
    return zoomRatio < 0.5 || zoomRatio > 2.0
  }

  /** Re-render (at the current zoom level) whichever loaded segments overlap the visible viewport. */
  async updateVisibleSegmentQuality(): Promise<void> {
    if (this.deps.getBufferDuration() === null) return

    const pixelsPerSec = this.deps.getPixelsPerSecond()
    const scrollLeft = this.deps.getScrollLeft()
    const viewportWidth = this.deps.getViewportWidth()
    const visibleStartTime = scrollLeft / pixelsPerSec
    const visibleEndTime = (scrollLeft + viewportWidth) / pixelsPerSec

    const visibleSegments = Array.from(this.segments.values()).filter(
      (segment) => segment.startTime < visibleEndTime && segment.endTime > visibleStartTime,
    )

    for (const segment of visibleSegments) {
      if (segment.canvas) {
        await this.deps.renderSegment(segment)
        if (this.deps.isDisposed()) return
      }
    }
  }

  startProgressiveLoading(): void {
    if (this.isProgressiveLoading || this.deps.getBufferDuration() === null || !this.progressiveLoading) return

    this.isProgressiveLoading = true
    this.nextProgressiveSegmentTime = 0

    // Start loading after a short delay to not interfere with user interactions
    this.cancelProgressiveTimer?.()
    this.cancelProgressiveTimer = this.deps.setTimer(() => {
      void this.progressiveLoadNextSegment()
    }, PROGRESSIVE_LOADING_START_DELAY_MS)
  }

  async progressiveLoadNextSegment(): Promise<void> {
    const totalDuration = this.deps.getBufferDuration()
    if (totalDuration === null || !this.isProgressiveLoading) return

    if (this.nextProgressiveSegmentTime >= totalDuration) {
      this.stopProgressiveLoading()
      return
    }

    const segmentStart = this.nextProgressiveSegmentTime
    const segmentEnd = Math.min(segmentStart + PROGRESSIVE_SEGMENT_SECONDS, totalDuration)

    const segmentKey = `${Math.floor(segmentStart * 10)}_${Math.floor(segmentEnd * 10)}`
    const isAlreadyLoaded = this.segments.has(segmentKey)

    if (!isAlreadyLoaded) {
      try {
        await this.generateSegments(segmentStart, segmentEnd)
      } catch {
        this.stopProgressiveLoading()
        return
      }
    }

    // Re-check after the await: destroy() or stopProgressiveLoading() may have run while we
    // were awaiting, and must not be undone by re-arming the timer below
    if (this.deps.isDisposed() || !this.isProgressiveLoading) return

    // Background loading has no renderVisibleWindow to enforce the cap, so evict here too -
    // anchored on the current view (not the segment we just loaded) so background fill
    // doesn't push out segments near what the user is actually looking at; fall back to the
    // freshly loaded segment's own midpoint only when there's no view to anchor on
    this.evictDistantSegments(this.getCurrentViewMidpoint() ?? (segmentStart + segmentEnd) / 2)

    this.nextProgressiveSegmentTime = segmentEnd

    this.cancelProgressiveTimer = this.deps.setTimer(() => {
      void this.progressiveLoadNextSegment()
    }, PROGRESSIVE_LOADING_STEP_DELAY_MS)
  }

  stopProgressiveLoading(): void {
    this.isProgressiveLoading = false
    this.cancelProgressiveTimer?.()
    this.cancelProgressiveTimer = null
  }

  restartProgressiveLoading(): void {
    this.stopProgressiveLoading()
    this.nextProgressiveSegmentTime = 0
    if (this.progressiveLoading) {
      this.startProgressiveLoading()
    }
  }

  /** Loading progress as a percentage (0-100). */
  getLoadingProgress(): number {
    const totalDuration = this.deps.getBufferDuration()
    if (totalDuration === null) return 0
    if (totalDuration === 0) return 100
    if (!this.isProgressiveLoading && this.segments.size === 0) return 0

    const progress = Math.min(100, (this.nextProgressiveSegmentTime / totalDuration) * 100)
    if (!this.isProgressiveLoading && this.nextProgressiveSegmentTime >= totalDuration) return 100
    return progress
  }

  /** Reset all segment/progress state for a fresh render (e.g. a new buffer was loaded). */
  reset(): void {
    this.stopProgressiveLoading()
    this.clearAllSegments()
    this.nextProgressiveSegmentTime = 0
  }

  /** Tear down: stop any pending progressive-load timer. Segment/canvas cleanup is the host's job. */
  dispose(): void {
    this.stopProgressiveLoading()
  }
}

// ---- DOM/zoom helpers shared by both windowed entry points ----

/** Scroll position, in CSS pixels, of the nearest scrollable ancestor of `wrapper` (or window/document). */
export function getScrollLeft(wrapper: HTMLElement | null | undefined): number {
  if (wrapper?.scrollLeft) return wrapper.scrollLeft
  if (wrapper?.parentElement?.scrollLeft) return wrapper.parentElement.scrollLeft
  if (typeof document !== 'undefined') {
    if (document.documentElement.scrollLeft) return document.documentElement.scrollLeft
    if (document.body.scrollLeft) return document.body.scrollLeft
  }
  if (typeof window !== 'undefined') {
    if (window.scrollX) return window.scrollX
    if (window.pageXOffset) return window.pageXOffset
  }

  let element = wrapper?.parentElement ?? null
  while (element) {
    const computedStyle = window.getComputedStyle(element)
    if (computedStyle.overflowX === 'scroll' || computedStyle.overflowX === 'auto') {
      if (element.scrollLeft > 0) return element.scrollLeft
    }
    element = element.parentElement
  }

  return 0
}

/** Best-effort visible viewport width, in CSS pixels, given the wavesurfer wrapper element. */
export function getViewportWidth(wrapper: HTMLElement | null | undefined): number {
  const wrapperWidth = wrapper?.offsetWidth || wrapper?.clientWidth || 0
  const parentWidth = wrapper?.parentElement?.offsetWidth || wrapper?.parentElement?.clientWidth
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0

  if (parentWidth && parentWidth < wrapperWidth) return parentWidth
  return Math.min(wrapperWidth || 800, windowWidth * 0.8)
}

/** Windowed mode always keeps at least this many pixels per second, so it never tries to fit the whole file on screen. */
export const WINDOWED_MIN_PX_PER_SEC = 50

/** windowed rendering's zoom-level derivation: prefers the live minPxPerSec, else fits the buffer to the wrapper width, with a floor. */
export function computeWindowedPixelsPerSecond(
  minPxPerSec: number | undefined,
  bufferDuration: number | null,
  wrapperWidth: number,
): number {
  if (minPxPerSec && minPxPerSec > 0) return minPxPerSec

  if (bufferDuration) {
    const calculatedPxPerSec = wrapperWidth > 0 ? wrapperWidth / bufferDuration : 100
    return Math.max(calculatedPxPerSec, WINDOWED_MIN_PX_PER_SEC)
  }

  return WINDOWED_MIN_PX_PER_SEC
}

/** Default noverlap (in samples) for a range covering `sampleSpan` samples rendered into `pixelWidth` CSS pixels. */
export function deriveNoverlap(fftSamples: number, explicitNoverlap: number | null | undefined, sampleSpan: number, pixelWidth: number): number {
  if (explicitNoverlap) return explicitNoverlap
  const uniqueSamplesPerPx = sampleSpan / pixelWidth
  return Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx))
}

// ---- Segment canvas rendering (shared by both windowed entry points) ----

export interface SegmentRenderOptions {
  height: number
  colorMap: number[][]
  scale: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  freqFrom: number
  freqMin: number
  freqMax: number
  canvasContainer: HTMLElement
}

async function renderChannelToCanvas(
  channelFreq: Uint8Array[],
  canvasCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  yOffset: number,
  opts: SegmentRenderOptions,
): Promise<void> {
  if (channelFreq.length === 0) return

  const freqBins = channelFreq[0].length
  const imageData = new ImageData(channelFreq.length, freqBins)
  const data = imageData.data

  for (let i = 0; i < channelFreq.length; i++) {
    const column = channelFreq[i]
    for (let j = 0; j < freqBins; j++) {
      const colorIndex = Math.min(255, Math.max(0, column[j]))
      const color = opts.colorMap[colorIndex]
      const pixelIndex = ((freqBins - j - 1) * channelFreq.length + i) * 4
      data[pixelIndex] = color[0] * 255
      data[pixelIndex + 1] = color[1] * 255
      data[pixelIndex + 2] = color[2] * 255
      data[pixelIndex + 3] = color[3] * 255
    }
  }

  const rMin = hzToScale(opts.freqMin, opts.scale) / hzToScale(opts.freqFrom, opts.scale)
  const rMax = hzToScale(opts.freqMax, opts.scale) / hzToScale(opts.freqFrom, opts.scale)
  const rMax1 = Math.min(1, rMax)

  const drawHeight = (height * rMax1) / rMax
  const drawY = yOffset + height * (1 - rMax1 / rMax)
  const bitmapSourceY = Math.round(freqBins * (1 - rMax1))
  const bitmapSourceHeight = Math.round(freqBins * (rMax1 - rMin))

  const bitmap = await createImageBitmap(imageData, 0, bitmapSourceY, channelFreq.length, bitmapSourceHeight)
  canvasCtx.drawImage(bitmap, 0, drawY, width, drawHeight)
  // See spectrogram.ts's identical guard for why 'close' in bitmap is checked rather than assumed.
  if ('close' in bitmap) {
    bitmap.close()
  }
}

/** Draw one segment to a fresh canvas and attach it to `opts.canvasContainer`, replacing any previous canvas for that segment. */
export async function renderFrequencySegment(segment: FrequencySegment, opts: SegmentRenderOptions): Promise<void> {
  const segmentWidth = segment.endPixel - segment.startPixel
  const totalHeight = opts.height * segment.frequencies.length

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(segmentWidth)
  canvas.height = Math.round(totalHeight)
  canvas.style.position = 'absolute'
  canvas.style.left = `${segment.startPixel}px`
  canvas.style.top = '0'
  canvas.style.width = `${segmentWidth}px`
  canvas.style.height = `${totalHeight}px`

  const canvasCtx = canvas.getContext('2d')
  if (!canvasCtx) return

  for (let c = 0; c < segment.frequencies.length; c++) {
    await renderChannelToCanvas(segment.frequencies[c], canvasCtx, segmentWidth, opts.height, c * opts.height, opts)
  }

  if (segment.canvas) {
    segment.canvas.remove()
  }
  segment.canvas = canvas
  opts.canvasContainer.appendChild(canvas)
}
