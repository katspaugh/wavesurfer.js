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

describe('HoverPlugin', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('passes the current wavesurfer duration to formatTimeCallback', () => {
    const duration = signal(0)
    const container = document.createElement('div')
    const formatTimeCallback = jest.fn((seconds: number) => `${seconds}`)

    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    })

    document.body.appendChild(container)

    const plugin = HoverPlugin.create({ formatTimeCallback })
    plugin._init({
      ...createEmitter(),
      options: { progressColor: '#555' },
      getDuration: jest.fn(() => 12),
      getState: jest.fn(() => ({ duration })),
      getWrapper: jest.fn(() => container),
    } as any)

    container.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50 }))

    expect(formatTimeCallback).toHaveBeenCalledWith(6)
    expect(container.querySelector('[part="hover-label"]')?.textContent).toBe('6')
  })
})
