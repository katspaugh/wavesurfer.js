import TimelinePlugin from '../plugins/timeline.js'
import { signal } from '../reactive/store.js'

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

const createWaveSurfer = (duration = 1, scrollWidth = 100) => {
  const emitter = createEmitter()
  const durationSignal = signal(duration)
  const wrapper = document.createElement('div')

  Object.defineProperty(wrapper, 'scrollWidth', { configurable: true, value: scrollWidth })
  document.body.appendChild(wrapper)

  return {
    ...emitter,
    getDuration: jest.fn(() => duration),
    getScroll: jest.fn(() => 0),
    getState: jest.fn(() => ({ duration: durationSignal })),
    getWidth: jest.fn(() => scrollWidth * 2),
    getWrapper: jest.fn(() => wrapper),
  }
}

describe('TimelinePlugin', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('preserves high precision offsets for notch positions', () => {
    const wavesurfer = createWaveSurfer(1, 100)
    const plugin = TimelinePlugin.create({
      duration: 1,
      timeInterval: 0.333,
      timeOffset: 0.001,
      primaryLabelInterval: 10,
      secondaryLabelInterval: 10,
    })

    plugin._init(wavesurfer as any)

    const notches = wavesurfer.getWrapper().querySelectorAll<HTMLElement>('[part^="timeline-notch"]')
    expect(notches).toHaveLength(4)
    expect(parseFloat(notches[1].style.left)).toBeCloseTo((0.333 + 0.001) * 100)
  })
})
