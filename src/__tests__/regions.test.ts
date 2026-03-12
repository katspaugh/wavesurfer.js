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
})
