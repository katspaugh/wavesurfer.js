import { drawFrequencyLabels, type FrequencyLabelsOptions } from '../spectrogram-render-utils.js'

type TextCall = {
  op: 'fillText'
  fillStyle: string
  font: string
  textAlign: string
  textBaseline: string
  text: string
  x: number
  y: number
}
type RectCall = { op: 'fillRect'; fillStyle: string; args: number[] }
type Call = { op: 'scale'; x: number; y: number } | RectCall | TextCall

// A minimal 2D context that records the state each draw call was made with
function createRecordingCanvas() {
  const calls: Call[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    scale(x: number, y: number) {
      calls.push({ op: 'scale', x, y })
    },
    fillRect(...args: number[]) {
      calls.push({ op: 'fillRect', fillStyle: ctx.fillStyle, args })
    },
    fillText(text: string, x: number, y: number) {
      const { fillStyle, font, textAlign, textBaseline } = ctx
      calls.push({ op: 'fillText', fillStyle, font, textAlign, textBaseline, text, x, y })
    },
  }
  const canvas = document.createElement('canvas')
  canvas.getContext = jest.fn(() => ctx) as unknown as HTMLCanvasElement['getContext']
  return { canvas, calls }
}

const baseOptions: FrequencyLabelsOptions = {
  bgFill: undefined,
  fontSizeFreq: '12px',
  fontSizeUnit: '12px',
  fontType: '',
  textColorFreq: undefined,
  textColorUnit: undefined,
  textAlign: 'center',
  channels: 1,
  height: 256,
  frequencyMin: 0,
  frequencyMax: 10000,
  scale: 'linear',
}

const texts = (calls: Call[]) => calls.filter((call): call is TextCall => call.op === 'fillText')
const rects = (calls: Call[]) => calls.filter((call): call is RectCall => call.op === 'fillRect')

describe('drawFrequencyLabels', () => {
  const originalRatio = window.devicePixelRatio

  afterEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalRatio, configurable: true })
  })

  it('sizes the backing store by height, channels and devicePixelRatio, and scales the context', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, { ...baseOptions, channels: 2, height: 100 })
    expect(canvas.height).toBe(400)
    expect(canvas.width).toBe(110)
    expect(calls[0]).toEqual({ op: 'scale', x: 2, y: 2 })
  })

  it('draws one row-height background rect per channel', () => {
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, { ...baseOptions, channels: 3, height: 100, bgFill: 'red' })
    expect(rects(calls)).toEqual([
      { op: 'fillRect', fillStyle: 'red', args: [0, 0, 55, 100] },
      { op: 'fillRect', fillStyle: 'red', args: [0, 100, 55, 100] },
      { op: 'fillRect', fillStyle: 'red', args: [0, 200, 55, 100] },
    ])
  })

  it('places evenly spaced labels bottom to top, clamped 10px inside the row', () => {
    const { canvas, calls } = createRecordingCanvas()
    // height 256 gives 5 intervals: 0, 2, 4, 6, 8, 10 kHz on a linear scale
    drawFrequencyLabels(canvas, baseOptions)
    const freqLabels = texts(calls).filter((call) => call.x === 16)
    const unitLabels = texts(calls).filter((call) => call.x === 40)
    expect(freqLabels.map((call) => call.text)).toEqual(['0', '2.0', '4.0', '6.0', '8.0', '10.0'])
    const expectedYs = [246, 204.8, 153.6, 102.4, 51.2, 10]
    freqLabels.forEach((call, i) => expect(call.y).toBeCloseTo(expectedYs[i], 9))
    // Each unit label sits on the same row as its value
    expect(unitLabels.map((call) => call.y)).toEqual(freqLabels.map((call) => call.y))
    expect(unitLabels.map((call) => call.text)).toEqual(['Hz', 'kHz', 'kHz', 'kHz', 'kHz', 'kHz'])
  })

  it('offsets every channel row by its height', () => {
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, { ...baseOptions, channels: 2 })
    const ys = texts(calls)
      .filter((call) => call.x === 16)
      .map((call) => call.y)
    expect(ys).toHaveLength(12)
    expect(ys.slice(6)).toEqual([502, 460.8, 409.6, 358.4, 307.2, 266])
  })

  it('stops at the last whole label step for a height that is not a multiple of 256', () => {
    const { canvas, calls } = createRecordingCanvas()
    // labelIndex = 5 * 200 / 256 = 3.90625 -> labels for i = 0..3, none at the very top
    drawFrequencyLabels(canvas, { ...baseOptions, height: 200 })
    expect(texts(calls)).toHaveLength(8)
  })

  it('applies the documented defaults for empty styling values', () => {
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, {
      ...baseOptions,
      bgFill: '',
      fontSizeFreq: '',
      fontSizeUnit: '',
      fontType: '',
      textColorFreq: '',
      textColorUnit: '',
      textAlign: '' as CanvasTextAlign,
    })
    expect(rects(calls)[0]).toMatchObject({ fillStyle: 'rgba(68,68,68,0)' })
    for (const call of texts(calls)) {
      expect(call).toMatchObject({
        fillStyle: '#fff',
        font: '12px Helvetica',
        textAlign: 'center',
        textBaseline: 'middle',
      })
    }
  })

  it('uses separate colors and fonts for frequency values and units', () => {
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, {
      ...baseOptions,
      fontSizeFreq: '14px',
      fontSizeUnit: '10px',
      fontType: 'serif',
      textColorFreq: 'blue',
      textColorUnit: 'green',
      textAlign: 'left',
    })
    const [unit, freq] = texts(calls)
    expect(unit).toMatchObject({ text: 'Hz', fillStyle: 'green', font: '10px serif', textAlign: 'left' })
    expect(freq).toMatchObject({ text: '0', fillStyle: 'blue', font: '14px serif', textAlign: 'left' })
  })

  it('follows the frequency scale between frequencyMin and frequencyMax', () => {
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, { ...baseOptions, frequencyMin: 1000, frequencyMax: 8000, scale: 'mel' })
    const values = texts(calls)
      .filter((call) => call.x === 16)
      .map((call) => call.text)
    expect(values[0]).toBe('1.0')
    expect(values[values.length - 1]).toBe('8.0')
    // mel spacing is wider at the top: the 60% label sits well below the linear 5.2 kHz
    expect(Number(values[3])).toBeLessThan(4.5)
  })

  it('falls back to a 512px row for label spacing when height is 0', () => {
    const { canvas, calls } = createRecordingCanvas()
    drawFrequencyLabels(canvas, { ...baseOptions, height: 0 })
    // The backing store follows the height option, the spacing the 512px fallback
    expect(canvas.height).toBe(0)
    expect(rects(calls)[0]).toMatchObject({ args: [0, 0, 55, 512] })
    expect(texts(calls)).toHaveLength(22)
  })

  it('does nothing when the canvas has no 2D context', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 7
    canvas.height = 9
    canvas.getContext = jest.fn(() => null) as unknown as HTMLCanvasElement['getContext']
    drawFrequencyLabels(canvas, baseOptions)
    expect(canvas.width).toBe(7)
    expect(canvas.height).toBe(9)
  })
})
