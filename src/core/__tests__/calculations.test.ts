/**
 * Unit tests for core/calculations.ts
 * Testing pure calculation functions that are actually used in the codebase
 */

import {
  getRelativePointerPosition,
  clampToUnit,
  calculateScrollPercentages,
  calculateWaveformLayout,
} from '../calculations'

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
})
