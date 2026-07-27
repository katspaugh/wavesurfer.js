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

  test('parentFromOptionsContainer accepts an element from another realm (e.g. an iframe)', () => {
    const foreign = { nodeType: 1, style: {} } as unknown as HTMLElement
    expect((renderer as any).parentFromOptionsContainer(foreign)).toBe(foreign)
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

  test('renderBarWaveform and renderLineWaveform draw on context', () => {
    const ctx = (renderer as any).canvasWrapper.ownerDocument.createElement('canvas').getContext('2d') as any
    const data = [new Float32Array([0, 0.5, -0.5]), new Float32Array([0, -0.5, 0.5])]
    ;(renderer as any).renderBarWaveform(data, {}, ctx, 1)
    expect(ctx.beginPath).toHaveBeenCalled()
    ;(renderer as any).renderLineWaveform(data, {}, ctx, 1)
    expect(ctx.lineTo).toHaveBeenCalled()
  })

  test('renderWaveform chooses rendering path', () => {
    const ctx = document.createElement('canvas').getContext('2d') as any
    const data = [new Float32Array([0, 1])]
    const spyBar = jest.spyOn(renderer as any, 'renderBarWaveform')
    const spyLine = jest.spyOn(renderer as any, 'renderLineWaveform')
    ;(renderer as any).renderWaveform(data, { barWidth: 1 }, ctx)
    expect(spyBar).toHaveBeenCalled()
    ;(renderer as any).renderWaveform(data, {}, ctx)
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
    const spy = jest.fn()
    renderer.on('render', spy)
    await renderer.render(buffer)
    expect(spy).toHaveBeenCalled()
  })

  it('exposes visibleRange derived from scroll position and duration', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]], 60)
    await renderer.render(buffer)
    const range = renderer.getVisibleRange()
    expect(range.value.startTime).toBe(0)
    expect(range.value.endTime).toBeGreaterThan(0)
  })

  it('reports full duration as visibleRange when not scrollable', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]], 10)
    renderer.zoom(0) // fillParent, not scrollable
    await renderer.render(buffer)
    expect((renderer as any).isScrollable).toBe(false)
    expect(renderer.getVisibleRange().value).toEqual({ startTime: 0, endTime: 10 })
  })

  it('recomputes visibleRange when the underlying scroll position changes', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]], 100)
    renderer.zoom(1000) // force isScrollable
    await renderer.render(buffer)
    // jsdom performs no layout, so scrollWidth/clientWidth are both 0 by
    // default -- calculateScrollPercentages special-cases scrollWidth===0 to
    // {startX: 0, endX: 1}, which is exactly what render() sees. Stub in
    // sizes to exercise a real scroll delta.
    const scrollContainer = (renderer as any).scrollContainer as HTMLElement
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 1000 })
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 100 })

    expect((renderer as any).isScrollable).toBe(true)

    scrollContainer.scrollLeft = 500
    scrollContainer.dispatchEvent(new Event('scroll'))

    const range = renderer.getVisibleRange().value
    expect(range.startTime).toBeCloseTo(50)
    expect(range.endTime).toBeCloseTo(60)
  })

  test('reRender keeps scroll position', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]])
    renderer.zoom(20)
    await renderer.render(buffer)
    renderer.setScroll(10)
    renderer.reRender()
    expect(renderer.getScroll()).toBe(10)
  })

  test('reRender keeps non-scroll position', async () => {
    const buffer = createAudioBuffer([[0, 0.5, -0.5]])
    renderer.zoom(0)
    await renderer.render(buffer)
    renderer.setScroll(10)
    renderer.reRender()
    expect(renderer.getScroll()).toBe(0)
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

  test('renderProgress clamps only at low zoom when auto-centering', () => {
    ;(renderer as any).options.autoScroll = true
    ;(renderer as any).options.autoCenter = true
    ;(renderer as any).isScrollable = true

    const viewportWidth = 100
    const lowZoomDuration = 2
    const lowZoomScrollWidth = 200
    const highZoomDuration = 1
    const highZoomScrollWidth = 800

    Object.defineProperty((renderer as any).scrollContainer, 'clientWidth', {
      configurable: true,
      value: viewportWidth,
    })
    ;(renderer as any).audioData = { duration: lowZoomDuration }
    Object.defineProperty((renderer as any).scrollContainer, 'scrollWidth', {
      configurable: true,
      value: lowZoomScrollWidth,
    })
    renderer.setScroll(0)
    renderer.renderProgress(0.35, true)
    // 200 / 2 = 100 px/s, so low zoom keeps Math.min(20, 10) = 10
    expect(renderer.getScroll()).toBe(10)
    ;(renderer as any).audioData = { duration: highZoomDuration }
    Object.defineProperty((renderer as any).scrollContainer, 'scrollWidth', {
      configurable: true,
      value: highZoomScrollWidth,
    })
    renderer.setScroll(0)
    renderer.renderProgress(0.0875, true)
    // 800 / 1 = 800 px/s, so high zoom applies no clamp and scrolls by the full center offset
    expect(renderer.getScroll()).toBe(20)
  })

  test('renderProgress updates styles', () => {
    renderer.renderProgress(0.5)
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

  test('render() after destroy recreates scopes instead of installing pre-disposed ones', async () => {
    // Renderer is reused after WaveSurfer.destroy(): a subsequent load() call
    // reaches renderer.render(...), and setOptions() reaches reRender(). If
    // Renderer's own scope stays disposed forever, `this.scope.child()` hands
    // back an already-disposed child (per Scope's documented behavior), so
    // render() would install pre-disposed scrollRenderScope/delayScope and
    // any lazy-render scroll subscription registered afterward would be torn
    // down immediately -- long scrollable waveforms would only ever draw
    // their initial canvas range post destroy->load.
    const buffer = createAudioBuffer([[0, 0.5, -0.5]])

    renderer.destroy()
    await renderer.render(buffer)

    expect((renderer as any).scope.disposed).toBe(false)
    expect((renderer as any).scrollRenderScope.disposed).toBe(false)
    expect((renderer as any).delayScope.disposed).toBe(false)

    // And a fresh scroll subscription registered after the reuse must
    // actually stick instead of being disposed on arrival.
    const lateUnsubscribe = jest.fn()
    ;(renderer as any).scrollRenderScope.add(lateUnsubscribe)
    expect(lateUnsubscribe).not.toHaveBeenCalled()
  })

  it('keeps visibleRange live (not disposed) across destroy -> render reuse', async () => {
    // visibleRange is instance-lifetime state, deliberately never disposed via
    // this.scope (see the constructor comment): scrollStream/initEvents() only
    // run once, so registering visibleRange's dispose on this.scope would
    // permanently freeze it after the first destroy(), with nothing left to
    // recreate it. Reading it post-destroy must not throw, and a subsequent
    // render() reuse must still update it via the still-live audioDuration
    // signal, even though this.scrollStream is now null.
    renderer.zoom(1000)
    await renderer.render(createAudioBuffer([[0, 0.5, -0.5]], 100))

    renderer.destroy()

    expect(() => renderer.getVisibleRange().value).not.toThrow()

    await renderer.render(createAudioBuffer([[0, 0.5, -0.5]], 42))

    expect((renderer as any).scrollStream).toBeNull()
    expect(renderer.getVisibleRange().value).toEqual({ startTime: 0, endTime: 42 })
  })

  it('cancels a pending resize debounce on destroy even after a render', async () => {
    // The debounce delay() is created once in initEvents(), but render()
    // replaces delayScope; its cancellation must re-register per call or
    // destroy() cannot cancel a debounce scheduled after the first render.
    jest.useFakeTimers()
    let roCallback: (() => void) | undefined
    const OriginalRO = (global as any).ResizeObserver
    ;(global as any).ResizeObserver = class {
      constructor(cb: () => void) {
        roCallback = cb
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    const resizeSpy = jest.spyOn(Renderer.prototype as any, 'onContainerResize')
    const localContainer = document.createElement('div')
    document.body.appendChild(localContainer)
    const localRenderer = new Renderer({ container: localContainer })
    try {
      await localRenderer.render(createAudioBuffer([[0, 0.5, -0.5]]))
      roCallback?.() // schedules the 100ms resize debounce
      localRenderer.destroy()
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
      expect(resizeSpy).not.toHaveBeenCalled()
    } finally {
      resizeSpy.mockRestore()
      ;(global as any).ResizeObserver = OriginalRO
      jest.useRealTimers()
      localContainer.remove()
    }
  })
})
