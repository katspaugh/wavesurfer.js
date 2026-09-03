import HoverPlugin from '../plugins/hover.js'
import { signal } from '../reactive/store.js'
import { createEmitter } from './helpers/create-emitter.js'

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

  test('positions the hover line with a string lineWidth instead of producing NaN math', () => {
    const container = document.createElement('div')
    const { wavesurfer } = createWaveSurfer(container, 10)

    const plugin = HoverPlugin.create({ lineWidth: '2px' })
    plugin._init(wavesurfer as any)

    // width is 100 (see createWaveSurfer); posX = min(100 - 2 - 1, 99) = 97.
    // With the documented string form, `100 - '2px' - 1` is NaN and the line
    // was positioned at translateX(NaNpx).
    container.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 99 }))

    const hover = container.querySelector<HTMLElement>('[part="hover"]')
    expect(hover?.style.transform).toBe('translateX(97px)')
    // The CSS border still uses the string verbatim
    expect(hover?.style.borderLeft).toContain('2px')
  })

  test('does not accumulate transitionend listeners across pointerleave events', () => {
    const container = document.createElement('div')
    const { wavesurfer } = createWaveSurfer(container, 10)

    const plugin = HoverPlugin.create()
    plugin._init(wavesurfer as any)

    const hover = container.querySelector<HTMLElement>('[part="hover"]')!
    const addSpy = jest.spyOn(hover, 'addEventListener')
    const removeSpy = jest.spyOn(hover, 'removeEventListener')

    for (let i = 0; i < 5; i++) {
      container.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }))
    }

    const added = addSpy.mock.calls.filter(([type]) => type === 'transitionend').length
    const removed = removeSpy.mock.calls.filter(([type]) => type === 'transitionend').length
    expect(added - removed).toBeLessThanOrEqual(1)
  })
})
