import Renderer from '../renderer.js'

declare global {
  interface Window {
    HTMLCanvasElement: typeof HTMLCanvasElement
  }
}

const createAudioBuffer = (channels: number[][], duration = 1): AudioBuffer => {
  return {
    duration,
    length: channels[0].length,
    sampleRate: channels[0].length / duration,
    numberOfChannels: channels.length,
    getChannelData: (i: number) => Float32Array.from(channels[i]),
    copyFromChannel: jest.fn(),
    copyToChannel: jest.fn(),
  } as unknown as AudioBuffer
}

describe('Renderer', () => {
  let container: HTMLDivElement
  let renderer: Renderer
  const originalGetContext = window.HTMLCanvasElement.prototype.getContext
  const originalToDataURL = window.HTMLCanvasElement.prototype.toDataURL
  const originalToBlob = window.HTMLCanvasElement.prototype.toBlob

  beforeAll(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      beginPath: jest.fn(),
      rect: jest.fn(),
      roundRect: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      globalCompositeOperation: '',
      canvas: { width: 100, height: 100 },
    })) as any

    window.HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:mock')
    window.HTMLCanvasElement.prototype.toBlob = jest.fn((cb) => cb(new Blob([''])))
  })

  afterAll(() => {
    window.HTMLCanvasElement.prototype.getContext = originalGetContext
    window.HTMLCanvasElement.prototype.toDataURL = originalToDataURL
    window.HTMLCanvasElement.prototype.toBlob = originalToBlob
  })

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'root'
    document.body.appendChild(container)
    renderer = new Renderer({ container })
  })

  afterEach(() => {
    renderer.destroy()
    container.remove()
    jest.clearAllMocks()
  })

  test('parentFromOptionsContainer returns element and throws', () => {
    expect((renderer as any).parentFromOptionsContainer(container)).toBe(container)
    expect((renderer as any).parentFromOptionsContainer('#root')).toBe(container)
    expect(() => (renderer as any).parentFromOptionsContainer('#missing')).toThrow()
  })

  test('initHtml creates shadow root', () => {
    const [el, shadow] = (renderer as any).initHtml()
    expect(el.shadowRoot).toBe(shadow)
    expect(shadow.querySelector('.scroll')).not.toBeNull()
  })

  test('getHeight calculates values', () => {
    ;(renderer as any).audioData = { numberOfChannels: 2 }
    expect((renderer as any).getHeight(undefined, undefined)).toBe(128)
    expect((renderer as any).getHeight(50, undefined)).toBe(50)
    container.style.height = '200px'
    expect((renderer as any).getHeight('auto', [{ overlay: false }])).toBe(64)
  })

  test('createDelay resolves after time', async () => {
    jest.useFakeTimers()
    const delay = (renderer as any).createDelay(10)
    const spy = jest.fn()
    const p = delay().then(spy)
    jest.advanceTimersByTime(10)
    await p
    expect(spy).toHaveBeenCalled()
    jest.useRealTimers()
  })

  test('convertColorValues supports gradients', () => {
    const result = (renderer as any).convertColorValues(['red', 'blue'])
    expect(typeof result).toBe('object')
    expect((renderer as any).convertColorValues('red')).toBe('red')
  })

  test('getPixelRatio returns positive', () => {
    window.devicePixelRatio = 2
    expect((renderer as any).getPixelRatio()).toBe(2)
  })

  test('CanvasRenderer renderWaveform draws on context', () => {
    // Access the internal canvasRenderer
    const canvasRenderer = (renderer as any).canvasRenderer
    const canvas = (renderer as any).canvasWrapper.ownerDocument.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d') as any
    const data = [new Float32Array([0, 0.5, -0.5]), new Float32Array([0, -0.5, 0.5])]

    // Test bar rendering
    canvasRenderer.renderWaveform(data, { barWidth: 1, waveColor: '#000' }, ctx)
    expect(ctx.beginPath).toHaveBeenCalled()

    // Test line rendering
    ctx.beginPath.mockClear()
    canvasRenderer.renderWaveform(data, { waveColor: '#000' }, ctx)
    expect(ctx.lineTo).toHaveBeenCalled()
  })

  test('CanvasRenderer chooses rendering path based on options', () => {
    const canvasRenderer = (renderer as any).canvasRenderer
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    const ctx = canvas.getContext('2d') as any
    const data = [new Float32Array([0, 1])]

    const spyBar = jest.spyOn(canvasRenderer as any, 'renderBarWaveform')
    const spyLine = jest.spyOn(canvasRenderer as any, 'renderLineWaveform')

    // Should use bar rendering when barWidth is set
    canvasRenderer.renderWaveform(data, { barWidth: 1, waveColor: '#000' }, ctx)
    expect(spyBar).toHaveBeenCalled()

    spyBar.mockClear()
    spyLine.mockClear()

    // Should use line rendering when no barWidth
    canvasRenderer.renderWaveform(data, { waveColor: '#000' }, ctx)
    expect(spyLine).toHaveBeenCalled()
  })

  test('renderSingleCanvas appends canvases', () => {
    const canvasContainer = document.createElement('div')
    const progressContainer = document.createElement('div')
    const data = [new Float32Array([0, 1])]
    ;(renderer as any).renderSingleCanvas(data, {}, 10, 10, 0, canvasContainer, progressContainer)
    expect(canvasContainer.querySelector('canvas')).not.toBeNull()
    expect(progressContainer.querySelector('canvas')).not.toBeNull()
  })

  test('renderMultiCanvas draws and subscribes', () => {
    const canvasContainer = document.createElement('div')
    const progressContainer = document.createElement('div')
    const data = [new Float32Array([0, 1])] as any
    Object.defineProperty((renderer as any).scrollContainer, 'clientWidth', { configurable: true, value: 200 })
    ;(renderer as any).renderMultiCanvas(data, { barWidth: 1 }, 200, 10, canvasContainer, progressContainer)
    expect(canvasContainer.querySelector('canvas')).not.toBeNull()
  })

  test('renderChannel creates containers', () => {
    const data = [new Float32Array([0, 1])]
    ;(renderer as any).renderChannel(data, {}, 10, 0)
    expect((renderer as any).canvasWrapper.children.length).toBeGreaterThan(0)
  })

  test('render processes audio buffer', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]])
    const initialValue = renderer.render$.value
    await renderer.render(buffer)
    // render$ signal should be updated
    expect(renderer.render$.value).not.toBe(initialValue)
  })

  test('reRender keeps scroll position', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]])
    await renderer.render(buffer)
    renderer.setScroll(10)
    renderer.reRender()
    expect(renderer.getScroll()).toBe(10)
  })

  test('zoom updates option', () => {
    renderer.zoom(20)
    expect((renderer as any).options.minPxPerSec).toBe(20)
  })

  test('scrollIntoView updates scroll', () => {
    Object.defineProperty((renderer as any).scrollContainer, 'scrollWidth', { configurable: true, value: 100 })
    Object.defineProperty((renderer as any).scrollContainer, 'clientWidth', { configurable: true, value: 50 })
    renderer.renderProgress(0)
    ;(renderer as any).scrollIntoView(0.8)
    expect(renderer.getScroll()).toBeGreaterThanOrEqual(0)
  })

  test('renderProgress updates styles', () => {
    renderer.renderProgress(0.5)
    ;(renderer as any).flushProgressRender()
    expect((renderer as any).progressWrapper.style.width).toBe('50%')
  })

  test('exportImage returns data', async () => {
    const canvas = document.createElement('canvas')
    ;(renderer as any).canvasWrapper.appendChild(canvas)
    const urls = await renderer.exportImage('image/png', 1, 'dataURL')
    expect(urls).toHaveLength(1)
    const blobs = await renderer.exportImage('image/png', 1, 'blob')
    expect(blobs).toHaveLength(1)
  })

  test('destroy cleans up', () => {
    renderer.destroy()
    expect(container.contains(renderer.getWrapper())).toBe(false)
  })
})
