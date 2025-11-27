/**
 * Unit tests for core/audio-processing.ts
 * Testing pure audio processing functions that are actually used in the codebase
 */

import { findMaxAmplitude, needsNormalization } from '../audio-processing'

describe('Audio Processing', () => {
  describe('findMaxAmplitude', () => {
    it('should find maximum absolute value', () => {
      const channelData = [new Float32Array([0.5, -0.8, 0.3, -0.6])]
      expect(findMaxAmplitude(channelData)).toBeCloseTo(0.8)
    })

    it('should handle positive and negative values', () => {
      const channelData = [new Float32Array([0.5, 1.2, -1.5, 0.8])]
      expect(findMaxAmplitude(channelData)).toBeCloseTo(1.5)
    })

    it('should handle empty data', () => {
      expect(findMaxAmplitude([new Float32Array()])).toBe(0)
      expect(findMaxAmplitude([])).toBe(0)
    })
  })

  describe('needsNormalization', () => {
    it('should detect values outside -1..1', () => {
      expect(needsNormalization([new Float32Array([0.5, 1.5, 0.3])])).toBe(true)
      expect(needsNormalization([new Float32Array([0.5, -1.5, 0.3])])).toBe(true)
    })

    it('should return false for normalized data', () => {
      expect(needsNormalization([new Float32Array([0.5, 1.0, -0.8])])).toBe(false)
      expect(needsNormalization([new Float32Array([0, 0.5, -0.5])])).toBe(false)
    })

    it('should handle empty data', () => {
      expect(needsNormalization([new Float32Array()])).toBe(false)
      expect(needsNormalization([])).toBe(false)
    })
  })
})
