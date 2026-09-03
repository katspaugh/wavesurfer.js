import {
  MAX_CANVAS_WIDTH,
  MAX_NODES,
  calculateBarHeights,
  calculateGlobalPeak,
  calculateBarRenderConfig,
  calculateBarSegments,
  calculateLinePaths,
  calculateSingleCanvasWidth,
  calculateVerticalScale,
  calculateWaveformLayout,
  clampToUnit,
  clampWidthToBarGrid,
  computeCanvasPlan,
  getLazyRenderRange,
  getPixelRatio,
  getRelativePointerPosition,
  resolveBarYPosition,
  resolveChannelHeight,
  resolveColorValue,
  roundToHalfAwayFromZero,
  shouldClearCanvases,
  shouldRenderBars,
  sliceChannelData,
} from '../renderer-utils.js'
import type { CanvasSlot } from '../renderer-utils.js'
import type { WaveSurferOptions } from '../wavesurfer.js'

describe('renderer-utils', () => {
  describe('clampToUnit', () => {
    it('clamps numbers to the [0, 1] range', () => {
      expect(clampToUnit(-0.5)).toBe(0)
      expect(clampToUnit(0.3)).toBe(0.3)
      expect(clampToUnit(1.8)).toBe(1)
    })

    it('maps NaN to 0 instead of passing it through', () => {
      // NaN reaches clampToUnit when pointer math divides by a zero-size
      // rect (hidden container) -- it must not propagate into seeks.
      expect(clampToUnit(NaN)).toBe(0)
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

    it('returns finite coordinates for a zero-size rect (hidden container)', () => {
      const rect = {
        left: 10,
        top: 20,
        width: 0,
        height: 0,
      } as DOMRect
      expect(getRelativePointerPosition(rect, 110, 70)).toEqual([0, 0])
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
    let createLinearGradient: jest.Mock
    let addColorStop: jest.Mock

    // Mock getContext at the prototype level (not on one specific canvas):
    // resolveColorValue reuses a single module-level scratch canvas across
    // calls, so a per-instance spy on a freshly created element would never
    // be hit again after the first call cached the scratch canvas.
    beforeEach(() => {
      addColorStop = jest.fn()
      createLinearGradient = jest.fn(() => ({ addColorStop }))
      jest
        .spyOn(window.HTMLCanvasElement.prototype, 'getContext')
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

    it('reuses a single scratch canvas instead of creating one per call', () => {
      // Gradient resolution runs on every draw, including scroll-time lazy
      // draws -- a throwaway <canvas> per call caused GC churn.
      const realCreateElement = document.createElement.bind(document)
      const createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockImplementation((tagName: string) => realCreateElement(tagName))

      resolveColorValue(['#000', '#fff'], 1)
      resolveColorValue(['#111', '#eee'], 1)
      resolveColorValue(['#222', '#ddd'], 1)

      const canvasCreations = createElementSpy.mock.calls.filter(([tag]) => tag === 'canvas').length
      // At most one creation across all calls (zero if an earlier test in
      // this file already warmed the module-level scratch canvas).
      expect(canvasCreations).toBeLessThanOrEqual(1)
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

    it('uses the same barWidth/barGap defaults as the bar-drawing site', () => {
      // Bars enabled via barGap only: the draw site defaults barWidth to 1
      // (device px at dpr=1), not 0.5 -- grid = 1 + 2 = 3.
      const container = document.createElement('div')
      expect(clampWidthToBarGrid(10, { container, barGap: 2 })).toBe(9)
      // Bars enabled via barAlign only: draw defaults are barWidth 1, gap 0
      // (no gap when barWidth is unset) -- grid = 1.
      expect(clampWidthToBarGrid(10.5, { container, barAlign: 'top' })).toBe(10)
    })

    it('agrees with calculateBarRenderConfig barSpacing at pixelRatio 1', () => {
      const container = document.createElement('div')
      const cases: Partial<WaveSurferOptions>[] = [
        { barWidth: 2, barGap: 1 },
        { barWidth: 3 },
        { barGap: 2 },
        { barAlign: 'top' },
      ]
      for (const partial of cases) {
        const opts = { container, ...partial } as WaveSurferOptions
        const { barSpacing } = calculateBarRenderConfig({
          width: 100,
          height: 50,
          length: 10,
          options: opts,
          pixelRatio: 1,
        })
        // A width already aligned to the drawn spacing must survive the clamp
        expect(clampWidthToBarGrid(barSpacing * 7, opts)).toBe(barSpacing * 7)
      }
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
    // Args are built as variables (with the legacy `totalWidth` key kept as a
    // harmless excess property) so the same tests compile against both the
    // old average-width signature and the fixed exact-width one.
    it('returns the viewport-covering canvas indices plus one prefetch on each side', () => {
      // Viewport [50, 90) with 40px canvases covers indices 1-2; prefetch 0 and 3.
      const args = { scrollLeft: 50, clientWidth: 40, singleCanvasWidth: 40, numCanvases: 5, totalWidth: 200 }
      expect(getLazyRenderRange(args)).toEqual([0, 1, 2, 3])
    })

    it('covers the viewport edges exactly instead of using the average canvas width', () => {
      // 10 canvases of 400px over totalWidth 4000; a bar-grid-clamped canvas
      // is slightly narrower than the 402px viewport. At scrollLeft 799 the
      // viewport spans [799, 1201) -- canvases 1, 2 AND 3. The old
      // average-width math (floor(scrollLeft / totalWidth * numCanvases) ± 1)
      // returned [0, 1, 2], leaving an undrawn strip at the right edge.
      const args = { scrollLeft: 799, clientWidth: 402, singleCanvasWidth: 400, numCanvases: 10, totalWidth: 4000 }
      expect(getLazyRenderRange(args)).toEqual(expect.arrayContaining([1, 2, 3]))
    })

    it('clamps the range to existing canvases at the far end', () => {
      const args = { scrollLeft: 10_000, clientWidth: 400, singleCanvasWidth: 400, numCanvases: 5, totalWidth: 2000 }
      const range = getLazyRenderRange(args)
      expect(range).toContain(4) // the last canvas
      expect(Math.max(...range)).toBe(5) // at most one prefetch past the end
    })

    it('defaults to the first canvas when there is nothing to window', () => {
      const zeroWidth = { scrollLeft: 0, clientWidth: 0, singleCanvasWidth: 0, numCanvases: 3, totalWidth: 0 }
      expect(getLazyRenderRange(zeroWidth)).toEqual([0])
      const zeroCanvases = { scrollLeft: 0, clientWidth: 100, singleCanvasWidth: 100, numCanvases: 0, totalWidth: 300 }
      expect(getLazyRenderRange(zeroCanvases)).toEqual([0])
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

  describe('roundToHalfAwayFromZero', () => {
    it('rounds to the nearest integer, not outward (the old version ceiled)', () => {
      // The old implementation ceiled the magnitude to the next half, biasing
      // every reRender scroll compensation outward -- cursor drift on
      // repeated wheel-zoom.
      expect(roundToHalfAwayFromZero(1.2)).toBe(1)
      expect(roundToHalfAwayFromZero(-1.2)).toBe(-1)
      expect(roundToHalfAwayFromZero(2.4)).toBe(2)
      expect(roundToHalfAwayFromZero(1.6)).toBe(2)
    })

    it('rounds exact halves away from zero', () => {
      expect(roundToHalfAwayFromZero(0.5)).toBe(1)
      expect(roundToHalfAwayFromZero(-0.5)).toBe(-1)
      expect(roundToHalfAwayFromZero(1.5)).toBe(2)
      expect(roundToHalfAwayFromZero(-1.5)).toBe(-2)
    })

    it('leaves integers and zero unchanged', () => {
      expect(roundToHalfAwayFromZero(3)).toBe(3)
      expect(roundToHalfAwayFromZero(-3)).toBe(-3)
      expect(roundToHalfAwayFromZero(0)).toBe(0)
    })
  })

  describe('computeCanvasPlan', () => {
    const options = {} as WaveSurferOptions

    it('splits total width into clamped slots', () => {
      const plan = computeCanvasPlan({ totalWidth: 2500, clientWidth: 500, options })
      expect(plan.numCanvases).toBe(Math.ceil(2500 / plan.singleCanvasWidth))
      expect(plan.slots.length).toBe(plan.numCanvases)
      const last: CanvasSlot = plan.slots[plan.slots.length - 1]
      expect(last.offset + last.width).toBeLessThanOrEqual(2500 + 1)
      plan.slots.forEach((s, i) => expect(s.offset).toBe(i * plan.singleCanvasWidth))
    })

    it('returns an empty plan when singleCanvasWidth is 0', () => {
      const plan = computeCanvasPlan({ totalWidth: 0, clientWidth: 0, options })
      expect(plan.slots).toEqual([])
      expect(plan.numCanvases).toBe(0)
      expect(plan.singleCanvasWidth).toBe(0)
    })

    it('drops zero-width tail slots clamped away by the bar grid', () => {
      const barOptions = { barWidth: 3, barGap: 1 } as WaveSurferOptions
      const plan = computeCanvasPlan({ totalWidth: 1001, clientWidth: 500, options: barOptions })
      plan.slots.forEach((s) => expect(s.width).toBeGreaterThan(0))
    })
  })
})

describe('calculateGlobalPeak', () => {
  it('returns the max absolute sample across ALL channels', () => {
    expect(calculateGlobalPeak([Float32Array.from([0.1, -0.4, 0.2]), Float32Array.from([0.3, 0.8, -0.5])])).toBeCloseTo(
      0.8,
    )
  })

  it('returns 0 for silent or empty data', () => {
    expect(calculateGlobalPeak([Float32Array.from([0, 0])])).toBe(0)
    expect(calculateGlobalPeak([])).toBe(0)
  })
})
