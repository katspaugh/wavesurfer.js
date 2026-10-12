/**
 * The waveform hands each canvas the part of the audio under it. The parts are views of the audio, not
 * copies of it (copying drew the whole recording into new memory on every render), except for a custom
 * renderFunction, which may write to what it is given. These check that mono, stereo and files of many
 * channels draw exactly what they drew from copies.
 */

jest.mock('../renderer-utils.js', () => {
  const actual = jest.requireActual('../renderer-utils.js')
  return { ...actual, sliceChannelData: jest.fn(actual.sliceChannelData) }
})

import Renderer from '../renderer.js'
import * as utils from '../renderer-utils.js'
import type { ChannelData } from '../renderer-utils.js'
import type { WaveSurferOptions } from '../wavesurfer.js'

const actualSlice = jest.requireActual('../renderer-utils.js').sliceChannelData as typeof utils.sliceChannelData
const sliceSpy = utils.sliceChannelData as jest.Mock

// A channel of its own amplitude and pitch, so that mixing two channels up shows
const audio = (channelCount: number, length: number): Float32Array[] =>
  Array.from({ length: channelCount }, (_, c) =>
    Float32Array.from({ length }, (_, i) => Math.sin(i / (7 + c)) * (0.2 + 0.1 * c) * (1 - (i % 97) / 200)),
  )

// Like a real AudioBuffer, it hands out the same array for a channel each time
const createAudioBuffer = (channels: Float32Array[], duration = 1): AudioBuffer =>
  ({
    duration,
    length: channels[0].length,
    sampleRate: channels[0].length / duration,
    numberOfChannels: channels.length,
    getChannelData: (i: number) => channels[i],
    copyFromChannel: jest.fn(),
    copyToChannel: jest.fn(),
  }) as unknown as AudioBuffer

describe('sliceChannelData', () => {
  const slicesOf = (channels: ChannelData, readOnly: boolean, offset: number, clampedWidth: number) =>
    actualSlice({ channelData: channels, offset, clampedWidth, totalWidth: 1000, readOnly })

  test.each([1, 2, 4, 8])('views of %i channels hold the samples copies hold, at any offset', (count) => {
    for (const length of [7, 100, 4097]) {
      const channels = audio(count, length)
      for (const [offset, width] of [
        [0, 1000],
        [0, 100],
        [100, 100],
        [333, 250],
        [900, 100],
        [999, 1],
        [500, 0],
      ]) {
        const views = slicesOf(channels, true, offset, width)
        const copies = slicesOf(channels, false, offset, width)
        expect(views).toHaveLength(count)
        views.forEach((view, c) => {
          expect(Array.from(view)).toEqual(Array.from(copies[c]))
          // a view is a window on the channel's own memory, at the right place
          const start = Math.floor((offset / 1000) * length)
          expect((view as Float32Array).buffer).toBe(channels[c].buffer)
          expect((view as Float32Array).byteOffset).toBe(channels[c].byteOffset + start * 4)
        })
      }
    }
  })

  test('copies by default, and a copy can be written without changing the audio', () => {
    const channels = audio(2, 100)
    const before = channels.map((channel) => Array.from(channel))
    const copies = actualSlice({ channelData: channels, offset: 0, clampedWidth: 1000, totalWidth: 1000 })

    copies.forEach((copy, c) => {
      expect((copy as Float32Array).buffer).not.toBe(channels[c].buffer)
      ;(copy as Float32Array).fill(9)
    })
    channels.forEach((channel, c) => expect(Array.from(channel)).toEqual(before[c]))
  })

  test('writing to a view writes to the audio, which is why only a reader may be given one', () => {
    const channels = audio(1, 100)
    const [view] = slicesOf(channels, true, 0, 500) as Float32Array[]
    view[0] = 9
    expect(channels[0][0]).toBe(9)
  })

  test('copies plain arrays even for a reader, as they have no views', () => {
    const plain = [0.1, 0.2, 0.3, 0.4]
    const typed = Float32Array.from(plain)
    const [fromPlain, fromTyped] = slicesOf([plain, typed], true, 500, 500)
    expect(fromPlain).toEqual([0.3, 0.4])
    expect(Array.isArray(fromPlain)).toBe(true)
    expect((fromTyped as Float32Array).buffer).toBe(typed.buffer)
  })

  test('slices every channel by its own length', () => {
    const channels = [audio(1, 100)[0], audio(1, 40)[0], audio(1, 7)[0]]
    const views = slicesOf(channels, true, 500, 250)
    // from half to three quarters of each: 50 to 75, 20 to 30, and floor(3.5) to floor(5.25) = 3 to 5
    expect(views.map((view) => view.length)).toEqual([25, 10, 2])
  })
})

describe('Renderer slices', () => {
  const originalGetContext = window.HTMLCanvasElement.prototype.getContext

  // Every call made on every canvas, in order, with the size each canvas was drawn at
  type Call = [canvas: number, what: string, ...args: unknown[]]
  let log: Call[] = []
  let canvasCount = 0

  beforeAll(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })
    window.HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      const id = canvasCount++
      log.push([id, 'canvas', this.width, this.height])
      const record =
        (what: string) =>
        (...args: unknown[]) => {
          log.push([id, what, ...args])
        }
      return {
        beginPath: record('beginPath'),
        rect: record('rect'),
        roundRect: record('roundRect'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        closePath: record('closePath'),
        fill: record('fill'),
        fillRect: record('fillRect'),
        drawImage: () => log.push([id, 'drawImage']),
        createLinearGradient: () => ({ addColorStop: jest.fn() }),
        globalCompositeOperation: '',
        canvas: this,
      }
    } as never
  })

  afterAll(() => {
    window.HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // jsdom performs no layout, so the scroll area is given a width for the canvases to be planned against
  const draw = async (channels: Float32Array[], options: Partial<WaveSurferOptions>, asCopies: boolean) => {
    log = []
    canvasCount = 0
    sliceSpy.mockClear()
    sliceSpy.mockImplementation(asCopies ? (args) => actualSlice({ ...args, readOnly: false }) : actualSlice)

    const container = document.createElement('div')
    document.body.appendChild(container)
    const renderer = new Renderer({ container, fillParent: true, height: 40, ...options })
    const scrollContainer = (renderer as unknown as { scrollContainer: HTMLElement }).scrollContainer
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 400 })
    await renderer.render(createAudioBuffer(channels))

    const result = { log, calls: [...sliceSpy.mock.calls], results: [...sliceSpy.mock.results] }
    renderer.destroy()
    return result
  }

  const layouts: Array<[string, number, Partial<WaveSurferOptions>]> = [
    ['mono', 1, {}],
    ['stereo, as a line', 2, {}],
    ['stereo, as bars', 2, { barWidth: 2, barGap: 1 }],
    ['stereo, zoomed in so that canvases are drawn as they scroll into view', 2, { minPxPerSec: 3000 }],
    ['stereo, zoomed in, as bars', 2, { minPxPerSec: 3000, barWidth: 3 }],
    ['stereo, normalized', 2, { normalize: true }],
    ['stereo, each channel on its own canvas', 2, { splitChannels: [] }],
    ['four channels, of which the first two are drawn', 4, {}],
    ['four channels, each on its own canvas', 4, { splitChannels: [] }],
    ['four channels, each on its own canvas, normalized', 4, { splitChannels: [], normalize: true }],
    ['eight channels, each on its own canvas, as bars', 8, { splitChannels: [], barWidth: 3 }],
    ['six channels, some overlaid', 6, { splitChannels: [{}, { overlay: true }, {}, { overlay: true }, {}, {}] }],
    ['six channels, zoomed in', 6, { splitChannels: [], minPxPerSec: 3000 }],
  ]

  describe.each(layouts)('%s', (_name, channelCount, options) => {
    test('draws exactly what it drew from copies', async () => {
      const channels = audio(channelCount, 20000)
      const fromViews = await draw(channels, options, false)
      const fromCopies = await draw(channels, options, true)

      expect(fromViews.log.length).toBeGreaterThan(0)
      expect(fromViews.log).toEqual(fromCopies.log)
    })

    test('hands each canvas views of its own channels, and no others', async () => {
      const channels = audio(channelCount, 20000)
      const { calls, results } = await draw(channels, options, false)
      expect(calls.length).toBeGreaterThan(0)

      const channelsDrawn = new Set<Float32Array>()
      calls.forEach(([args], n) => {
        const given = args.channelData as Float32Array[]
        const slices = results[n].value as Float32Array[]
        expect(args.readOnly).toBe(true)
        expect(slices).toHaveLength(given.length)
        given.forEach((channel, k) => {
          expect(channels).toContain(channel)
          channelsDrawn.add(channel)
          expect(slices[k].buffer).toBe(channel.buffer)
        })
      })

      // Without split channels the first two are drawn together; with them, every channel on its own
      const expectedChannels = options.splitChannels ? channelCount : Math.min(2, channelCount)
      expect(channelsDrawn.size).toBe(expectedChannels)
    })
  })

  describe('a custom renderFunction', () => {
    test('is given copies, so writing to them cannot change the audio', async () => {
      const channels = audio(2, 20000)
      const before = channels.map((channel) => Array.from(channel))
      const given: Float32Array[] = []
      const renderFunction = jest.fn((peaks: ChannelData) => {
        for (const peak of peaks as Float32Array[]) {
          given.push(peak)
          peak.fill(9)
        }
      })

      const { calls } = await draw(channels, { renderFunction }, false)

      expect(renderFunction).toHaveBeenCalled()
      expect(calls.every(([args]) => args.readOnly === false)).toBe(true)
      expect(given.length).toBeGreaterThan(0)
      given.forEach((peak) => expect(channels.map((channel) => channel.buffer)).not.toContain(peak.buffer))
      channels.forEach((channel, c) => expect(Array.from(channel)).toEqual(before[c]))
    })

    test('with channels split, only the channel that has one is given copies', async () => {
      const channels = audio(4, 20000)
      const before = channels.map((channel) => Array.from(channel))
      const renderFunction = jest.fn((peaks: ChannelData) => {
        for (const peak of peaks as Float32Array[]) peak.fill(9)
      })

      const { calls, results } = await draw(channels, { splitChannels: [{}, { renderFunction }, {}, {}] }, false)

      calls.forEach(([args], n) => {
        const [channel] = args.channelData as Float32Array[]
        const [slice] = results[n].value as Float32Array[]
        if (channel === channels[1]) {
          expect(args.readOnly).toBe(false)
          expect(slice.buffer).not.toBe(channel.buffer)
        } else {
          expect(args.readOnly).toBe(true)
          expect(slice.buffer).toBe(channel.buffer)
        }
      })
      expect(renderFunction).toHaveBeenCalled()
      channels.forEach((channel, c) => expect(Array.from(channel)).toEqual(before[c]))
    })
  })
})
