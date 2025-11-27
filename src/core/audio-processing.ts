/**
 * Pure audio processing functions
 *
 * These functions are pure: they have no side effects and always return
 * the same output for the same input. They can be easily tested and
 * used in Web Workers.
 */

/**
 * Find the maximum absolute value in channel data
 * Pure function - no side effects
 */
export function findMaxAmplitude(channelData: Array<Float32Array | number[]>): number {
  const firstChannel = channelData[0]
  if (!firstChannel) return 0

  let max = 0
  const length = firstChannel.length
  for (let i = 0; i < length; i++) {
    const absN = Math.abs(firstChannel[i])
    if (absN > max) max = absN
  }
  return max
}

/**
 * Check if channel data needs normalization (values outside -1..1)
 * Pure function - no side effects
 */
export function needsNormalization(channelData: Array<Float32Array | number[]>): boolean {
  const firstChannel = channelData[0]
  if (!firstChannel) return false
  return firstChannel.some((n) => n > 1 || n < -1)
}
