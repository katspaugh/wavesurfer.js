/**
 * Pure calculation utilities
 *
 * These functions are pure: they have no side effects and always return
 * the same output for the same input. They can be easily tested and
 * provide type-safe calculations throughout the codebase.
 */

// ============================================================================
// Position Calculations
// ============================================================================

/**
 * Get relative pointer position within an element
 * Pure function - no side effects
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
 */
export function clampToUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

// ============================================================================
// Scroll Calculations
// ============================================================================

export interface ScrollPercentages {
  startX: number
  endX: number
}

/**
 * Calculate scroll position as percentages
 * Pure function - no side effects
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

// ============================================================================
// Layout Calculations
// ============================================================================

/**
 * Calculate waveform layout parameters
 * Pure function - no side effects
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

  // Calculate scroll width in CSS pixels
  const scrollWidth = Math.ceil(duration * minPxPerSec)

  // Determine if scrollable
  const isScrollable = scrollWidth > parentWidth

  // Determine if should fill parent
  const useParentWidth = Boolean(fillParent && !isScrollable)

  // Calculate width in device pixels
  const width = (useParentWidth ? parentWidth : scrollWidth) * pixelRatio

  return {
    width,
    scrollWidth,
    isScrollable,
    useParentWidth,
  }
}
