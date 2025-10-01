import { describe, it, expect } from 'vitest'
import * as waveform from '../../core/waveform'

describe('waveform core functions', () => {
  describe('calculateWaveformDimensions', () => {
    it('should calculate scrollable dimensions', () => {
      const result = waveform.calculateWaveformDimensions({
        duration: 100,
        minPxPerSec: 50,
        containerWidth: 1000,
        fillParent: true,
      })

      expect(result).toEqual({
        width: 5000,
        isScrollable: true,
      })
    })

    it('should fill parent when not scrollable', () => {
      const result = waveform.calculateWaveformDimensions({
        duration: 10,
        minPxPerSec: 50,
        containerWidth: 1000,
        fillParent: true,
      })

      expect(result).toEqual({
        width: 1000,
        isScrollable: false,
      })
    })

    it('should not fill parent when fillParent is false', () => {
      const result = waveform.calculateWaveformDimensions({
        duration: 10,
        minPxPerSec: 50,
        containerWidth: 1000,
        fillParent: false,
      })

      expect(result).toEqual({
        width: 500,
        isScrollable: false,
      })
    })
  })

  describe('calculateProgress', () => {
    it('should calculate progress correctly', () => {
      expect(waveform.calculateProgress(50, 100)).toBe(0.5)
      expect(waveform.calculateProgress(0, 100)).toBe(0)
      expect(waveform.calculateProgress(100, 100)).toBe(1)
    })

    it('should clamp progress to [0, 1]', () => {
      expect(waveform.calculateProgress(-10, 100)).toBe(0)
      expect(waveform.calculateProgress(150, 100)).toBe(1)
    })

    it('should return 0 when duration is 0', () => {
      expect(waveform.calculateProgress(50, 0)).toBe(0)
    })
  })

  describe('calculateProgressPercent', () => {
    it('should calculate percentage correctly', () => {
      expect(waveform.calculateProgressPercent(50, 100)).toBe(50)
      expect(waveform.calculateProgressPercent(25, 100)).toBe(25)
    })
  })

  describe('calculateRemainingTime', () => {
    it('should calculate remaining time', () => {
      expect(waveform.calculateRemainingTime(30, 100)).toBe(70)
      expect(waveform.calculateRemainingTime(100, 100)).toBe(0)
    })

    it('should not return negative values', () => {
      expect(waveform.calculateRemainingTime(150, 100)).toBe(0)
    })
  })

  describe('calculateTimeFromProgress', () => {
    it('should calculate time from progress', () => {
      expect(waveform.calculateTimeFromProgress(0.5, 100)).toBe(50)
      expect(waveform.calculateTimeFromProgress(0.25, 100)).toBe(25)
      expect(waveform.calculateTimeFromProgress(1, 100)).toBe(100)
    })

    it('should clamp result', () => {
      expect(waveform.calculateTimeFromProgress(-0.1, 100)).toBe(0)
      expect(waveform.calculateTimeFromProgress(1.5, 100)).toBe(100)
    })
  })

  describe('calculateVisibleTimeRange', () => {
    it('should calculate visible time range', () => {
      const result = waveform.calculateVisibleTimeRange({
        scrollLeft: 500,
        containerWidth: 1000,
        waveformWidth: 5000,
        duration: 100,
      })

      expect(result).toEqual({
        start: 10,
        end: 30,
      })
    })

    it('should handle edge cases', () => {
      const result = waveform.calculateVisibleTimeRange({
        scrollLeft: 0,
        containerWidth: 1000,
        waveformWidth: 0,
        duration: 100,
      })

      expect(result).toEqual({ start: 0, end: 0 })
    })
  })

  describe('clamp', () => {
    it('should clamp values correctly', () => {
      expect(waveform.clamp(5, 0, 10)).toBe(5)
      expect(waveform.clamp(-5, 0, 10)).toBe(0)
      expect(waveform.clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('calculateBarDimensions', () => {
    it('should calculate bar dimensions', () => {
      const result = waveform.calculateBarDimensions({
        barWidth: 4,
        barGap: 2,
        pixelRatio: 1,
      })

      expect(result).toEqual({
        barWidth: 4,
        barGap: 2,
        barSpacing: 6,
      })
    })

    it('should use default gap when not provided', () => {
      const result = waveform.calculateBarDimensions({
        barWidth: 4,
        pixelRatio: 1,
      })

      expect(result.barGap).toBe(2) // barWidth / 2
      expect(result.barSpacing).toBe(6)
    })
  })

  describe('normalize', () => {
    it('should normalize values between ranges', () => {
      expect(waveform.normalize(5, 0, 10, 0, 100)).toBe(50)
      expect(waveform.normalize(0, 0, 10, 0, 100)).toBe(0)
      expect(waveform.normalize(10, 0, 10, 0, 100)).toBe(100)
    })

    it('should handle edge cases', () => {
      expect(waveform.normalize(5, 0, 0, 0, 100)).toBe(0)
    })
  })

  describe('pixelToRelative and relativeToPixel', () => {
    it('should convert between pixel and relative positions', () => {
      expect(waveform.pixelToRelative(500, 1000)).toBe(0.5)
      expect(waveform.relativeToPixel(0.5, 1000)).toBe(500)
    })

    it('should clamp relative values', () => {
      expect(waveform.pixelToRelative(-100, 1000)).toBe(0)
      expect(waveform.pixelToRelative(1500, 1000)).toBe(1)
    })

    it('should handle zero width', () => {
      expect(waveform.pixelToRelative(100, 0)).toBe(0)
    })
  })
})
