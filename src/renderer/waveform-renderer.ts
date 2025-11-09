/**
 * Direct canvas rendering for waveforms
 *
 * These functions render waveforms directly to canvas without virtual DOM overhead.
 */

import type { ChannelData } from '../renderer-utils.js'

export interface WaveformRenderOptions {
  width: number
  height: number
  vScale: number
  waveColor: string | CanvasGradient | CanvasPattern
  progressColor?: string | CanvasGradient | CanvasPattern
  progress?: number
  shouldRenderBars?: boolean
  barSegments?: Array<{ x: number; y: number; width: number; height: number }>
  barRadius?: number
}

// ============================================================================
// Pure Waveform Path Generation Functions
// ============================================================================
// These functions generate SVG path strings from audio data without side effects.
// They can be easily tested and used in different rendering contexts.

export interface WaveformPathOptions {
  /** Vertical scale factor (default: 1) */
  vScale?: number
}

/**
 * Generate SVG path commands for a single channel
 * Pure function - no side effects
 *
 * @param channelData - Audio sample data for one channel
 * @param width - Width of the waveform in pixels
 * @param height - Height of the waveform in pixels
 * @param vScale - Vertical scale factor
 * @param startFromBottom - If true, path starts from bottom instead of middle
 * @returns Array of path command strings
 */
export function generateChannelPath(
  channelData: Float32Array | number[],
  width: number,
  height: number,
  vScale: number,
  startFromBottom = false,
): string[] {
  const path: string[] = []
  const length = channelData.length
  const halfHeight = height / 2

  for (let i = 0; i < length; i++) {
    const x = (i / (length - 1 || 1)) * width
    const value = channelData[i] || 0
    const y = startFromBottom ? height - value * height * vScale : halfHeight - value * halfHeight * vScale

    if (i === 0) {
      path.push(`M ${x} ${y}`)
    } else {
      path.push(`L ${x} ${y}`)
    }
  }

  return path
}

/**
 * Build an SVG path string from waveform channel data
 * Pure function - no side effects
 *
 * This creates a path that represents the waveform shape as a series of
 * points that can be efficiently rendered using Canvas Path2D.
 *
 * @param channelData - Array of channel data (1 for mono, 2 for stereo)
 * @param width - Width of the waveform in pixels
 * @param height - Height of the waveform in pixels
 * @param vScale - Vertical scale factor
 * @returns SVG path string
 */
export function buildWaveformPathData(channelData: ChannelData, width: number, height: number, vScale: number): string {
  const paths: string[] = []
  const halfHeight = height / 2
  const topChannel = channelData[0] || []
  const bottomChannel = channelData[1] || topChannel
  const length = topChannel.length

  if (length === 0) return ''

  // Build top path
  const topPath = generateChannelPath(topChannel, width, height, vScale, false)
  paths.push(...topPath)

  // Build bottom path (in reverse)
  const bottomPath: string[] = []
  for (let i = length - 1; i >= 0; i--) {
    const x = (i / (length - 1 || 1)) * width
    const value = bottomChannel[i] || 0
    const y = halfHeight + value * halfHeight * vScale
    bottomPath.push(`L ${x} ${y}`)
  }
  paths.push(...bottomPath)

  // Close the path
  paths.push('Z')

  return paths.join(' ')
}

/**
 * Generate waveform path with configurable options
 * Pure function - no side effects
 *
 * @param channelData - Array of channel data
 * @param width - Width of the waveform in pixels
 * @param height - Height of the waveform in pixels
 * @param options - Path generation options
 * @returns SVG path string
 */
export function generateWaveformPath(
  channelData: ChannelData,
  width: number,
  height: number,
  options: WaveformPathOptions = {},
): string {
  const { vScale = 1 } = options
  return buildWaveformPathData(channelData, width, height, vScale)
}

/**
 * Render line waveform directly to canvas
 */
export function renderLineWaveform(
  ctx: CanvasRenderingContext2D,
  channelData: ChannelData,
  width: number,
  height: number,
  vScale: number,
  waveColor: string | CanvasGradient | CanvasPattern,
  progressColor?: string | CanvasGradient | CanvasPattern,
  progress?: number,
): void {
  const pathData = buildWaveformPathData(channelData, width, height, vScale)
  const path = new Path2D(pathData)

  // Render main waveform
  ctx.fillStyle = waveColor
  ctx.fill(path)

  // Render progress overlay if needed
  if (progressColor && progress != null && progress > 0) {
    const progressWidth = width * progress
    const progressPathData = buildWaveformPathData(channelData, progressWidth, height, vScale)
    const progressPath = new Path2D(progressPathData)

    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = progressColor
    ctx.fill(progressPath)
    ctx.restore()
  }
}

/**
 * Render bar waveform directly to canvas
 */
export function renderBarWaveform(
  ctx: CanvasRenderingContext2D,
  segments: Array<{ x: number; y: number; width: number; height: number }>,
  barRadius: number | undefined,
  waveColor: string | CanvasGradient | CanvasPattern,
  progressColor?: string | CanvasGradient | CanvasPattern,
  progress?: number,
  canvasWidth?: number,
): void {
  segments.forEach((segment) => {
    const isInProgress = progress != null && canvasWidth && segment.x < canvasWidth * progress

    ctx.fillStyle = isInProgress && progressColor ? progressColor : waveColor

    if (barRadius) {
      // Render rounded rectangle
      renderRoundedRect(ctx, segment.x, segment.y, segment.width, segment.height, barRadius)
    } else {
      // Render regular rectangle
      ctx.fillRect(segment.x, segment.y, segment.width, segment.height)
    }
  })
}

/**
 * Render a rounded rectangle
 */
function renderRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.fill()
}

/**
 * Render complete waveform to canvas with channel data
 */
export function renderWaveformWithChannelData(
  ctx: CanvasRenderingContext2D,
  channelData: ChannelData,
  options: WaveformRenderOptions,
): void {
  const { width, height, vScale, waveColor, progressColor, progress, shouldRenderBars, barSegments, barRadius } =
    options

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Render waveform
  if (shouldRenderBars && barSegments) {
    renderBarWaveform(ctx, barSegments, barRadius, waveColor, progressColor, progress, width)
  } else {
    renderLineWaveform(ctx, channelData, width, height, vScale, waveColor, progressColor, progress)
  }
}
