import RegionsPlugin from '../plugins/regions.js'

type Listener = (...args: any[]) => void

const createEmitter = () => {
  const listeners = new Map<string, Set<Listener>>()

  return {
    on: jest.fn((event: string, listener: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }

      listeners.get(event)!.add(listener)
      return () => listeners.get(event)?.delete(listener)
    }),
  }
}

const createWaveSurfer = (duration = 10, width = 100, scroll = 0) => {
  const emitter = createEmitter()
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  return {
    ...emitter,
    getDecodedData: jest.fn(() => ({ numberOfChannels: 1 })),
    getDuration: jest.fn(() => duration),
    getScroll: jest.fn(() => scroll),
    getWidth: jest.fn(() => width),
    getWrapper: jest.fn(() => wrapper),
  }
}

const mockRect = (element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: jest.fn(() => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    })),
  })
}

describe('RegionsPlugin', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('re-renders a lazily detached region when setOptions moves it into view', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')
    expect(regionsContainer).toBeTruthy()
    Object.defineProperty(regionsContainer, 'clientWidth', { configurable: true, value: 1000 })

    const region = plugin.addRegion({ start: 8, end: 9 })

    jest.runOnlyPendingTimers()

    expect(region.element?.parentElement).toBeNull()

    region.setOptions({ start: 0.5, end: 1.5 })

    expect(region.element?.parentElement).toBe(regionsContainer)
    expect(region.element?.style.left).toBe('5%')
    expect(region.element?.style.right).toBe('85%')

    region.setOptions({ start: 8, end: 9 })

    expect(region.element?.parentElement).toBeNull()
  })

  test('cleans up drag selection on plugin destroy', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const wrapper = wavesurfer.getWrapper()
    const addSpy = jest.spyOn(wrapper, 'addEventListener')
    const removeSpy = jest.spyOn(wrapper, 'removeEventListener')

    plugin.enableDragSelection({})
    plugin.destroy()

    const addCount = addSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
    const removeCount = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
    expect(addCount).toBeGreaterThan(0)
    expect(addCount).toBe(removeCount)
  })

  test('attaches only one click listener to region content', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 0, end: 1, content: 'label', contentEditable: true })
    const clicked = jest.fn()
    plugin.on('region-clicked', clicked)

    region.content!.dispatchEvent(new MouseEvent('click'))

    expect(clicked).toHaveBeenCalledTimes(1)
  })

  // ADAPTED: the pre-port test read `region.subscriptions.length` directly.
  // SingleRegion's hand-rolled `subscriptions` array is gone -- its listener
  // bookkeeping (including resize-handle cleanup) now lives on a private
  // child Scope with no length/size introspection (by design, see
  // envelope-leaks.test.ts for the established precedent). Pin the same
  // "does not grow" contract one level down: each `resize: true` toggle
  // creates fresh left/right resize-handle elements and attaches one
  // 'pointerdown' listener to each (via createDragStream); the *net* count of
  // attached pointerdown listeners (adds minus removes) after settling on
  // `resize: true` must stay constant across repeated off/on cycles, rather
  // than growing if a stale cleanup were left behind each toggle.
  test('toggling resize option repeatedly does not grow region subscriptions', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 0, end: 1, resize: true })

    const addSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener')
    const removeSpy = jest.spyOn(HTMLElement.prototype, 'removeEventListener')
    const netPointerdownListeners = () => {
      const adds = addSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
      const removes = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
      return adds - removes
    }

    region.setOptions({ resize: false })
    region.setOptions({ resize: true })
    const netAfterFirstToggle = netPointerdownListeners()

    region.setOptions({ resize: false })
    region.setOptions({ resize: true })
    const netAfterSecondToggle = netPointerdownListeners()

    expect(netAfterSecondToggle).toBe(netAfterFirstToggle)
  })

  test('places a region in the first free row instead of summing all prior overlaps', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second' })
    const thirdRegion = plugin.addRegion({ start: 2, end: 3, content: 'Third' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 50, top: 0, width: 40, height: 10 })
    mockRect(thirdRegion.content!, { left: 30, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()

    expect(firstRegion.content?.style.marginTop).toBe('0px')
    expect(secondRegion.content?.style.marginTop).toBe('0px')
    expect(thirdRegion.content?.style.marginTop).toBe('12px')
  })

  test('reflows shifted labels when another region moves away', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 20, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('12px')

    mockRect(firstRegion.content!, { left: 80, top: 0, width: 40, height: 10 })
    firstRegion.onContentBlur()

    jest.runOnlyPendingTimers()
    expect(firstRegion.content?.style.marginTop).toBe('0px')
    expect(secondRegion.content?.style.marginTop).toBe('0px')
  })
})
