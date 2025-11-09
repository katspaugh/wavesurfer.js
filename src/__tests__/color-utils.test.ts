import {
  parseColor,
  rgbaToString,
  rgbaToHex,
  interpolateColor,
  interpolateColors,
  generateColorStops,
  createCanvasGradient,
  type RGBA,
} from '../color-utils'

describe('color-utils', () => {
  describe('parseColor', () => {
    it('should parse 3-digit hex colors', () => {
      const color = parseColor('#abc')
      expect(color).toEqual({ r: 170, g: 187, b: 204, a: 1 })
    })

    it('should parse 6-digit hex colors', () => {
      const color = parseColor('#ff5500')
      expect(color).toEqual({ r: 255, g: 85, b: 0, a: 1 })
    })

    it('should parse 8-digit hex colors with alpha', () => {
      const color = parseColor('#ff550080')
      expect(color.r).toBe(255)
      expect(color.g).toBe(85)
      expect(color.b).toBe(0)
      expect(color.a).toBeCloseTo(0.5, 2)
    })

    it('should parse rgb() colors', () => {
      const color = parseColor('rgb(255, 128, 0)')
      expect(color).toEqual({ r: 255, g: 128, b: 0, a: 1 })
    })

    it('should parse rgba() colors', () => {
      const color = parseColor('rgba(255, 128, 0, 0.5)')
      expect(color).toEqual({ r: 255, g: 128, b: 0, a: 0.5 })
    })

    it('should parse named colors', () => {
      expect(parseColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
      expect(parseColor('blue')).toEqual({ r: 0, g: 0, b: 255, a: 1 })
      expect(parseColor('green')).toEqual({ r: 0, g: 128, b: 0, a: 1 })
    })

    it('should handle whitespace', () => {
      const color = parseColor('  #fff  ')
      expect(color).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    })

    it('should default to black for invalid colors', () => {
      const color = parseColor('invalid')
      expect(color).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    })
  })

  describe('rgbaToString', () => {
    it('should convert RGBA to CSS string', () => {
      const rgba: RGBA = { r: 255, g: 128, b: 0, a: 0.5 }
      expect(rgbaToString(rgba)).toBe('rgba(255,128,0,0.5)')
    })

    it('should round RGB values', () => {
      const rgba: RGBA = { r: 255.7, g: 128.3, b: 0.9, a: 0.5 }
      expect(rgbaToString(rgba)).toBe('rgba(256,128,1,0.5)')
    })

    it('should handle opaque colors', () => {
      const rgba: RGBA = { r: 100, g: 200, b: 50, a: 1 }
      expect(rgbaToString(rgba)).toBe('rgba(100,200,50,1)')
    })
  })

  describe('rgbaToHex', () => {
    it('should convert RGBA to hex without alpha', () => {
      const rgba: RGBA = { r: 255, g: 85, b: 0, a: 1 }
      expect(rgbaToHex(rgba)).toBe('#ff5500')
    })

    it('should convert RGBA to hex with alpha', () => {
      const rgba: RGBA = { r: 255, g: 85, b: 0, a: 0.5 }
      expect(rgbaToHex(rgba, true)).toBe('#ff550080')
    })

    it('should pad hex values with zeros', () => {
      const rgba: RGBA = { r: 0, g: 15, b: 255, a: 1 }
      expect(rgbaToHex(rgba)).toBe('#000fff')
    })
  })

  describe('interpolateColor', () => {
    const red: RGBA = { r: 255, g: 0, b: 0, a: 1 }
    const blue: RGBA = { r: 0, g: 0, b: 255, a: 1 }

    it('should return start color at t=0', () => {
      const result = interpolateColor(red, blue, 0)
      expect(result).toEqual(red)
    })

    it('should return end color at t=1', () => {
      const result = interpolateColor(red, blue, 1)
      expect(result).toEqual(blue)
    })

    it('should interpolate at t=0.5', () => {
      const result = interpolateColor(red, blue, 0.5)
      expect(result).toEqual({ r: 127.5, g: 0, b: 127.5, a: 1 })
    })

    it('should clamp t to 0-1 range', () => {
      const below = interpolateColor(red, blue, -0.5)
      expect(below).toEqual(red)

      const above = interpolateColor(red, blue, 1.5)
      expect(above).toEqual(blue)
    })

    it('should interpolate alpha channel', () => {
      const transparentRed: RGBA = { r: 255, g: 0, b: 0, a: 0 }
      const opaqueBlue: RGBA = { r: 0, g: 0, b: 255, a: 1 }

      const result = interpolateColor(transparentRed, opaqueBlue, 0.5)
      expect(result).toEqual({ r: 127.5, g: 0, b: 127.5, a: 0.5 })
    })
  })

  describe('interpolateColors', () => {
    const red: RGBA = { r: 255, g: 0, b: 0, a: 1 }
    const green: RGBA = { r: 0, g: 255, b: 0, a: 1 }
    const blue: RGBA = { r: 0, g: 0, b: 255, a: 1 }

    it('should handle empty array', () => {
      const result = interpolateColors([], 0.5)
      expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    })

    it('should handle single color', () => {
      const result = interpolateColors([red], 0.5)
      expect(result).toEqual(red)
    })

    it('should interpolate between two colors', () => {
      const result = interpolateColors([red, blue], 0.5)
      expect(result).toEqual({ r: 127.5, g: 0, b: 127.5, a: 1 })
    })

    it('should interpolate between three colors', () => {
      const colors = [red, green, blue]

      // First segment (red to green)
      const firstSegment = interpolateColors(colors, 0.25)
      expect(firstSegment.r).toBeGreaterThan(100)
      expect(firstSegment.g).toBeGreaterThan(0)
      expect(firstSegment.b).toBe(0)

      // Second segment (green to blue)
      const secondSegment = interpolateColors(colors, 0.75)
      expect(secondSegment.r).toBe(0)
      expect(secondSegment.g).toBeGreaterThan(0)
      expect(secondSegment.b).toBeGreaterThan(100)
    })

    it('should handle t=0 and t=1', () => {
      const colors = [red, green, blue]
      expect(interpolateColors(colors, 0)).toEqual(red)
      expect(interpolateColors(colors, 1)).toEqual(blue)
    })
  })

  describe('generateColorStops', () => {
    it('should handle empty array', () => {
      const stops = generateColorStops([])
      expect(stops).toEqual([])
    })

    it('should handle single color', () => {
      const stops = generateColorStops(['#ff0000'])
      expect(stops).toEqual([{ position: 0, color: '#ff0000' }])
    })

    it('should generate stops for two colors', () => {
      const stops = generateColorStops(['#ff0000', '#0000ff'])
      expect(stops).toEqual([
        { position: 0, color: '#ff0000' },
        { position: 1, color: '#0000ff' },
      ])
    })

    it('should generate stops for three colors', () => {
      const stops = generateColorStops(['#ff0000', '#00ff00', '#0000ff'])
      expect(stops).toEqual([
        { position: 0, color: '#ff0000' },
        { position: 0.5, color: '#00ff00' },
        { position: 1, color: '#0000ff' },
      ])
    })

    it('should evenly distribute stops', () => {
      const stops = generateColorStops(['#f00', '#0f0', '#00f', '#ff0'])
      expect(stops.length).toBe(4)
      expect(stops[0].position).toBeCloseTo(0)
      expect(stops[1].position).toBeCloseTo(0.333, 2)
      expect(stops[2].position).toBeCloseTo(0.667, 2)
      expect(stops[3].position).toBeCloseTo(1)
    })
  })

  // Skip canvas gradient tests in jsdom (doesn't support 2d context)
  describe.skip('createCanvasGradient', () => {
    let canvas: HTMLCanvasElement
    let ctx: CanvasRenderingContext2D

    beforeEach(() => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
    })

    it('should create a gradient with color stops', () => {
      const stops = [
        { position: 0, color: '#ff0000' },
        { position: 1, color: '#0000ff' },
      ]

      const gradient = createCanvasGradient(ctx, stops, 0, 100)
      expect(gradient).toBeInstanceOf(CanvasGradient)
    })

    it('should handle multiple stops', () => {
      const stops = [
        { position: 0, color: '#ff0000' },
        { position: 0.5, color: '#00ff00' },
        { position: 1, color: '#0000ff' },
      ]

      const gradient = createCanvasGradient(ctx, stops, 0, 100)
      expect(gradient).toBeInstanceOf(CanvasGradient)
    })

    it('should create vertical gradient by default', () => {
      const stops = [
        { position: 0, color: '#ff0000' },
        { position: 1, color: '#0000ff' },
      ]

      const gradient = createCanvasGradient(ctx, stops)
      expect(gradient).toBeInstanceOf(CanvasGradient)
    })

    it('should create horizontal gradient with width', () => {
      const stops = [
        { position: 0, color: '#ff0000' },
        { position: 1, color: '#0000ff' },
      ]

      const gradient = createCanvasGradient(ctx, stops, 100, 0)
      expect(gradient).toBeInstanceOf(CanvasGradient)
    })
  })
})
