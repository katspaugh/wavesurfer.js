import {
  MAX_CANVAS_WIDTH,
  MAX_NODES,
  calculateBarHeights,
  calculateBarRenderConfig,
  calculateBarSegments,
  calculateLinePaths,
  calculateScrollPercentages,
  calculateSingleCanvasWidth,
  calculateVerticalScale,
  calculateWaveformLayout,
  clampToUnit,
  clampWidthToBarGrid,
  getLazyRenderRange,
  getPixelRatio,
  getRelativePointerPosition,
  resolveBarYPosition,
  resolveChannelHeight,
  resolveColorValue,
  shouldClearCanvases,
  shouldRenderBars,
  sliceChannelData,
} from '../renderer-utils.js'
import type { WaveSurferOptions } from '../wavesurfer.js'

describe('renderer-utils', () => {
  describe('clampToUnit', () => {
    it('clamps numbers to the [0, 1] range', () => {
      expect(clampToUnit(-0.5)).toBe(0)
      expect(clampToUnit(0.3)).toBe(0.3)
      expect(clampToUnit(1.8)).toBe(1)
    })
  })

  describe('calculateBarRenderConfig', () => {
    const options: WaveSurferOptions = {
      container: document.createElement('div'),
      barWidth: 2,
      barGap: 1,
      barRadius: 3,
    }

    it('derives spacing values and scaling information', () => {
      const config = calculateBarRenderConfig({
        width: 100,
        height: 50,
        length: 10,
        options,
        pixelRatio: 2,
      })

      expect(config).toEqual({
        halfHeight: 25,
        barWidth: 4,
        barGap: 2,
        barRadius: 3,
        barIndexScale: 100 / ((4 + 2) * 10),
        barSpacing: 6,
        barMinHeight: 0,
      })
    })
  })

  describe('calculateBarHeights', () => {
    it('returns rounded heights and ensures total height is at least 1', () => {
      expect(
        calculateBarHeights({
          maxTop: 0.5,
          maxBottom: 0.25,
          halfHeight: 20,
          vScale: 1,
        }),
      ).toEqual({ topHeight: 10, totalHeight: 15 })

      expect(
        calculateBarHeights({
          maxTop: 0,
          maxBottom: 0,
          halfHeight: 20,
          vScale: 1,
        }),
      ).toEqual({ topHeight: 0, totalHeight: 1 })
    })

    it('ensures total height is at least barMinHeight', () => {
      expect(
        calculateBarHeights({
          maxTop: 0,
          maxBottom: 0,
          halfHeight: 20,
          vScale: 1,
          barMinHeight: 10,
        }),
      ).toEqual({ topHeight: 5, totalHeight: 10 })

      expect(
        calculateBarHeights({
          maxTop: 0,
          maxBottom: 0,
          halfHeight: 20,
          vScale: 1,
          barMinHeight: 10,
          barAlign: 'top',
        }),
      ).toEqual({ topHeight: 0, totalHeight: 10 })
    })
  })

  describe('resolveBarYPosition', () => {
    const baseArgs = {
      halfHeight: 20,
      topHeight: 10,
      totalHeight: 20,
      canvasHeight: 40,
    }

    it('positions bars relative to alignment', () => {
      expect(
        resolveBarYPosition({
          barAlign: 'top',
          ...baseArgs,
        }),
      ).toBe(0)

      expect(
        resolveBarYPosition({
          barAlign: 'bottom',
          ...baseArgs,
        }),
      ).toBe(20)

      expect(
        resolveBarYPosition({
          barAlign: undefined,
          ...baseArgs,
        }),
      ).toBe(10)
    })
  })

  describe('calculateBarSegments', () => {
    const options: WaveSurferOptions = {
      container: document.createElement('div'),
    }

    it('aggregates bar segments across the channel data', () => {
      const { barIndexScale, barSpacing, barWidth, halfHeight } = calculateBarRenderConfig({
        width: 6,
        height: 20,
        length: 6,
        options,
        pixelRatio: 1,
      })
      const segments = calculateBarSegments({
        channelData: [
          new Float32Array([0.2, -0.4, 0.6, -0.8, 1, -1]),
          new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5, -0.6]),
        ],
        barIndexScale,
        barSpacing,
        barWidth,
        halfHeight,
        vScale: 1,
        canvasHeight: 40,
        barAlign: undefined,
        barMinHeight: 0,
      })

      expect(segments).toEqual([
        { x: 0, y: 8, width: 1, height: 3 },
        { x: 1, y: 6, width: 1, height: 6 },
        { x: 2, y: 4, width: 1, height: 9 },
        { x: 3, y: 2, width: 1, height: 12 },
        { x: 4, y: 0, width: 1, height: 15 },
        { x: 5, y: 0, width: 1, height: 16 },
      ])
    })

    it('ensures bars are at least barMinHeight tall', () => {
      const height = 40
      const length = 10

      const { barIndexScale, barSpacing, barWidth, halfHeight } = calculateBarRenderConfig({
        width: 100,
        height,
        length,
        options,
        pixelRatio: 1,
      })

      const segments = calculateBarSegments({
        channelData: [
          new Float32Array(length).fill(0.001), // Very small values
        ],
        barIndexScale,
        barSpacing,
        barWidth,
        halfHeight,
        vScale: 1,
        canvasHeight: height / 2,
        barAlign: undefined,
        barMinHeight: 10,
      })

      expect(segments.length).toBeGreaterThan(0)
      expect(segments[0].height).toBe(10)
      expect(segments[0].y).toBe(15) // Centered: 20 - 10/2
    })
  })

  describe('getRelativePointerPosition', () => {
    it('returns pointer coordinates as relative offsets', () => {
      const rect = {
        left: 10,
        top: 20,
        width: 200,
        height: 100,
      } as DOMRect
      expect(getRelativePointerPosition(rect, 110, 70)).toEqual([0.5, 0.5])
    })
  })

  describe('resolveChannelHeight', () => {
    it('returns numeric height when provided', () => {
      expect(
        resolveChannelHeight({
          optionsHeight: 150,
          parentHeight: 0,
          numberOfChannels: 2,
        }),
      ).toBe(150)
    })

    it('splits height across channels when auto with overlays disabled', () => {
      const splitChannels: NonNullable<WaveSurferOptions['splitChannels']> = [{ overlay: false }, { overlay: false }]
      expect(
        resolveChannelHeight({
          optionsHeight: 'auto',
          optionsSplitChannels: splitChannels,
          parentHeight: 200,
          numberOfChannels: 2,
        }),
      ).toBe(100)
    })

    it('falls back to default height when invalid', () => {
      expect(
        resolveChannelHeight({
          optionsHeight: 'invalid' as never,
          parentHeight: 0,
          numberOfChannels: 2,
          defaultHeight: 75,
        }),
      ).toBe(75)
    })
  })

  describe('getPixelRatio', () => {
    it('never returns less than 1', () => {
      expect(getPixelRatio(undefined)).toBe(1)
      expect(getPixelRatio(0.5)).toBe(1)
      expect(getPixelRatio(2)).toBe(2)
    })
  })

  describe('shouldRenderBars', () => {
    const options: WaveSurferOptions = { container: document.createElement('div') }

    it('returns true when any bar option is configured', () => {
      expect(shouldRenderBars({ ...options, barWidth: 1 })).toBe(true)
      expect(shouldRenderBars({ ...options, barGap: 2 })).toBe(true)
      expect(shouldRenderBars({ ...options, barAlign: 'top' })).toBe(true)
    })

    it('returns false when bars are not configured', () => {
      expect(shouldRenderBars(options)).toBe(false)
    })
  })

  describe('resolveColorValue', () => {
    const canvas = document.createElement('canvas')

    let createLinearGradient: jest.Mock
    let addColorStop: jest.Mock

    beforeEach(() => {
      createLinearGradient = jest.fn(() => ({ addColorStop }))
      addColorStop = jest.fn()

      jest.spyOn(document, 'createElement').mockImplementation(() => canvas)
      jest
        .spyOn(canvas, 'getContext')
        .mockImplementation(() => ({ createLinearGradient }) as unknown as CanvasRenderingContext2D)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('returns string values unchanged', () => {
      expect(resolveColorValue('#000', 2)).toBe('#000')
    })

    it('falls back to default gray when gradient list is empty', () => {
      expect(resolveColorValue([], 2)).toBe('#999')
    })

    it('uses the single color when gradient list has one item', () => {
      expect(resolveColorValue(['#111'], 2)).toBe('#111')
    })

    it('creates a canvas gradient for multiple colors', () => {
      const gradient = resolveColorValue(['#000', '#fff'], 2) as { addColorStop: jest.Mock }
      expect(createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 300)
      expect(addColorStop).toHaveBeenCalledTimes(2)
      expect(addColorStop).toHaveBeenNthCalledWith(1, 0, '#000')
      expect(addColorStop).toHaveBeenNthCalledWith(2, 1, '#fff')
      expect(gradient.addColorStop).toBe(addColorStop)
    })
  })

  describe('calculateWaveformLayout', () => {
    const baseArgs = {
      duration: 2,
      parentWidth: 300,
      pixelRatio: 1,
    }

    it('uses parent width when not scrollable and fillParent is true', () => {
      expect(calculateWaveformLayout({ ...baseArgs, minPxPerSec: 10, fillParent: true })).toEqual({
        scrollWidth: 20,
        isScrollable: false,
        useParentWidth: true,
        width: 300,
      })
    })

    it('uses scroll width when waveform exceeds parent width', () => {
      expect(calculateWaveformLayout({ ...baseArgs, minPxPerSec: 500, fillParent: true })).toEqual({
        scrollWidth: 1000,
        isScrollable: true,
        useParentWidth: false,
        width: 1000,
      })
    })
  })

  describe('clampWidthToBarGrid', () => {
    const options: WaveSurferOptions = { container: document.createElement('div'), barWidth: 2, barGap: 1 }

    it('returns original width when bars are disabled', () => {
      expect(clampWidthToBarGrid(123, { container: document.createElement('div') })).toBe(123)
    })

    it('clamps width down to align with bar grid spacing', () => {
      expect(clampWidthToBarGrid(10, options)).toBe(9)
    })
  })

  describe('calculateSingleCanvasWidth', () => {
    const options: WaveSurferOptions = { container: document.createElement('div'), barWidth: 2, barGap: 1 }

    it('limits width by canvas cap, client size, and total width', () => {
      expect(
        calculateSingleCanvasWidth({
          clientWidth: 9000,
          totalWidth: 5000,
          options,
        }),
      ).toBe(clampWidthToBarGrid(Math.min(MAX_CANVAS_WIDTH, 5000), options))
    })
  })

  describe('sliceChannelData', () => {
    it('returns proportional slices based on offset and width', () => {
      const channel = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8])
      const slices = sliceChannelData({
        channelData: [channel, channel],
        offset: 100,
        clampedWidth: 50,
        totalWidth: 200,
      })

      expect(slices[0]).toEqual(new Float32Array([5, 6]))
      expect(slices[1]).toEqual(new Float32Array([5, 6]))
    })
  })

  describe('shouldClearCanvases', () => {
    it('clears when exceeding maximum nodes', () => {
      expect(shouldClearCanvases(MAX_NODES)).toBe(false)
      expect(shouldClearCanvases(MAX_NODES + 1)).toBe(true)
    })
  })

  describe('getLazyRenderRange', () => {
    it('returns surrounding canvas indices', () => {
      expect(
        getLazyRenderRange({
          scrollLeft: 50,
          totalWidth: 200,
          numCanvases: 5,
        }),
      ).toEqual([0, 1, 2])
    })

    it('defaults to the first canvas when width is zero', () => {
      expect(getLazyRenderRange({ scrollLeft: 0, totalWidth: 0, numCanvases: 3 })).toEqual([0])
    })
  })

  describe('calculateVerticalScale', () => {
    it('returns base scale when not normalizing', () => {
      expect(
        calculateVerticalScale({
          channelData: [new Float32Array([0.5])],
          barHeight: 2,
          normalize: false,
        }),
      ).toBe(2)
    })

    it('normalizes against the maximum magnitude when requested', () => {
      expect(
        calculateVerticalScale({
          channelData: [new Float32Array([0.25, -0.5])],
          barHeight: 2,
          normalize: true,
        }),
      ).toBe(4)
    })
  })

  describe('calculateLinePaths', () => {
    it('produces symmetrical paths for mirrored channel data', () => {
      const [topPath, bottomPath] = calculateLinePaths({
        channelData: [new Float32Array([0, 0.5, 1]), new Float32Array([0, 0.25, 0.75])],
        width: 6,
        height: 8,
        vScale: 1,
      })

      expect(topPath[0]).toEqual({ x: 0, y: 4 })
      expect(topPath[topPath.length - 1]).toEqual({ x: 6, y: 4 })
      expect(bottomPath[0]).toEqual({ x: 0, y: 4 })
      expect(bottomPath[bottomPath.length - 1]).toEqual({ x: 6, y: 4 })
      expect(topPath).toEqual([
        { x: 0, y: 4 },
        { x: 0, y: 3 },
        { x: 2, y: 2 },
        { x: 4, y: 0 },
        { x: 6, y: 4 },
      ])
      expect(bottomPath).toEqual([
        { x: 0, y: 4 },
        { x: 0, y: 5 },
        { x: 2, y: 5 },
        { x: 4, y: 7 },
        { x: 6, y: 4 },
      ])
    })
  })

  describe('calculateScrollPercentages', () => {
    it('returns full range when scroll width is zero', () => {
      expect(
        calculateScrollPercentages({
          scrollLeft: 0,
          clientWidth: 100,
          scrollWidth: 0,
        }),
      ).toEqual({ startX: 0, endX: 1 })
    })

    it('returns start and end ratios relative to scroll width', () => {
      expect(
        calculateScrollPercentages({
          scrollLeft: 50,
          clientWidth: 100,
          scrollWidth: 400,
        }),
      ).toEqual({ startX: 0.125, endX: 0.375 })
    })

    it('clamps values to 0-1 range', () => {
      expect(
        calculateScrollPercentages({
          scrollLeft: -10,
          clientWidth: 100,
          scrollWidth: 400,
        }),
      ).toEqual({ startX: 0, endX: 0.225 })
    })
  })
})
