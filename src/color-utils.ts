/**
 * Pure color manipulation utilities
 *
 * Provides pure functions for color parsing, interpolation, and gradient generation.
 * All functions are side-effect free and testable.
 */

// ============================================================================
// Color Types
// ============================================================================

export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export interface ColorStop {
  position: number // 0-1
  color: string
}

// ============================================================================
// Pure Color Parsing Functions
// ============================================================================

/**
 * Parse CSS color string to RGBA object
 * Pure function - no side effects
 *
 * Supports: hex (#RGB, #RRGGBB, #RRGGBBAA), rgb/rgba, named colors (basic set)
 *
 * @param color - CSS color string
 * @returns RGBA object with values 0-255 for RGB, 0-1 for alpha
 */
export function parseColor(color: string): RGBA {
  const trimmed = color.trim()

  // Handle hex colors
  if (trimmed.startsWith('#')) {
    return parseHexColor(trimmed)
  }

  // Handle rgb/rgba
  if (trimmed.startsWith('rgb')) {
    return parseRgbColor(trimmed)
  }

  // Handle named colors (basic set)
  const namedColor = NAMED_COLORS[trimmed.toLowerCase()]
  if (namedColor) {
    return parseHexColor(namedColor)
  }

  // Default to opaque black if unparseable
  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Parse hex color to RGBA
 * Pure function - no side effects
 */
function parseHexColor(hex: string): RGBA {
  // Remove #
  const h = hex.slice(1)

  // Handle shorthand (#RGB)
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
      a: 1,
    }
  }

  // Handle full hex (#RRGGBB)
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    }
  }

  // Handle with alpha (#RRGGBBAA)
  if (h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    }
  }

  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Parse rgb/rgba string to RGBA
 * Pure function - no side effects
 */
function parseRgbColor(rgb: string): RGBA {
  const match = rgb.match(/rgba?\(([^)]+)\)/)
  if (!match) return { r: 0, g: 0, b: 0, a: 1 }

  const values = match[1].split(',').map((v) => v.trim())
  return {
    r: parseInt(values[0]) || 0,
    g: parseInt(values[1]) || 0,
    b: parseInt(values[2]) || 0,
    a: values[3] ? parseFloat(values[3]) : 1,
  }
}

// ============================================================================
// Pure Color Conversion Functions
// ============================================================================

/**
 * Convert RGBA object to CSS rgba() string
 * Pure function - no side effects
 *
 * @param rgba - RGBA object
 * @returns CSS rgba() string
 */
export function rgbaToString(rgba: RGBA): string {
  return `rgba(${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${rgba.a})`
}

/**
 * Convert RGBA object to hex string
 * Pure function - no side effects
 *
 * @param rgba - RGBA object
 * @param includeAlpha - Whether to include alpha channel
 * @returns Hex color string
 */
export function rgbaToHex(rgba: RGBA, includeAlpha = false): string {
  const r = Math.round(rgba.r).toString(16).padStart(2, '0')
  const g = Math.round(rgba.g).toString(16).padStart(2, '0')
  const b = Math.round(rgba.b).toString(16).padStart(2, '0')

  if (includeAlpha) {
    const a = Math.round(rgba.a * 255)
      .toString(16)
      .padStart(2, '0')
    return `#${r}${g}${b}${a}`
  }

  return `#${r}${g}${b}`
}

// ============================================================================
// Pure Color Interpolation Functions
// ============================================================================

/**
 * Interpolate between two colors
 * Pure function - no side effects
 *
 * @param from - Starting color
 * @param to - Ending color
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function interpolateColor(from: RGBA, to: RGBA, t: number): RGBA {
  const clampedT = Math.max(0, Math.min(1, t))
  return {
    r: from.r + (to.r - from.r) * clampedT,
    g: from.g + (to.g - from.g) * clampedT,
    b: from.b + (to.b - from.b) * clampedT,
    a: from.a + (to.a - from.a) * clampedT,
  }
}

/**
 * Interpolate between multiple colors
 * Pure function - no side effects
 *
 * @param colors - Array of colors to interpolate between
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated color
 */
export function interpolateColors(colors: RGBA[], t: number): RGBA {
  if (colors.length === 0) return { r: 0, g: 0, b: 0, a: 1 }
  if (colors.length === 1) return colors[0]

  const clampedT = Math.max(0, Math.min(1, t))

  // Handle edge case: t=1 should return last color
  if (clampedT === 1) return colors[colors.length - 1]

  const segmentCount = colors.length - 1
  const segment = Math.floor(clampedT * segmentCount)
  const segmentT = (clampedT * segmentCount) % 1

  return interpolateColor(colors[segment], colors[segment + 1], segmentT)
}

// ============================================================================
// Pure Gradient Generation Functions
// ============================================================================

/**
 * Generate color stops from an array of colors
 * Pure function - no side effects
 *
 * @param colors - Array of color strings
 * @returns Array of color stops evenly distributed from 0 to 1
 */
export function generateColorStops(colors: string[]): ColorStop[] {
  if (colors.length === 0) return []
  if (colors.length === 1) return [{ position: 0, color: colors[0] }]

  const stops: ColorStop[] = []
  const stepSize = 1 / (colors.length - 1)

  colors.forEach((color, index) => {
    stops.push({
      position: index * stepSize,
      color,
    })
  })

  return stops
}

/**
 * Create a canvas gradient from color stops
 * Note: This is a side-effecting wrapper around pure logic
 *
 * @param ctx - Canvas context
 * @param stops - Color stops
 * @param width - Gradient width (0 for vertical)
 * @param height - Gradient height (0 for horizontal)
 * @returns Canvas gradient
 */
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  stops: ColorStop[],
  width = 0,
  height = 100,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, width, height)

  stops.forEach((stop) => {
    gradient.addColorStop(stop.position, stop.color)
  })

  return gradient
}

// ============================================================================
// Named Colors (Basic Set)
// ============================================================================

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  transparent: '#00000000',
}
