/**
 * Pure calculation utilities
 *
 * These functions are pure: they have no side effects and always return
 * the same output for the same input. They can be easily tested and
 * provide type-safe calculations throughout the codebase.
 */

// ============================================================================
// Time/Progress Calculations
// ============================================================================

/**
 * Calculate playback progress as a percentage (0-1)
 * Pure function - no side effects
 *
 * @param currentTime - Current playback time in seconds
 * @param duration - Total duration in seconds
 * @returns Progress value between 0 and 1
 *
 * @example
 * calculateProgress(5, 10) // Returns 0.5 (50%)
 * calculateProgress(0, 10) // Returns 0
 * calculateProgress(10, 10) // Returns 1
 */
export function calculateProgress(currentTime: number, duration: number): number {
  return duration > 0 ? currentTime / duration : 0
}

/**
 * Calculate time from progress percentage
 * Pure function - no side effects
 *
 * @param progress - Progress value between 0 and 1
 * @param duration - Total duration in seconds
 * @returns Time in seconds
 *
 * @example
 * calculateTimeFromProgress(0.5, 10) // Returns 5
 * calculateTimeFromProgress(0, 10) // Returns 0
 * calculateTimeFromProgress(1, 10) // Returns 10
 */
export function calculateTimeFromProgress(progress: number, duration: number): number {
  return progress * duration
}

/**
 * Clamp time value to valid range [0, duration]
 * Pure function - no side effects
 *
 * @param time - Time value to clamp
 * @param duration - Maximum duration
 * @returns Clamped time value
 *
 * @example
 * clampTime(5, 10) // Returns 5
 * clampTime(-1, 10) // Returns 0
 * clampTime(15, 10) // Returns 10
 */
export function clampTime(time: number, duration: number): number {
  return Math.max(0, Math.min(duration, time))
}

// ============================================================================
// Zoom Calculations
// ============================================================================

/**
 * Calculate waveform width based on zoom level
 * Pure function - no side effects
 *
 * @param duration - Audio duration in seconds
 * @param minPxPerSec - Minimum pixels per second (zoom level)
 * @param containerWidth - Container width in pixels
 * @returns Calculated width in pixels
 *
 * @example
 * calculateZoomWidth(10, 50, 500) // Returns 500 (duration * minPxPerSec)
 * calculateZoomWidth(5, 50, 500) // Returns 500 (at least containerWidth)
 */
export function calculateZoomWidth(duration: number, minPxPerSec: number, containerWidth: number): number {
  const width = duration * minPxPerSec
  return Math.max(containerWidth, width)
}

/**
 * Calculate minimum pixels per second for a target width
 * Pure function - no side effects
 *
 * @param duration - Audio duration in seconds
 * @param targetWidth - Target width in pixels
 * @returns Minimum pixels per second
 *
 * @example
 * calculateMinPxPerSec(10, 500) // Returns 50
 * calculateMinPxPerSec(5, 1000) // Returns 200
 */
export function calculateMinPxPerSec(duration: number, targetWidth: number): number {
  return duration > 0 ? targetWidth / duration : 0
}

// ============================================================================
// Scroll Calculations
// ============================================================================

export interface ScrollPercentages {
  /** Start position as percentage (0-1) */
  startX: number
  /** End position as percentage (0-1) */
  endX: number
}

/**
 * Calculate scroll position as percentages
 * Pure function - no side effects
 *
 * @param params - Scroll parameters
 * @returns Start and end positions as percentages (0-1)
 *
 * @example
 * calculateScrollPercentages({ scrollLeft: 100, scrollWidth: 1000, clientWidth: 500 })
 * // Returns { startX: 0.1, endX: 0.6 }
 */
export function calculateScrollPercentages(params: {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}): ScrollPercentages {
  const { scrollLeft, scrollWidth, clientWidth } = params
  if (scrollWidth === 0) {
    return { startX: 0, endX: 0 }
  }

  return {
    startX: scrollLeft / scrollWidth,
    endX: (scrollLeft + clientWidth) / scrollWidth,
  }
}

/**
 * Calculate scroll position from percentage
 * Pure function - no side effects
 *
 * @param percentage - Scroll position as percentage (0-1)
 * @param scrollWidth - Total scrollable width
 * @returns Scroll position in pixels
 *
 * @example
 * calculateScrollPosition(0.5, 1000) // Returns 500
 * calculateScrollPosition(0, 1000) // Returns 0
 * calculateScrollPosition(1, 1000) // Returns 1000
 */
export function calculateScrollPosition(percentage: number, scrollWidth: number): number {
  return percentage * scrollWidth
}

// ============================================================================
// Canvas Calculations
// ============================================================================

export interface CanvasSize {
  width: number
  height: number
}

/**
 * Calculate canvas size accounting for pixel ratio
 * Pure function - no side effects
 *
 * @param containerWidth - Container width in CSS pixels
 * @param containerHeight - Container height in CSS pixels
 * @param pixelRatio - Device pixel ratio
 * @returns Canvas dimensions in device pixels
 *
 * @example
 * calculateCanvasSize(500, 200, 2) // Returns { width: 1000, height: 400 }
 */
export function calculateCanvasSize(containerWidth: number, containerHeight: number, pixelRatio: number): CanvasSize {
  return {
    width: Math.ceil(containerWidth * pixelRatio),
    height: Math.ceil(containerHeight * pixelRatio),
  }
}

// ============================================================================
// Position Calculations
// ============================================================================

/**
 * Get relative pointer position within an element
 * Pure function - no side effects
 *
 * @param rect - Element bounding rectangle
 * @param clientX - Pointer X position in viewport
 * @param clientY - Pointer Y position in viewport
 * @returns Relative position as [x, y] where both are 0-1
 *
 * @example
 * getRelativePointerPosition(
 *   { left: 100, top: 50, width: 500, height: 200 },
 *   350, 150
 * ) // Returns [0.5, 0.5] (center)
 */
export function getRelativePointerPosition(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): [x: number, y: number] {
  const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
  const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0
  return [x, y]
}

/**
 * Clamp a value to the unit range [0, 1]
 * Pure function - no side effects
 *
 * @param value - Value to clamp
 * @returns Value clamped to 0-1
 *
 * @example
 * clampToUnit(0.5) // Returns 0.5
 * clampToUnit(-0.5) // Returns 0
 * clampToUnit(1.5) // Returns 1
 */
export function clampToUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/**
 * Clamp a value to a specified range
 * Pure function - no side effects
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Value clamped to [min, max]
 *
 * @example
 * clamp(5, 0, 10) // Returns 5
 * clamp(-5, 0, 10) // Returns 0
 * clamp(15, 0, 10) // Returns 10
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ============================================================================
// Layout Calculations
// ============================================================================

/**
 * Calculate waveform layout parameters
 * Pure function - no side effects
 *
 * @param params - Layout parameters
 * @returns Layout calculation results
 */
export function calculateWaveformLayout(params: {
  duration: number
  minPxPerSec: number
  parentWidth: number
  fillParent: boolean
  pixelRatio: number
}): {
  width: number
  scrollWidth: number
  isScrollable: boolean
  useParentWidth: boolean
} {
  const { duration, minPxPerSec, parentWidth, fillParent, pixelRatio } = params

  // Calculate desired width based on zoom
  const desiredWidth = duration * minPxPerSec

  // Determine if should fill parent
  const useParentWidth = fillParent && desiredWidth <= parentWidth
  const width = useParentWidth ? parentWidth : desiredWidth

  // Calculate scroll width (in CSS pixels)
  const scrollWidth = width / pixelRatio

  // Determine if scrollable
  const isScrollable = scrollWidth > parentWidth

  return {
    width,
    scrollWidth,
    isScrollable,
    useParentWidth,
  }
}

/**
 * Calculate pixel to time conversion factor
 * Pure function - no side effects
 *
 * @param duration - Total duration in seconds
 * @param width - Total width in pixels
 * @returns Seconds per pixel
 *
 * @example
 * calculatePixelToTime(10, 1000) // Returns 0.01 (100 pixels per second)
 */
export function calculatePixelToTime(duration: number, width: number): number {
  return width > 0 ? duration / width : 0
}

/**
 * Calculate time to pixel conversion factor
 * Pure function - no side effects
 *
 * @param duration - Total duration in seconds
 * @param width - Total width in pixels
 * @returns Pixels per second
 *
 * @example
 * calculateTimeToPixel(10, 1000) // Returns 100
 */
export function calculateTimeToPixel(duration: number, width: number): number {
  return duration > 0 ? width / duration : 0
}

/**
 * Convert pixel position to time
 * Pure function - no side effects
 *
 * @param pixelX - X position in pixels
 * @param totalWidth - Total width in pixels
 * @param duration - Total duration in seconds
 * @returns Time in seconds
 *
 * @example
 * pixelToTime(500, 1000, 10) // Returns 5
 */
export function pixelToTime(pixelX: number, totalWidth: number, duration: number): number {
  if (totalWidth === 0) return 0
  const progress = pixelX / totalWidth
  return calculateTimeFromProgress(clampToUnit(progress), duration)
}

/**
 * Convert time to pixel position
 * Pure function - no side effects
 *
 * @param time - Time in seconds
 * @param totalWidth - Total width in pixels
 * @param duration - Total duration in seconds
 * @returns X position in pixels
 *
 * @example
 * timeToPixel(5, 1000, 10) // Returns 500
 */
export function timeToPixel(time: number, totalWidth: number, duration: number): number {
  if (duration === 0) return 0
  const progress = calculateProgress(time, duration)
  return progress * totalWidth
}
