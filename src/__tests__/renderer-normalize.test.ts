/**
 * Regression tests: `normalize: true` must scale against the global peak of
 * the whole waveform (all channels), computed once per render -- never
 * per canvas slice, which produced amplitude discontinuities at canvas seams.
 */

jest.mock('../renderer-utils.js', () => {
  const actual = jest.requireActual('../renderer-utils.js')
  return { ...actual, calculateVerticalScale: jest.fn(actual.calculateVerticalScale) }
})

import Renderer from '../renderer.js'
import * as utils from '../renderer-utils.js'

// jsdom performs no layout, so scrollContainer.clientWidth is 0 and the
// canvas plan would be empty -- stub in a real width so rendering happens.
const stubLayout = (renderer: Renderer) => {
  const scrollContainer = (renderer as unknown as { scrollContainer: HTMLElement }).scrollContainer
  Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 400 })
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

describe('Renderer normalization', () => {
  let container: HTMLDivElement
  const originalGetContext = window.HTMLCanvasElement.prototype.getContext

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
    })) as never
  })

  afterAll(() => {
    window.HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    ;(utils.calculateVerticalScale as jest.Mock).mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('threads the global all-channel peak into every vertical-scale computation', async () => {
    // Channel 0 peaks at 0.4, channel 1 at 0.8: the global peak must be 0.8
    // (previously the per-slice, channel-0-only max of whatever data a canvas
    // happened to receive).
    const buffer = createAudioBuffer([
      [0.1, -0.4, 0.2],
      [0.3, 0.8, -0.5],
    ])
    const renderer = new Renderer({ container, normalize: true, fillParent: true })
    stubLayout(renderer)
    await renderer.render(buffer)

    const calls = (utils.calculateVerticalScale as jest.Mock).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [args] of calls) {
      expect(args.normalize).toBe(true)
      expect(args.maxPeak).toBeCloseTo(0.8) // Float32 representation of 0.8
    }
    renderer.destroy()
  })

  it('leaves a user-provided maxPeak untouched', async () => {
    const buffer = createAudioBuffer([[0.1, -0.4, 0.2]])
    const renderer = new Renderer({ container, normalize: true, maxPeak: 1, fillParent: true })
    stubLayout(renderer)
    await renderer.render(buffer)

    const calls = (utils.calculateVerticalScale as jest.Mock).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [args] of calls) {
      expect(args.maxPeak).toBe(1)
    }
    renderer.destroy()
  })
})
