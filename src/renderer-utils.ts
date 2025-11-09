import type { WaveSurferOptions } from './wavesurfer.js'

export type ChannelData = Array<Float32Array | number[]>

export type BarSegment = {
  x: number
  y: number
  width: number
  height: number
}

export type LinePath = Array<{ x: number; y: number }>

export const DEFAULT_HEIGHT = 128

export const MAX_CANVAS_WIDTH = 8000

export const MAX_NODES = 10

export function clampToUnit(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

// ============================================================================
// Pure Peak Calculation Functions
// ============================================================================
// These functions calculate peaks from audio data without side effects.
// They can be easily tested and run in Web Workers.

/**
 * Find the peak (max absolute value) in a range of audio data
 * Pure function - no side effects
 *
 * @param data - The audio data array
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @returns The peak value (always positive)
 */
export function findPeakInRange(data: Float32Array | number[], start: number, end: number): number {
  let peak = 0
  for (let i = start; i < end; i++) {
    const abs = Math.abs(data[i] || 0)
    if (abs > peak) peak = abs
  }
  return peak
}

/**
 * Calculate peaks for a given number of segments
 * Pure function - no side effects
 *
 * @param channelData - The audio channel data
 * @param numPeaks - Number of peaks to calculate
 * @returns Array of peak values
 */
export function calculatePeaks(channelData: Float32Array | number[], numPeaks: number): Float32Array {
  const length = channelData.length
  const blockSize = Math.floor(length / numPeaks)
  const peaks = new Float32Array(numPeaks)

  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize
    const end = start + blockSize
    peaks[i] = findPeakInRange(channelData, start, end)
  }

  return peaks
}

/**
 * Find peaks in two channels (e.g., stereo)
 * Pure function - no side effects
 *
 * @param topChannel - First channel data
 * @param bottomChannel - Second channel data
 * @param start - Start index
 * @param end - End index
 * @returns Object with maxTop and maxBottom peak values
 */
export function findPeaksInRange(
  topChannel: Float32Array | number[],
  bottomChannel: Float32Array | number[],
  start: number,
  end: number,
): { maxTop: number; maxBottom: number } {
  let maxTop = 0
  let maxBottom = 0

  for (let i = start; i < end; i++) {
    const magnitudeTop = Math.abs(topChannel[i] || 0)
    const magnitudeBottom = Math.abs(bottomChannel[i] || 0)
    if (magnitudeTop > maxTop) maxTop = magnitudeTop
    if (magnitudeBottom > maxBottom) maxBottom = magnitudeBottom
  }

  return { maxTop, maxBottom }
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
  const barWidth = options.barWidth ? options.barWidth * pixelRatio : 1
  const barGap = options.barGap ? options.barGap * pixelRatio : options.barWidth ? barWidth / 2 : 0
  const barRadius = options.barRadius || 0
  const spacing = barWidth + barGap || 1
  const barIndexScale = length > 0 ? width / spacing / length : 0

  return {
    halfHeight,
    barWidth,
    barGap,
    barRadius,
    barIndexScale,
    barSpacing: spacing,
  }
}

export function calculateBarHeights({
  maxTop,
  maxBottom,
  halfHeight,
  vScale,
}: {
  maxTop: number
  maxBottom: number
  halfHeight: number
  vScale: number
}): { topHeight: number; totalHeight: number } {
  const topHeight = Math.round(maxTop * halfHeight * vScale)
  const bottomHeight = Math.round(maxBottom * halfHeight * vScale)
  const totalHeight = topHeight + bottomHeight || 1

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
}: {
  channelData: ChannelData
  barIndexScale: number
  barSpacing: number
  barWidth: number
  halfHeight: number
  vScale: number
  canvasHeight: number
  barAlign: WaveSurferOptions['barAlign']
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

// ============================================================================
// Pure Coordinate Transformation Functions
// ============================================================================
// These functions handle conversions between different coordinate systems
// (pixels, relative positions, time) without side effects.

/**
 * Convert client coordinates to relative position within an element
 * Pure function - no side effects
 *
 * @param rect - The bounding rectangle of the element
 * @param clientX - Client X coordinate
 * @param clientY - Client Y coordinate
 * @returns Tuple of [relativeX, relativeY] where 0 = left/top, 1 = right/bottom
 */
export function getRelativePointerPosition(rect: DOMRect, clientX: number, clientY: number): [number, number] {
  const x = clientX - rect.left
  const y = clientY - rect.top
  const relativeX = x / rect.width
  const relativeY = y / rect.height
  return [relativeX, relativeY]
}

/**
 * Convert pixel position to time
 * Pure function - no side effects
 *
 * @param pixel - Pixel position
 * @param duration - Total duration in seconds
 * @param width - Total width in pixels
 * @param zoom - Zoom factor (default: 1)
 * @returns Time in seconds
 */
export function pixelToTime(pixel: number, duration: number, width: number, zoom = 1): number {
  return ((pixel / width) * duration) / zoom
}

/**
 * Convert time to pixel position
 * Pure function - no side effects
 *
 * @param time - Time in seconds
 * @param duration - Total duration in seconds
 * @param width - Total width in pixels
 * @param zoom - Zoom factor (default: 1)
 * @returns Pixel position
 */
export function timeToPixel(time: number, duration: number, width: number, zoom = 1): number {
  return (time / duration) * width * zoom
}

/**
 * Convert relative position (0-1) to time
 * Pure function - no side effects
 *
 * @param relativeX - Relative position (0 = start, 1 = end)
 * @param duration - Total duration in seconds
 * @returns Time in seconds
 */
export function relativeToTime(relativeX: number, duration: number): number {
  return relativeX * duration
}

/**
 * Convert time to relative position (0-1)
 * Pure function - no side effects
 *
 * @param time - Time in seconds
 * @param duration - Total duration in seconds
 * @returns Relative position (0 = start, 1 = end)
 */
export function timeToRelative(time: number, duration: number): number {
  return duration > 0 ? time / duration : 0
}

/**
 * Normalize coordinates to viewport
 * Pure function - no side effects
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param canvasRect - Canvas bounding rectangle
 * @returns Normalized coordinates relative to canvas
 */
export function normalizeToViewport(x: number, y: number, canvasRect: DOMRect): { x: number; y: number } {
  return {
    x: x - canvasRect.left,
    y: y - canvasRect.top,
  }
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

export function resolveColorValue(
  color: WaveSurferOptions['waveColor'],
  devicePixelRatio: number,
): string | CanvasGradient {
  if (!Array.isArray(color)) return color || ''
  if (color.length === 0) return '#999'
  if (color.length < 2) return color[0] || ''

  const canvasElement = document.createElement('canvas')
  const ctx = canvasElement.getContext('2d') as CanvasRenderingContext2D
  const gradientHeight = canvasElement.height * devicePixelRatio
  const gradient = ctx.createLinearGradient(0, 0, 0, gradientHeight || devicePixelRatio)

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
  const barWidth = options.barWidth || 0.5
  const barGap = options.barGap || barWidth / 2
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
  totalWidth,
  numCanvases,
}: {
  scrollLeft: number
  totalWidth: number
  numCanvases: number
}): number[] {
  if (totalWidth === 0) return [0]
  const viewPosition = scrollLeft / totalWidth
  const startCanvas = Math.floor(viewPosition * numCanvases)
  return [startCanvas - 1, startCanvas, startCanvas + 1]
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

export function calculateScrollPercentages({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: {
  scrollLeft: number
  clientWidth: number
  scrollWidth: number
}): { startX: number; endX: number } {
  if (scrollWidth === 0) {
    return { startX: 0, endX: 0 }
  }

  const startX = scrollLeft / scrollWidth
  const endX = (scrollLeft + clientWidth) / scrollWidth

  return { startX, endX }
}

export function roundToHalfAwayFromZero(value: number): number {
  const scaled = value * 2
  const rounded = scaled < 0 ? Math.floor(scaled) : Math.ceil(scaled)
  return rounded / 2
}
