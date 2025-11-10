import {
  generateChannelPath,
  buildWaveformPathData,
  generateWaveformPath,
  renderLineWaveform,
  renderBarWaveform,
  renderWaveformWithChannelData,
} from '../waveform-renderer'

// Mock Path2D for jsdom
global.Path2D = class Path2D {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_path?: string | Path2D) {
    // Mock implementation
  }
} as any

describe('waveform-renderer', () => {
  describe('generateChannelPath', () => {
    it('should generate path for single channel from middle', () => {
      const channelData = new Float32Array([0, 0.5, 1, 0.5, 0, -0.5, -1])
      const width = 100
      const height = 100
      const vScale = 1

      const path = generateChannelPath(channelData, width, height, vScale, false)

      expect(path[0]).toMatch(/^M /)
      expect(path.length).toBe(channelData.length)
      expect(path.every((cmd) => cmd.match(/^[ML] /))).toBe(true)
    })

    it('should generate path from bottom', () => {
      const channelData = new Float32Array([0, 0.5, 1])
      const width = 100
      const height = 100
      const vScale = 1

      const path = generateChannelPath(channelData, width, height, vScale, true)

      expect(path[0]).toMatch(/^M /)
      expect(path.length).toBe(3)
      // When startFromBottom=true, y should be calculated from bottom
      expect(path[0]).toContain('100') // y=100 for value=0
    })

    it('should handle empty channel data', () => {
      const channelData = new Float32Array([])
      const width = 100
      const height = 100
      const vScale = 1

      const path = generateChannelPath(channelData, width, height, vScale)

      expect(path.length).toBe(0)
    })

    it('should apply vertical scale', () => {
      const channelData = new Float32Array([0, 1])
      const width = 100
      const height = 100
      const vScale = 0.5

      const path = generateChannelPath(channelData, width, height, vScale, false)

      // With vScale=0.5, the waveform should be half as tall
      expect(path.length).toBe(2)
    })
  })

  describe('buildWaveformPathData', () => {
    it('should build path for mono channel', () => {
      const channelData = [new Float32Array([0, 0.5, 1, 0.5, 0])]
      const width = 100
      const height = 100
      const vScale = 1

      const pathData = buildWaveformPathData(channelData, width, height, vScale)

      expect(pathData).toContain('M ')
      expect(pathData).toContain('L ')
      expect(pathData).toContain('Z')
    })

    it('should build path for stereo channels', () => {
      const channelData = [new Float32Array([0, 0.5, 1]), new Float32Array([0, -0.5, -1])]
      const width = 100
      const height = 100
      const vScale = 1

      const pathData = buildWaveformPathData(channelData, width, height, vScale)

      expect(pathData).toContain('M ')
      expect(pathData).toContain('L ')
      expect(pathData).toContain('Z')
    })

    it('should return empty string for empty data', () => {
      const channelData = [new Float32Array([])]
      const width = 100
      const height = 100
      const vScale = 1

      const pathData = buildWaveformPathData(channelData, width, height, vScale)

      expect(pathData).toBe('')
    })

    it('should handle missing channel data', () => {
      const channelData: Float32Array[] = []
      const width = 100
      const height = 100
      const vScale = 1

      const pathData = buildWaveformPathData(channelData, width, height, vScale)

      expect(pathData).toBe('')
    })
  })

  describe('generateWaveformPath', () => {
    it('should generate path with default options', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const width = 100
      const height = 100

      const pathData = generateWaveformPath(channelData, width, height)

      expect(pathData).toContain('M ')
      expect(pathData).toContain('Z')
    })

    it('should generate path with custom vScale', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const width = 100
      const height = 100

      const pathData = generateWaveformPath(channelData, width, height, { vScale: 0.5 })

      expect(pathData).toContain('M ')
      expect(pathData).toContain('Z')
    })
  })

  describe('renderLineWaveform', () => {
    let ctx: CanvasRenderingContext2D

    beforeEach(() => {
      // Mock canvas context
      ctx = {
        fillStyle: '',
        fill: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        globalCompositeOperation: 'source-over',
      } as unknown as CanvasRenderingContext2D
    })

    it('should render waveform without progress', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const fillSpy = jest.spyOn(ctx, 'fill')

      renderLineWaveform(ctx, channelData, 100, 100, 1, 'blue')

      expect(fillSpy).toHaveBeenCalled()
      expect(ctx.fillStyle).toBe('blue')
    })

    it('should render waveform with progress', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const fillSpy = jest.spyOn(ctx, 'fill')
      const saveSpy = jest.spyOn(ctx, 'save')
      const restoreSpy = jest.spyOn(ctx, 'restore')

      renderLineWaveform(ctx, channelData, 100, 100, 1, 'blue', 'red', 0.5)

      expect(fillSpy).toHaveBeenCalledTimes(2) // Main + progress
      expect(saveSpy).toHaveBeenCalled()
      expect(restoreSpy).toHaveBeenCalled()
    })

    it('should not render progress if progress is 0', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const fillSpy = jest.spyOn(ctx, 'fill')

      renderLineWaveform(ctx, channelData, 100, 100, 1, 'blue', 'red', 0)

      expect(fillSpy).toHaveBeenCalledTimes(1) // Only main waveform
    })

    it('should not render progress if progressColor is not provided', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const fillSpy = jest.spyOn(ctx, 'fill')

      renderLineWaveform(ctx, channelData, 100, 100, 1, 'blue', undefined, 0.5)

      expect(fillSpy).toHaveBeenCalledTimes(1) // Only main waveform
    })
  })

  describe('renderBarWaveform', () => {
    let ctx: CanvasRenderingContext2D

    beforeEach(() => {
      // Mock canvas context
      ctx = {
        fillStyle: '',
        fillRect: jest.fn(),
        fill: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        quadraticCurveTo: jest.fn(),
        closePath: jest.fn(),
      } as unknown as CanvasRenderingContext2D
    })

    it('should render bars without progress', () => {
      const segments = [
        { x: 0, y: 40, width: 2, height: 20 },
        { x: 10, y: 30, width: 2, height: 40 },
      ]
      const fillRectSpy = jest.spyOn(ctx, 'fillRect')

      renderBarWaveform(ctx, segments, undefined, 'blue')

      expect(fillRectSpy).toHaveBeenCalledTimes(2)
      expect(ctx.fillStyle).toBe('blue')
    })

    it('should render bars with progress', () => {
      const segments = [
        { x: 0, y: 40, width: 2, height: 20 },
        { x: 60, y: 30, width: 2, height: 40 },
      ]
      const fillRectSpy = jest.spyOn(ctx, 'fillRect')

      renderBarWaveform(ctx, segments, undefined, 'blue', 'red', 0.5, 100)

      expect(fillRectSpy).toHaveBeenCalledTimes(2)
      // First bar should be red (progress), second blue (no progress)
    })

    it('should render rounded bars', () => {
      const segments = [{ x: 0, y: 40, width: 2, height: 20 }]
      const fillSpy = jest.spyOn(ctx, 'fill')
      const beginPathSpy = jest.spyOn(ctx, 'beginPath')

      renderBarWaveform(ctx, segments, 2, 'blue')

      expect(beginPathSpy).toHaveBeenCalled()
      expect(fillSpy).toHaveBeenCalled()
    })

    it('should handle empty segments', () => {
      const segments: Array<{ x: number; y: number; width: number; height: number }> = []
      const fillRectSpy = jest.spyOn(ctx, 'fillRect')

      renderBarWaveform(ctx, segments, undefined, 'blue')

      expect(fillRectSpy).not.toHaveBeenCalled()
    })
  })

  describe('renderWaveformWithChannelData', () => {
    let ctx: CanvasRenderingContext2D

    beforeEach(() => {
      // Mock canvas context
      ctx = {
        fillStyle: '',
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        fill: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        globalCompositeOperation: 'source-over',
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        quadraticCurveTo: jest.fn(),
        closePath: jest.fn(),
      } as unknown as CanvasRenderingContext2D
    })

    it('should render line waveform', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const clearRectSpy = jest.spyOn(ctx, 'clearRect')
      const fillSpy = jest.spyOn(ctx, 'fill')

      renderWaveformWithChannelData(ctx, channelData, {
        width: 100,
        height: 100,
        vScale: 1,
        waveColor: 'blue',
      })

      expect(clearRectSpy).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(fillSpy).toHaveBeenCalled()
    })

    it('should render bar waveform', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const clearRectSpy = jest.spyOn(ctx, 'clearRect')
      const fillRectSpy = jest.spyOn(ctx, 'fillRect')

      const segments = [{ x: 0, y: 40, width: 2, height: 20 }]

      renderWaveformWithChannelData(ctx, channelData, {
        width: 100,
        height: 100,
        vScale: 1,
        waveColor: 'blue',
        shouldRenderBars: true,
        barSegments: segments,
      })

      expect(clearRectSpy).toHaveBeenCalled()
      expect(fillRectSpy).toHaveBeenCalled()
    })

    it('should render with progress', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const fillSpy = jest.spyOn(ctx, 'fill')

      renderWaveformWithChannelData(ctx, channelData, {
        width: 100,
        height: 100,
        vScale: 1,
        waveColor: 'blue',
        progressColor: 'red',
        progress: 0.5,
      })

      expect(fillSpy).toHaveBeenCalledTimes(2) // Main + progress
    })

    it('should render bar waveform with rounded bars', () => {
      const channelData = [new Float32Array([0, 0.5, 1])]
      const fillSpy = jest.spyOn(ctx, 'fill')

      const segments = [{ x: 0, y: 40, width: 2, height: 20 }]

      renderWaveformWithChannelData(ctx, channelData, {
        width: 100,
        height: 100,
        vScale: 1,
        waveColor: 'blue',
        shouldRenderBars: true,
        barSegments: segments,
        barRadius: 2,
      })

      expect(fillSpy).toHaveBeenCalled()
    })
  })
})
