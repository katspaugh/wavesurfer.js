/**
 * Unit tests for core/calculations.ts
 * Testing pure calculation functions
 */

import {
  calculateProgress,
  calculateTimeFromProgress,
  clampTime,
  calculateZoomWidth,
  calculateMinPxPerSec,
  calculateScrollPercentages,
  calculateScrollPosition,
  calculateCanvasSize,
  getRelativePointerPosition,
  clampToUnit,
  clamp,
  calculateWaveformLayout,
  calculatePixelToTime,
  calculateTimeToPixel,
  pixelToTime,
  timeToPixel,
} from '../calculations'

describe('Time/Progress Calculations', () => {
  describe('calculateProgress', () => {
    it('should calculate progress as percentage', () => {
      expect(calculateProgress(5, 10)).toBe(0.5)
      expect(calculateProgress(0, 10)).toBe(0)
      expect(calculateProgress(10, 10)).toBe(1)
    })

    it('should handle zero duration', () => {
      expect(calculateProgress(5, 0)).toBe(0)
    })

    it('should handle values beyond duration', () => {
      expect(calculateProgress(15, 10)).toBe(1.5)
    })
  })

  describe('calculateTimeFromProgress', () => {
    it('should calculate time from progress', () => {
      expect(calculateTimeFromProgress(0.5, 10)).toBe(5)
      expect(calculateTimeFromProgress(0, 10)).toBe(0)
      expect(calculateTimeFromProgress(1, 10)).toBe(10)
    })

    it('should handle fractional progress', () => {
      expect(calculateTimeFromProgress(0.25, 100)).toBe(25)
    })
  })

  describe('clampTime', () => {
    it('should clamp time to valid range', () => {
      expect(clampTime(5, 10)).toBe(5)
      expect(clampTime(-1, 10)).toBe(0)
      expect(clampTime(15, 10)).toBe(10)
    })

    it('should handle edge cases', () => {
      expect(clampTime(0, 10)).toBe(0)
      expect(clampTime(10, 10)).toBe(10)
    })
  })
})

describe('Zoom Calculations', () => {
  describe('calculateZoomWidth', () => {
    it('should calculate zoomed width', () => {
      expect(calculateZoomWidth(10, 50, 500)).toBe(500)
      expect(calculateZoomWidth(20, 50, 500)).toBe(1000)
    })

    it('should return at least container width', () => {
      expect(calculateZoomWidth(5, 50, 500)).toBe(500)
      expect(calculateZoomWidth(1, 10, 500)).toBe(500)
    })
  })

  describe('calculateMinPxPerSec', () => {
    it('should calculate pixels per second', () => {
      expect(calculateMinPxPerSec(10, 500)).toBe(50)
      expect(calculateMinPxPerSec(5, 1000)).toBe(200)
    })

    it('should handle zero duration', () => {
      expect(calculateMinPxPerSec(0, 500)).toBe(0)
    })
  })
})

describe('Scroll Calculations', () => {
  describe('calculateScrollPercentages', () => {
    it('should calculate scroll percentages', () => {
      const result = calculateScrollPercentages({
        scrollLeft: 100,
        scrollWidth: 1000,
        clientWidth: 500,
      })
      expect(result.startX).toBe(0.1)
      expect(result.endX).toBe(0.6)
    })

    it('should handle zero scroll width', () => {
      const result = calculateScrollPercentages({
        scrollLeft: 100,
        scrollWidth: 0,
        clientWidth: 500,
      })
      expect(result.startX).toBe(0)
      expect(result.endX).toBe(0)
    })

    it('should handle full scroll', () => {
      const result = calculateScrollPercentages({
        scrollLeft: 500,
        scrollWidth: 1000,
        clientWidth: 500,
      })
      expect(result.startX).toBe(0.5)
      expect(result.endX).toBe(1)
    })
  })

  describe('calculateScrollPosition', () => {
    it('should calculate scroll position from percentage', () => {
      expect(calculateScrollPosition(0.5, 1000)).toBe(500)
      expect(calculateScrollPosition(0, 1000)).toBe(0)
      expect(calculateScrollPosition(1, 1000)).toBe(1000)
    })
  })
})

describe('Canvas Calculations', () => {
  describe('calculateCanvasSize', () => {
    it('should account for pixel ratio', () => {
      const result = calculateCanvasSize(500, 200, 2)
      expect(result.width).toBe(1000)
      expect(result.height).toBe(400)
    })

    it('should handle fractional sizes', () => {
      const result = calculateCanvasSize(501, 201, 2)
      expect(result.width).toBe(1002)
      expect(result.height).toBe(402)
    })

    it('should handle pixel ratio of 1', () => {
      const result = calculateCanvasSize(500, 200, 1)
      expect(result.width).toBe(500)
      expect(result.height).toBe(200)
    })
  })
})

describe('Position Calculations', () => {
  describe('getRelativePointerPosition', () => {
    it('should calculate relative position', () => {
      const rect = { left: 100, top: 50, width: 500, height: 200 }
      const [x, y] = getRelativePointerPosition(rect, 350, 150)
      expect(x).toBe(0.5)
      expect(y).toBe(0.5)
    })

    it('should handle edge positions', () => {
      const rect = { left: 100, top: 50, width: 500, height: 200 }
      const [x1, y1] = getRelativePointerPosition(rect, 100, 50)
      expect(x1).toBe(0)
      expect(y1).toBe(0)

      const [x2, y2] = getRelativePointerPosition(rect, 600, 250)
      expect(x2).toBe(1)
      expect(y2).toBe(1)
    })

    it('should handle zero width/height', () => {
      const rect = { left: 100, top: 50, width: 0, height: 0 }
      const [x, y] = getRelativePointerPosition(rect, 150, 100)
      expect(x).toBe(0)
      expect(y).toBe(0)
    })
  })

  describe('clampToUnit', () => {
    it('should clamp values to 0-1 range', () => {
      expect(clampToUnit(0.5)).toBe(0.5)
      expect(clampToUnit(-0.5)).toBe(0)
      expect(clampToUnit(1.5)).toBe(1)
    })

    it('should handle edge values', () => {
      expect(clampToUnit(0)).toBe(0)
      expect(clampToUnit(1)).toBe(1)
    })
  })

  describe('clamp', () => {
    it('should clamp to specified range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('should work with negative ranges', () => {
      expect(clamp(0, -10, 10)).toBe(0)
      expect(clamp(-15, -10, 10)).toBe(-10)
      expect(clamp(15, -10, 10)).toBe(10)
    })
  })
})

describe('Layout Calculations', () => {
  describe('calculateWaveformLayout', () => {
    it('should calculate layout for scrollable waveform', () => {
      const result = calculateWaveformLayout({
        duration: 10,
        minPxPerSec: 100,
        parentWidth: 500,
        fillParent: false,
        pixelRatio: 2,
      })
      expect(result.scrollWidth).toBe(1000)
      expect(result.isScrollable).toBe(true)
      expect(result.useParentWidth).toBe(false)
      expect(result.width).toBe(2000) // scrollWidth * pixelRatio
    })

    it('should fill parent when requested and not scrollable', () => {
      const result = calculateWaveformLayout({
        duration: 3,
        minPxPerSec: 100,
        parentWidth: 500,
        fillParent: true,
        pixelRatio: 2,
      })
      expect(result.scrollWidth).toBe(300)
      expect(result.isScrollable).toBe(false)
      expect(result.useParentWidth).toBe(true)
      expect(result.width).toBe(1000) // parentWidth * pixelRatio
    })

    it('should not fill parent when scrollable', () => {
      const result = calculateWaveformLayout({
        duration: 10,
        minPxPerSec: 100,
        parentWidth: 500,
        fillParent: true,
        pixelRatio: 2,
      })
      expect(result.scrollWidth).toBe(1000)
      expect(result.isScrollable).toBe(true)
      expect(result.useParentWidth).toBe(false)
    })
  })

  describe('calculatePixelToTime', () => {
    it('should calculate seconds per pixel', () => {
      expect(calculatePixelToTime(10, 1000)).toBe(0.01)
      expect(calculatePixelToTime(100, 1000)).toBe(0.1)
    })

    it('should handle zero width', () => {
      expect(calculatePixelToTime(10, 0)).toBe(0)
    })
  })

  describe('calculateTimeToPixel', () => {
    it('should calculate pixels per second', () => {
      expect(calculateTimeToPixel(10, 1000)).toBe(100)
      expect(calculateTimeToPixel(5, 1000)).toBe(200)
    })

    it('should handle zero duration', () => {
      expect(calculateTimeToPixel(0, 1000)).toBe(0)
    })
  })

  describe('pixelToTime', () => {
    it('should convert pixel position to time', () => {
      expect(pixelToTime(500, 1000, 10)).toBe(5)
      expect(pixelToTime(0, 1000, 10)).toBe(0)
      expect(pixelToTime(1000, 1000, 10)).toBe(10)
    })

    it('should clamp to valid time range', () => {
      expect(pixelToTime(1500, 1000, 10)).toBe(10)
      expect(pixelToTime(-500, 1000, 10)).toBe(0)
    })

    it('should handle zero width', () => {
      expect(pixelToTime(500, 0, 10)).toBe(0)
    })
  })

  describe('timeToPixel', () => {
    it('should convert time to pixel position', () => {
      expect(timeToPixel(5, 1000, 10)).toBe(500)
      expect(timeToPixel(0, 1000, 10)).toBe(0)
      expect(timeToPixel(10, 1000, 10)).toBe(1000)
    })

    it('should handle zero duration', () => {
      expect(timeToPixel(5, 1000, 0)).toBe(0)
    })

    it('should handle fractional times', () => {
      expect(timeToPixel(2.5, 1000, 10)).toBe(250)
    })
  })
})
