/**
 * Pure functions for waveform calculations
 * All functions are pure - no side effects, deterministic output
 */

/**
 * Calculate waveform dimensions based on audio duration and options
 */
export function calculateWaveformDimensions(params: {
  duration: number
  minPxPerSec: number
  containerWidth: number
  fillParent: boolean
}): { width: number; isScrollable: boolean } {
  const { duration, minPxPerSec, containerWidth, fillParent } = params

  const scrollWidth = Math.ceil(duration * minPxPerSec)
  const isScrollable = scrollWidth > containerWidth

  const width = fillParent && !isScrollable ? containerWidth : scrollWidth

  return { width, isScrollable }
}

/**
 * Calculate progress as a ratio [0, 1]
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (duration === 0) return 0
  return Math.max(0, Math.min(1, currentTime / duration))
}

/**
 * Calculate progress as percentage [0, 100]
 */
export function calculateProgressPercent(currentTime: number, duration: number): number {
  return calculateProgress(currentTime, duration) * 100
}

/**
 * Calculate remaining time
 */
export function calculateRemainingTime(currentTime: number, duration: number): number {
  return Math.max(0, duration - currentTime)
}

/**
 * Calculate time from progress ratio
 */
export function calculateTimeFromProgress(progress: number, duration: number): number {
  return Math.max(0, Math.min(duration, progress * duration))
}

/**
 * Calculate visible time range based on scroll position
 */
export function calculateVisibleTimeRange(params: {
  scrollLeft: number
  containerWidth: number
  waveformWidth: number
  duration: number
}): { start: number; end: number } {
  const { scrollLeft, containerWidth, waveformWidth, duration } = params

  if (waveformWidth === 0 || duration === 0) {
    return { start: 0, end: 0 }
  }

  const startRatio = scrollLeft / waveformWidth
  const endRatio = (scrollLeft + containerWidth) / waveformWidth

  return {
    start: startRatio * duration,
    end: Math.min(endRatio * duration, duration),
  }
}

/**
 * Calculate scroll position to show a specific time
 */
export function calculateScrollForTime(params: {
  time: number
  duration: number
  waveformWidth: number
  containerWidth: number
  center?: boolean
}): number {
  const { time, duration, waveformWidth, containerWidth, center = false } = params

  if (duration === 0 || waveformWidth === 0) return 0

  const ratio = time / duration
  const position = ratio * waveformWidth

  if (center) {
    return Math.max(0, position - containerWidth / 2)
  }

  return position
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Calculate bar dimensions for bar waveform
 */
export function calculateBarDimensions(params: {
  barWidth?: number
  barGap?: number
  pixelRatio: number
}): { barWidth: number; barGap: number; barSpacing: number } {
  const { barWidth = 1, barGap, pixelRatio } = params

  const scaledBarWidth = barWidth * pixelRatio
  const scaledBarGap = barGap ? barGap * pixelRatio : scaledBarWidth / 2

  return {
    barWidth: scaledBarWidth,
    barGap: scaledBarGap,
    barSpacing: scaledBarWidth + scaledBarGap,
  }
}

/**
 * Calculate the number of bars that fit in a given width
 */
export function calculateBarCount(width: number, barSpacing: number): number {
  if (barSpacing === 0) return 0
  return Math.floor(width / barSpacing)
}

/**
 * Calculate zoom level from pixels per second
 */
export function calculateZoomLevel(minPxPerSec: number, basePxPerSec: number = 50): number {
  if (basePxPerSec === 0) return 1
  return minPxPerSec / basePxPerSec
}

/**
 * Calculate pixels per second from zoom level
 */
export function calculatePxPerSec(zoomLevel: number, basePxPerSec: number = 50): number {
  return zoomLevel * basePxPerSec
}

/**
 * Normalize a value from one range to another
 */
export function normalize(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const fromRange = fromMax - fromMin
  const toRange = toMax - toMin
  if (fromRange === 0) return toMin
  return ((value - fromMin) / fromRange) * toRange + toMin
}

/**
 * Convert relative position [0, 1] to pixel position
 */
export function relativeToPixel(relative: number, totalWidth: number): number {
  return relative * totalWidth
}

/**
 * Convert pixel position to relative position [0, 1]
 */
export function pixelToRelative(pixel: number, totalWidth: number): number {
  if (totalWidth === 0) return 0
  return clamp(pixel / totalWidth, 0, 1)
}
