import HoverPlugin from '../plugins/hover.js'
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

const createWaveSurfer = (container: HTMLElement, durationValue: number) => {
  const duration = signal(durationValue)

  Object.defineProperty(container, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, width: 100 }),
  })

  document.body.appendChild(container)

  return {
    duration,
    wavesurfer: {
      ...createEmitter(),
      options: { progressColor: '#555' },
      getDuration: jest.fn(() => duration.value),
      getState: jest.fn(() => ({ duration })),
      getWrapper: jest.fn(() => container),
    },
  }
}

describe('HoverPlugin', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('passes the current wavesurfer duration to formatTimeCallback', () => {
    const container = document.createElement('div')
    const formatTimeCallback = jest.fn((seconds: number) => `${seconds}`)
    const { wavesurfer } = createWaveSurfer(container, 0)

    const plugin = HoverPlugin.create({ formatTimeCallback })
    plugin._init(wavesurfer as any)

    wavesurfer.getDuration.mockReturnValue(12)

    container.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50 }))

    expect(formatTimeCallback).toHaveBeenCalledWith(6)
    expect(container.querySelector('[part="hover-label"]')?.textContent).toBe('6')
  })

  test('keeps the hover line hidden after pointerleave when duration updates', () => {
    const container = document.createElement('div')
    const formatTimeCallback = jest.fn((seconds: number) => `${seconds}`)
    const { duration, wavesurfer } = createWaveSurfer(container, 10)

    const plugin = HoverPlugin.create({ formatTimeCallback })
    plugin._init(wavesurfer as any)

    container.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50 }))

    const hover = container.querySelector<HTMLElement>('[part="hover"]')

    expect(hover?.style.opacity).toBe('1')
    expect(formatTimeCallback).toHaveBeenCalledTimes(1)

    container.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }))

    expect(hover?.style.opacity).toBe('0')
    // transform is cleared after the opacity transition ends, not immediately
    hover?.dispatchEvent(new Event('transitionend'))
    expect(hover?.style.transform).toBe('')

    duration.set(12)

    expect(hover?.style.opacity).toBe('0')
    expect(hover?.style.transform).toBe('')
    expect(formatTimeCallback).toHaveBeenCalledTimes(1)
  })
})
