import type { WaveSurferOptions } from './wavesurfer.js'

export type ChannelData = Array<Float32Array | number[]>

export type BarSegment = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasSlot = {
  index: number
  offset: number
  width: number
}

export type LinePath = Array<{ x: number; y: number }>

export const DEFAULT_HEIGHT = 128

export const MAX_CANVAS_WIDTH = 8000

export const MAX_NODES = 10

export function clampToUnit(value: number): number {
  // NaN (e.g. from pointer math over a zero-size, hidden container) must not
  // escape into seek positions -- treat it as 0.
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * The effective bar width and gap, with defaults applied. This is THE single
 * definition of the bar grid: the draw site (calculateBarRenderConfig) and
 * the layout clamp (clampWidthToBarGrid) both resolve through it, so canvas
 * widths always align with the drawn bar spacing. `pixelRatio` scales the
 * configured CSS-pixel values into device pixels for drawing; layout code
 * (which works in CSS pixels) passes 1.
 */
export function resolveBarDimensions(
  options: WaveSurferOptions,
  pixelRatio: number,
): { barWidth: number; barGap: number } {
  const barWidth = options.barWidth ? options.barWidth * pixelRatio : 1
  const barGap = options.barGap ? options.barGap * pixelRatio : options.barWidth ? barWidth / 2 : 0
  return { barWidth, barGap }
}

export function calculateBarRenderConfig({
  width,
  height,
  length,
  options,
  pixelRatio,
}: {
  width: number
  height: number
  length: number
  options: WaveSurferOptions
  pixelRatio: number
}) {
  const halfHeight = height / 2
  const { barWidth, barGap } = resolveBarDimensions(options, pixelRatio)
  const barRadius = options.barRadius || 0
  const barMinHeight = options.barMinHeight ? options.barMinHeight * pixelRatio : 0
  const spacing = barWidth + barGap || 1
  const barIndexScale = length > 0 ? width / spacing / length : 0

  return {
    halfHeight,
    barWidth,
    barGap,
    barRadius,
    barMinHeight,
    barIndexScale,
    barSpacing: spacing,
  }
}

export function calculateBarHeights({
  maxTop,
  maxBottom,
  halfHeight,
  vScale,
  barMinHeight = 0,
  barAlign,
}: {
  maxTop: number
  maxBottom: number
  halfHeight: number
  vScale: number
  barMinHeight?: number
  barAlign?: WaveSurferOptions['barAlign']
}): { topHeight: number; totalHeight: number } {
  let topHeight = Math.round(maxTop * halfHeight * vScale)
  const bottomHeight = Math.round(maxBottom * halfHeight * vScale)
  let totalHeight = topHeight + bottomHeight || 1

  if (totalHeight < barMinHeight) {
    totalHeight = barMinHeight
    if (!barAlign) {
      topHeight = totalHeight / 2
    }
  }

  return { topHeight, totalHeight }
}

export function resolveBarYPosition({
  barAlign,
  halfHeight,
  topHeight,
  totalHeight,
  canvasHeight,
}: {
  barAlign: WaveSurferOptions['barAlign']
  halfHeight: number
  topHeight: number
  totalHeight: number
  canvasHeight: number
}): number {
  if (barAlign === 'top') return 0
  if (barAlign === 'bottom') return canvasHeight - totalHeight
  return halfHeight - topHeight
}

export function calculateBarSegments({
  channelData,
  barIndexScale,
  barSpacing,
  barWidth,
  halfHeight,
  vScale,
  canvasHeight,
  barAlign,
  barMinHeight,
}: {
  channelData: ChannelData
  barIndexScale: number
  barSpacing: number
  barWidth: number
  halfHeight: number
  vScale: number
  canvasHeight: number
  barAlign: WaveSurferOptions['barAlign']
  barMinHeight: number
}): BarSegment[] {
  const topChannel = channelData[0] || []
  const bottomChannel = channelData[1] || topChannel
  const length = topChannel.length

  const segments: BarSegment[] = []

  let prevX = 0
  let maxTop = 0
  let maxBottom = 0

  for (let i = 0; i <= length; i++) {
    const x = Math.round(i * barIndexScale)

    if (x > prevX) {
      const { topHeight, totalHeight } = calculateBarHeights({
        maxTop,
        maxBottom,
        halfHeight,
        vScale,
        barMinHeight,
        barAlign,
      })

      const y = resolveBarYPosition({
        barAlign,
        halfHeight,
        topHeight,
        totalHeight,
        canvasHeight,
      })

      segments.push({
        x: prevX * barSpacing,
        y,
        width: barWidth,
        height: totalHeight,
      })

      prevX = x
      maxTop = 0
      maxBottom = 0
    }

    const magnitudeTop = Math.abs(topChannel[i] || 0)
    const magnitudeBottom = Math.abs(bottomChannel[i] || 0)
    if (magnitudeTop > maxTop) maxTop = magnitudeTop
    if (magnitudeBottom > maxBottom) maxBottom = magnitudeBottom
  }

  return segments
}

export function getRelativePointerPosition(rect: DOMRect, clientX: number, clientY: number): [number, number] {
  // A hidden or not-yet-laid-out container has a zero-size rect; dividing by
  // it would yield NaN relative coordinates (and NaN seeks downstream).
  const relativeX = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
  const relativeY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0
  return [relativeX, relativeY]
}

export function resolveChannelHeight({
  optionsHeight,
  optionsSplitChannels,
  parentHeight,
  numberOfChannels,
  defaultHeight = DEFAULT_HEIGHT,
}: {
  optionsHeight?: WaveSurferOptions['height']
  optionsSplitChannels?: WaveSurferOptions['splitChannels']
  parentHeight: number
  numberOfChannels: number
  defaultHeight?: number
}): number {
  if (optionsHeight == null) return defaultHeight
  const numericHeight = Number(optionsHeight)
  if (!isNaN(numericHeight)) return numericHeight
  if (optionsHeight === 'auto') {
    const height = parentHeight || defaultHeight
    if (optionsSplitChannels?.every((channel) => !channel.overlay)) {
      return height / numberOfChannels
    }
    return height
  }
  return defaultHeight
}

export function getPixelRatio(devicePixelRatio?: number): number {
  return Math.max(1, devicePixelRatio || 1)
}

export function shouldRenderBars(options: WaveSurferOptions): boolean {
  return Boolean(options.barWidth || options.barGap || options.barAlign)
}

// A single reusable scratch canvas for gradient creation: resolveColorValue
// runs on every draw (including scroll-time lazy draws), and allocating a
// throwaway <canvas> per call caused needless GC churn. Lazily created so
// importing this module never touches the DOM.
let gradientScratchCanvas: HTMLCanvasElement | null = null

export function resolveColorValue(
  color: WaveSurferOptions['waveColor'],
  devicePixelRatio: number,
  canvasHeight?: number,
): string | CanvasGradient {
  if (!Array.isArray(color)) return color || ''
  if (color.length === 0) return '#999'
  if (color.length < 2) return color[0] || ''

  gradientScratchCanvas ??= document.createElement('canvas')
  const ctx = gradientScratchCanvas.getContext('2d')
  if (!ctx) return color[0] || ''
  const gradientHeight = canvasHeight || gradientScratchCanvas.height * devicePixelRatio
  const gradient = ctx.createLinearGradient(0, 0, 0, gradientHeight)

  const colorStopPercentage = 1 / (color.length - 1)
  color.forEach((value, index) => {
    gradient.addColorStop(index * colorStopPercentage, value)
  })

  return gradient
}

export function calculateWaveformLayout({
  duration,
  minPxPerSec = 0,
  parentWidth,
  fillParent,
  pixelRatio,
}: {
  duration: number
  minPxPerSec?: number
  parentWidth: number
  fillParent?: boolean
  pixelRatio: number
}) {
  const scrollWidth = Math.ceil(duration * minPxPerSec)
  const isScrollable = scrollWidth > parentWidth
  const useParentWidth = Boolean(fillParent && !isScrollable)
  const width = (useParentWidth ? parentWidth : scrollWidth) * pixelRatio

  return {
    scrollWidth,
    isScrollable,
    useParentWidth,
    width,
  }
}

export function clampWidthToBarGrid(width: number, options: WaveSurferOptions): number {
  if (!shouldRenderBars(options)) return width
  // Resolve through the same defaults the bar-drawing site uses (at
  // pixelRatio 1, since layout works in CSS pixels) -- divergent defaults
  // here produced a clipped bar / irregular gap at canvas seams at dpr=1.
  const { barWidth, barGap } = resolveBarDimensions(options, 1)
  const totalBarWidth = barWidth + barGap
  if (totalBarWidth === 0) return width
  return Math.floor(width / totalBarWidth) * totalBarWidth
}

export function calculateSingleCanvasWidth({
  clientWidth,
  totalWidth,
  options,
}: {
  clientWidth: number
  totalWidth: number
  options: WaveSurferOptions
}): number {
  const baseWidth = Math.min(MAX_CANVAS_WIDTH, clientWidth, totalWidth)
  return clampWidthToBarGrid(baseWidth, options)
}

export function computeCanvasPlan({
  totalWidth,
  clientWidth,
  options,
}: {
  totalWidth: number
  clientWidth: number
  options: WaveSurferOptions
}): { singleCanvasWidth: number; numCanvases: number; slots: CanvasSlot[] } {
  const singleCanvasWidth = calculateSingleCanvasWidth({ clientWidth, totalWidth, options })
  if (singleCanvasWidth === 0) return { singleCanvasWidth: 0, numCanvases: 0, slots: [] }
  const numCanvases = Math.ceil(totalWidth / singleCanvasWidth)
  const slots: CanvasSlot[] = []
  // Only the tail slot can ever be dropped here: every non-tail slot's width
  // is min(totalWidth - offset, singleCanvasWidth) === singleCanvasWidth,
  // which was already floor-clamped to the bar grid when it was computed
  // above, and clampWidthToBarGrid is idempotent on an already-aligned
  // value -- so it can't collapse to 0 for those. Only the final slot (where
  // totalWidth - offset < singleCanvasWidth) can floor-clamp down to 0 and
  // get skipped. That keeps `slots` dense with no gaps, so `slots[index]`
  // positional lookup stays aligned with `index`; if this clamping logic
  // ever changes such that a middle slot could also be dropped, draw() must
  // switch from positional indexing to finding a slot by its `.index` field.
  for (let index = 0; index < numCanvases; index++) {
    const offset = index * singleCanvasWidth
    const width = clampWidthToBarGrid(Math.min(totalWidth - offset, singleCanvasWidth), options)
    if (width > 0) slots.push({ index, offset, width })
  }
  return { singleCanvasWidth, numCanvases, slots }
}

export function sliceChannelData({
  channelData,
  offset,
  clampedWidth,
  totalWidth,
}: {
  channelData: ChannelData
  offset: number
  clampedWidth: number
  totalWidth: number
}): ChannelData {
  return channelData.map((channel) => {
    const start = Math.floor((offset / totalWidth) * channel.length)
    const end = Math.floor(((offset + clampedWidth) / totalWidth) * channel.length)
    return channel.slice(start, end)
  })
}

export function shouldClearCanvases(currentNodeCount: number): boolean {
  return currentNodeCount > MAX_NODES
}

export function getLazyRenderRange({
  scrollLeft,
  clientWidth,
  singleCanvasWidth,
  numCanvases,
}: {
  scrollLeft: number
  clientWidth: number
  singleCanvasWidth: number
  numCanvases: number
}): number[] {
  if (singleCanvasWidth <= 0 || numCanvases <= 0) return [0]
  // Canvas i occupies [i * singleCanvasWidth, (i + 1) * singleCanvasWidth)
  // (only the tail one may be narrower), so index both viewport edges against
  // the ACTUAL canvas width. The previous average-width math
  // (scrollLeft / totalWidth * numCanvases, +/- 1) could miss the canvas at a
  // viewport edge by up to a bar spacing when singleCanvasWidth was bar-grid
  // clamped below clientWidth -- an undrawn strip. One extra canvas on each
  // side is prefetch; draw() ignores out-of-range indexes.
  const startCanvas = Math.min(numCanvases - 1, Math.floor(scrollLeft / singleCanvasWidth))
  const endCanvas = Math.min(numCanvases - 1, Math.floor((scrollLeft + clientWidth) / singleCanvasWidth))
  const range: number[] = []
  for (let i = startCanvas - 1; i <= endCanvas + 1; i++) {
    range.push(i)
  }
  return range
}

/**
 * The maximum absolute sample value across ALL channels of the full channel
 * data. Computed once per render and threaded into calculateVerticalScale as
 * `maxPeak` so that every canvas slice normalizes against the same global
 * peak -- per-slice normalization would scale a quiet chunk to full height
 * and produce amplitude discontinuities at canvas seams.
 */
export function calculateGlobalPeak(channelData: ChannelData): number {
  let max = 0
  for (const channel of channelData) {
    for (let i = 0; i < channel.length; i++) {
      const magnitude = Math.abs(channel[i] ?? 0)
      if (magnitude > max) max = magnitude
    }
  }
  return max
}

export function calculateVerticalScale({
  channelData,
  barHeight,
  normalize,
  maxPeak,
}: {
  channelData: ChannelData
  barHeight?: WaveSurferOptions['barHeight']
  normalize?: WaveSurferOptions['normalize']
  maxPeak?: WaveSurferOptions['maxPeak']
}): number {
  const baseScale = barHeight || 1
  if (!normalize) return baseScale

  const firstChannel = channelData[0]
  if (!firstChannel || firstChannel.length === 0) return baseScale

  // Use fixed max peak if provided, otherwise calculate from data
  let max = maxPeak ?? 0
  if (!maxPeak) {
    for (let i = 0; i < firstChannel.length; i++) {
      const value = firstChannel[i] ?? 0
      const magnitude = Math.abs(value)
      if (magnitude > max) max = magnitude
    }
  }

  if (!max) return baseScale
  return baseScale / max
}

export function calculateLinePaths({
  channelData,
  width,
  height,
  vScale,
}: {
  channelData: ChannelData
  width: number
  height: number
  vScale: number
}): LinePath[] {
  const halfHeight = height / 2
  const primaryChannel = channelData[0] || []
  const secondaryChannel = channelData[1] || primaryChannel
  const channels = [primaryChannel, secondaryChannel]

  return channels.map((channel, index) => {
    const length = channel.length
    const hScale = length ? width / length : 0
    const baseY = halfHeight
    const direction = index === 0 ? -1 : 1

    const path: LinePath = [{ x: 0, y: baseY }]
    let prevX = 0
    let max = 0

    for (let i = 0; i <= length; i++) {
      const x = Math.round(i * hScale)

      if (x > prevX) {
        const heightDelta = Math.round(max * halfHeight * vScale) || 1
        const y = baseY + heightDelta * direction
        path.push({ x: prevX, y })
        prevX = x
        max = 0
      }

      const value = Math.abs(channel[i] || 0)
      if (value > max) max = value
    }

    path.push({ x: prevX, y: baseY })

    return path
  })
}

/** Round to the nearest integer, with exact halves rounded away from zero. */
export function roundToHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}
