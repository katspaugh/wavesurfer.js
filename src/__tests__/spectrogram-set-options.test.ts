import Spectrogram from '../plugins/spectrogram.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'
import { createFakeAudioBuffer } from './helpers/audio-buffer.js'
import { createEmitter } from './helpers/create-emitter.js'
import { mockWorkerInstances, mockWorkerState } from './helpers/spectrogram-worker-mock.js'

// The worker mock answers with whatever a test passes, so the audio content never matters. With
// 16 bins and a linear scale, the bitmap crop passed to createImageBitmap shows the drawn
// frequency range directly: on 8 kHz audio each bin is 250 Hz.
const BINS = 16
const FRAMES = 8

function makeBuffer(sampleRate = 8000): AudioBuffer {
  return createFakeAudioBuffer(new Float32Array(4096), { sampleRate })
}

function makeFrequencies(value = 100): Uint8Array[][] {
  return [Array.from({ length: FRAMES }, () => new Uint8Array(BINS).fill(value))]
}

type Posted = { worker: any; id: string; options: Record<string, unknown> }

/** Every request posted to any worker, oldest first (a superseded worker is replaced) */
function posted(): Posted[] {
  return mockWorkerInstances.flatMap((worker) =>
    worker.postMessage.mock.calls.map(([message]: any[]) => ({ worker, id: message.id, options: message.options })),
  )
}

function lastPosted(): Posted {
  const all = posted()
  return all[all.length - 1]
}

function respond(request: Posted = lastPosted(), result: Uint8Array[][] = makeFrequencies()): void {
  request.worker.onmessage({ data: { type: 'frequenciesResult', id: request.id, result } })
}

function failRequest(request: Posted = lastPosted(), message = 'worker failed'): void {
  request.worker.onmessage({ data: { type: 'frequenciesResult', id: request.id, error: message } })
}

/** Runs pending promise continuations without advancing any timer */
async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}

const nextFrame = () => jest.advanceTimersByTime(16)

type Settled = { state: 'pending' | 'resolved' | 'rejected'; error?: any }

function track(promise: Promise<unknown>, log?: string[], name = 'request'): Settled {
  const settled: Settled = { state: 'pending' }
  promise.then(
    () => {
      settled.state = 'resolved'
      log?.push(`${name} resolved`)
    },
    (error) => {
      settled.state = 'rejected'
      settled.error = error
      log?.push(`${name} rejected`)
    },
  )
  return settled
}

let context: Record<string, any>
let createImageBitmapMock: jest.Mock
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalImageData = (globalThis as any).ImageData
const originalCreateImageBitmap = (globalThis as any).createImageBitmap
const plugins: any[] = []

beforeAll(() => {
  // jsdom has no Worker; the plugin only checks that it exists before using the injected mock
  ;(globalThis as any).Worker = function Worker() {}
})

beforeEach(() => {
  jest.useFakeTimers()
  mockWorkerInstances.length = 0
  mockWorkerState.constructorAttempts = 0
  mockWorkerState.constructorShouldThrow = false
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)

  // jsdom has no 2D context, ImageData or createImageBitmap: stub enough for real draws
  context = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: jest.fn(),
    fillText: jest.fn(),
    drawImage: jest.fn(),
    scale: jest.fn(),
  }
  HTMLCanvasElement.prototype.getContext = jest.fn(() => context) as any
  ;(globalThis as any).ImageData = class {
    data: Uint8ClampedArray
    constructor(
      public width: number,
      public height: number,
    ) {
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
  createImageBitmapMock = jest.fn(() => Promise.resolve({ close: jest.fn() }))
  ;(globalThis as any).createImageBitmap = createImageBitmapMock
})

afterEach(() => {
  plugins.splice(0).forEach((plugin) => plugin.destroy())
  jest.useRealTimers()
  jest.restoreAllMocks()
  HTMLCanvasElement.prototype.getContext = originalGetContext
  ;(globalThis as any).ImageData = originalImageData
  ;(globalThis as any).createImageBitmap = originalCreateImageBitmap
})

function createPlugin(
  options: Record<string, unknown> = {},
  { buffer = makeBuffer() as AudioBuffer | null, width = 600 } = {},
) {
  const emitter = createEmitter()
  let decoded = buffer
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'offsetWidth', { value: width })
  Object.defineProperty(wrapper, 'clientWidth', { value: width })

  const plugin: any = Spectrogram.create({ useWebWorker: true, scale: 'linear', ...options })
  const events = { ready: jest.fn(), error: jest.fn() }
  plugin.on('ready', events.ready)
  plugin.on('error', events.error)
  plugin._init(createFakeWaveSurfer({ on: emitter.on, getDecodedData: () => decoded, getWrapper: () => wrapper }))
  plugins.push(plugin)
  const internals = plugin.__spectrogramInternalsForTests()

  return {
    plugin,
    emitter,
    events,
    internals,
    setBuffer: (next: AudioBuffer | null) => {
      decoded = next
    },
    /** The plugin's own wrapper element */
    element: internals.canvasContainer.parentElement as HTMLElement,
  }
}

/** The initial render: the 0 ms init tick, the 50 ms render throttle, then the worker's answer */
async function firstDraw(result = makeFrequencies()): Promise<void> {
  jest.advanceTimersByTime(50)
  respond(lastPosted(), result)
  await flush()
}

/** [y, height] of the source rectangle of the latest bitmap crop */
function lastCrop(): number[] {
  const calls = createImageBitmapMock.mock.calls as unknown[][]
  const call = calls[calls.length - 1]
  return [call[2] as number, call[4] as number]
}

/** The text of the latest frequency label drawn, the top one (labels need height 256 for that) */
function topLabel(): string {
  const calls = context.fillText.mock.calls
  return calls[calls.length - 1][0]
}

describe('SpectrogramPlugin setOptions in full rendering mode', () => {
  it('redraws a height change from the retained data on the next frame, without a new analysis', async () => {
    const h = createPlugin()
    await firstDraw()
    const frequencies = h.internals.cachedFrequencies
    const resampled = h.internals.cachedResampledData
    const [previousCanvas] = h.internals.canvases

    const settled = track(h.plugin.setOptions({ height: 250 }))
    const stateAtReady: string[] = []
    h.plugin.on('ready', () => stateAtReady.push(settled.state))
    await flush()
    expect(settled.state).toBe('pending')

    nextFrame()
    await flush()

    expect(stateAtReady).toEqual(['pending'])
    expect(settled.state).toBe('resolved')
    expect(posted()).toHaveLength(1)
    expect(h.internals.canvasContainer.contains(previousCanvas)).toBe(false)
    expect(h.internals.canvases).toHaveLength(1)
    expect(h.internals.canvases[0].style.height).toBe('250px')
    expect(h.element.style.height).toBe('250px')
    expect(h.internals.cachedFrequencies).toBe(frequencies)
    expect(h.internals.cachedResampledData).toBe(resampled)
  })

  it('coalesces the display changes of one frame into a single redraw', async () => {
    const h = createPlugin()
    await firstDraw()
    createImageBitmapMock.mockClear()

    const height = track(h.plugin.setOptions({ height: 250 }))
    const range = track(h.plugin.setOptions({ frequencyMin: 1000, frequencyMax: 3000 }))
    nextFrame()
    await flush()

    expect(h.events.ready).toHaveBeenCalledTimes(2)
    expect(createImageBitmapMock).toHaveBeenCalledTimes(1)
    expect(height.state).toBe('resolved')
    expect(range.state).toBe('resolved')
    expect(h.internals.canvases[0].style.height).toBe('250px')
    // 1000-3000 Hz of a 0-4000 Hz band: bins 4 to 12 counted from the top
    expect(lastCrop()).toEqual([4, 8])
  })

  it('redraws a color map change from the retained data, without a new analysis', async () => {
    const h = createPlugin()
    await firstDraw()
    const firstPixel = () => {
      const calls = createImageBitmapMock.mock.calls as any[][]
      return Array.from(calls[calls.length - 1][0].data.slice(0, 4))
    }
    const before = firstPixel()

    const settled = track(h.plugin.setOptions({ colorMap: 'gray' }))
    nextFrame()
    await flush()

    expect(settled.state).toBe('resolved')
    expect(h.events.ready).toHaveBeenCalledTimes(2)
    expect(posted()).toHaveLength(1)
    expect(firstPixel()).not.toEqual(before)
  })

  it('starts a new analysis for analysis options and resolves once its data is drawn', async () => {
    const h = createPlugin()
    await firstDraw()

    const settled = track(h.plugin.setOptions({ fftSamples: 1024, rangeDB: 60 }))
    const stateAtReady: string[] = []
    h.plugin.on('ready', () => stateAtReady.push(settled.state))
    jest.advanceTimersByTime(50)

    expect(posted()).toHaveLength(2)
    expect(lastPosted().options).toMatchObject({ fftSamples: 1024, rangeDB: 60 })
    await flush()
    expect(settled.state).toBe('pending')

    const data = makeFrequencies(200)
    respond(lastPosted(), data)
    await flush()

    expect(stateAtReady).toEqual(['pending'])
    expect(settled.state).toBe('resolved')
    expect(h.internals.cachedFrequencies).toBe(data)
  })

  it('supersedes an in-flight analysis: AbortError, a replaced worker, and the old picture kept', async () => {
    const h = createPlugin()
    await firstDraw()
    const previousCanvases = h.internals.canvases.slice()

    const a = track(h.plugin.setOptions({ fftSamples: 1024 }))
    jest.advanceTimersByTime(50)
    const requestA = lastPosted()

    const b = track(h.plugin.setOptions({ fftSamples: 2048 }))
    await flush()

    expect(a.state).toBe('rejected')
    expect(a.error.name).toBe('AbortError')
    expect(h.events.error).not.toHaveBeenCalled()
    expect(requestA.worker.terminate).toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalledWith(
      'Worker calculation failed, falling back to main thread:',
      expect.anything(),
    )

    jest.advanceTimersByTime(50)
    const requestB = lastPosted()
    expect(requestB.worker).not.toBe(requestA.worker)
    expect(requestB.options.fftSamples).toBe(2048)
    // Nothing is drawn for A: the previous picture stays until B is drawn
    expect(h.internals.canvases).toEqual(previousCanvases)
    expect(previousCanvases.every((canvas: HTMLCanvasElement) => h.internals.canvasContainer.contains(canvas))).toBe(
      true,
    )
    expect(b.state).toBe('pending')

    const data = makeFrequencies(200)
    respond(requestB, data)
    await flush()

    expect(b.state).toBe('resolved')
    expect(h.internals.cachedFrequencies).toBe(data)
  })

  it('merges a display change into an in-flight analysis without restarting it', async () => {
    const h = createPlugin()
    await firstDraw()

    const analysis = track(h.plugin.setOptions({ fftSamples: 1024 }))
    jest.advanceTimersByTime(50)
    const display = track(h.plugin.setOptions({ height: 300 }))
    nextFrame()
    jest.advanceTimersByTime(50)
    await flush()

    expect(posted()).toHaveLength(2)
    expect(analysis.state).toBe('pending')
    expect(display.state).toBe('pending')

    respond()
    await flush()

    expect(analysis.state).toBe('resolved')
    expect(display.state).toBe('resolved')
    expect(h.internals.canvases[0].style.height).toBe('300px')
  })

  describe('joining', () => {
    it('joins the pending analysis when the same values are requested again', async () => {
      const h = createPlugin()
      await firstDraw()

      const first = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      const repeat = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      nextFrame()
      await flush()

      expect(posted()).toHaveLength(2)
      expect(repeat.state).toBe('pending')

      respond()
      await flush()
      expect(first.state).toBe('resolved')
      expect(repeat.state).toBe('resolved')

      // Once drawn, the same values resolve at once
      const drawn = track(h.plugin.setOptions({ fftSamples: 1024 }))
      await flush()
      expect(drawn.state).toBe('resolved')
      expect(posted()).toHaveLength(2)
    })

    it('rejects unchanged calls without analysis options with the analysis they joined', async () => {
      const h = createPlugin()
      await firstDraw()

      track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      const joined = [
        track(h.plugin.setOptions({})),
        track(h.plugin.setOptions({ height: 200 })),
        track(h.plugin.setOptions({ useWebWorker: true })),
      ]
      // A display change is carried forward to the analysis that is drawn next
      const display = track(h.plugin.setOptions({ height: 300 }))
      const replacement = track(h.plugin.setOptions({ fftSamples: 2048 }))
      await flush()

      for (const settled of joined) {
        expect(settled.state).toBe('rejected')
        expect(settled.error.name).toBe('AbortError')
      }
      expect(display.state).toBe('pending')
      expect(replacement.state).toBe('pending')

      jest.advanceTimersByTime(50)
      expect(posted()).toHaveLength(3)
      respond()
      await flush()

      expect(display.state).toBe('resolved')
      expect(replacement.state).toBe('resolved')
      expect(h.internals.canvases[0].style.height).toBe('300px')
    })

    it('rejects a joined request with AbortError when its analysis is superseded', async () => {
      const h = createPlugin()
      await firstDraw()

      track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      const joined = track(h.plugin.setOptions({ fftSamples: 1024 }))
      track(h.plugin.setOptions({ fftSamples: 2048 }))
      await flush()

      expect(joined.state).toBe('rejected')
      expect(joined.error.name).toBe('AbortError')
    })
  })

  describe('failure and retry', () => {
    it('rejects the analysis and the display change merged into it, then retries the same values', async () => {
      const h = createPlugin({ fallbackToMainThread: false })
      await firstDraw()
      const log: string[] = []
      h.plugin.on('error', () => log.push('error'))

      const analysis = track(h.plugin.setOptions({ fftSamples: 1024 }), log, 'analysis')
      jest.advanceTimersByTime(50)
      const display = track(h.plugin.setOptions({ height: 300 }), log, 'display')
      failRequest(lastPosted(), 'worker failed')
      await flush()

      expect(h.events.error).toHaveBeenCalledTimes(1)
      const error = h.events.error.mock.calls[0][0]
      expect(error.message).toBe('worker failed')
      expect(analysis.error).toBe(error)
      expect(display.error).toBe(error)
      expect(log).toEqual(['error', 'analysis rejected', 'display rejected'])

      // A display-only request in the failed state starts nothing
      const displayAfter = track(h.plugin.setOptions({ height: 320 }))
      await flush()
      jest.advanceTimersByTime(50)
      nextFrame()
      expect(displayAfter.state).toBe('resolved')
      expect(posted()).toHaveLength(2)

      // The identical analysis values retry
      const retry = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      expect(posted()).toHaveLength(3)
      expect(lastPosted().options.fftSamples).toBe(1024)
      respond()
      await flush()
      expect(retry.state).toBe('resolved')
      expect(h.internals.canvases[0].style.height).toBe('320px')
    })

    it('rejects with the worker timeout error', async () => {
      const h = createPlugin({ fallbackToMainThread: false, workerTimeout: 1000 })
      await firstDraw()

      const analysis = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      jest.advanceTimersByTime(1000)
      await flush()

      expect(h.events.error).toHaveBeenCalledTimes(1)
      expect(analysis.state).toBe('rejected')
      expect(analysis.error.message).toBe('Worker timeout')
    })
  })

  describe('empty draws and lost data', () => {
    it('settles on a buffer too short for one frame', async () => {
      const h = createPlugin()
      const settled = track(h.plugin.setOptions({ height: 250 }))
      await firstDraw([[]])

      expect(h.events.ready).not.toHaveBeenCalled()
      expect(settled.state).toBe('resolved')
    })

    it('settles on a zero-width wrapper', async () => {
      const h = createPlugin({}, { width: 0 })
      const settled = track(h.plugin.setOptions({ height: 250 }))
      await firstDraw()

      expect(h.events.ready).not.toHaveBeenCalled()
      expect(settled.state).toBe('resolved')
    })

    it('resolves a display change whose data is cleared before its frame, without an analysis', async () => {
      const h = createPlugin()
      await firstDraw()

      const settled = track(h.plugin.setOptions({ height: 250 }))
      h.plugin.clearCache()
      nextFrame()
      await flush()

      expect(settled.state).toBe('resolved')
      expect(posted()).toHaveLength(1)

      // The next ordinary render uses the stored height
      h.emitter.emit('redraw')
      jest.advanceTimersByTime(50)
      respond()
      await flush()
      expect(h.internals.canvases[0].style.height).toBe('250px')
    })

    it('resolves a display change made after clearCache() without an analysis', async () => {
      const h = createPlugin()
      await firstDraw()

      h.plugin.clearCache()
      const settled = track(h.plugin.setOptions({ height: 250 }))
      await flush()
      jest.advanceTimersByTime(100)
      await flush()

      expect(settled.state).toBe('resolved')
      expect(posted()).toHaveLength(1)
    })
  })

  describe('error listeners', () => {
    function throwOnDraw(): void {
      HTMLCanvasElement.prototype.getContext = jest.fn(() => {
        throw new Error('draw failed')
      }) as any
    }

    function restoreDraw(): void {
      HTMLCanvasElement.prototype.getContext = jest.fn(() => context) as any
    }

    it.each([
      ['a worker failure', failRequest],
      [
        'an error thrown while drawing',
        (request: Posted) => {
          throwOnDraw()
          respond(request)
        },
      ],
    ])('settles with AbortError when the error listener destroys the plugin, after %s', async (_, fail) => {
      const h = createPlugin({ fallbackToMainThread: false })
      await firstDraw()
      h.plugin.on('error', () => h.plugin.destroy())

      const analysis = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      fail(lastPosted())
      await flush()

      expect(h.events.error).toHaveBeenCalledTimes(1)
      expect(analysis.state).toBe('rejected')
      expect(analysis.error.name).toBe('AbortError')
    })

    it.each([
      ['a worker failure', failRequest],
      [
        'an error thrown while drawing',
        (request: Posted) => {
          throwOnDraw()
          respond(request)
        },
      ],
    ])('lets the error listener request newer settings, after %s', async (_, fail) => {
      const h = createPlugin({ fallbackToMainThread: false })
      await firstDraw()
      let newer: Settled | undefined
      h.plugin.on(
        'error',
        () => {
          restoreDraw()
          newer = track(h.plugin.setOptions({ fftSamples: 2048 }))
        },
        { once: true },
      )

      const analysis = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      fail(lastPosted())
      await flush()

      expect(analysis.state).toBe('rejected')
      expect(analysis.error.name).toBe('AbortError')
      expect(newer?.state).toBe('pending')

      jest.advanceTimersByTime(50)
      expect(lastPosted().options.fftSamples).toBe(2048)
      respond()
      await flush()
      expect(newer?.state).toBe('resolved')
      expect(h.events.error).toHaveBeenCalledTimes(1)
    })

    it('emits and rejects when the frame redraw throws', async () => {
      const h = createPlugin()
      await firstDraw()
      throwOnDraw()

      const settled = track(h.plugin.setOptions({ height: 250 }))
      expect(() => nextFrame()).not.toThrow()
      await flush()

      expect(h.events.error).toHaveBeenCalledTimes(1)
      expect(settled.state).toBe('rejected')
      expect(settled.error).toBe(h.events.error.mock.calls[0][0])
    })

    it('emits and rejects when the throttled cached redraw throws', async () => {
      const h = createPlugin()
      await firstDraw()

      // A redraw at an unchanged zoom schedules the cached render; the height change joins it
      h.emitter.emit('redraw')
      const settled = track(h.plugin.setOptions({ height: 250 }))
      throwOnDraw()
      expect(() => jest.advanceTimersByTime(50)).not.toThrow()
      await flush()

      expect(h.events.error).toHaveBeenCalledTimes(1)
      expect(settled.state).toBe('rejected')
      expect(settled.error).toBe(h.events.error.mock.calls[0][0])
    })
  })

  describe('validation', () => {
    it.each([
      ['an invalid fftSamples', { fftSamples: 1000 }],
      ['height 0', { height: 0 }],
      ['height NaN', { height: NaN }],
      ['frequencyMin equal to frequencyMax', { frequencyMin: 3000, frequencyMax: 3000 }],
      ['frequencyMin above frequencyMax', { frequencyMin: 3000, frequencyMax: 2000 }],
      ['frequencyMin above the automatic maximum', { frequencyMin: 5000, frequencyMax: 0 }],
      ['a changed useWebWorker', { useWebWorker: false }],
      ['a changed container', { container: document.createElement('div') }],
    ])('throws synchronously for %s and changes nothing', async (_, options) => {
      const h = createPlugin()
      await firstDraw()

      expect(() => h.plugin.setOptions(options)).toThrow()
      jest.advanceTimersByTime(100)
      await flush()

      expect(posted()).toHaveLength(1)
      expect(h.events.ready).toHaveBeenCalledTimes(1)
    })

    it('throws for two explicit bounds in the wrong order before decode', () => {
      const h = createPlugin({}, { buffer: null })
      expect(() => h.plugin.setOptions({ frequencyMin: 3000, frequencyMax: 2000 })).toThrow()
    })

    it('accepts an automatic maximum, a maximum above Nyquist and unchanged fixed options', async () => {
      const h = createPlugin({ labels: false })
      await firstDraw()

      expect(() => h.plugin.setOptions({ frequencyMin: 1000, frequencyMax: 0 })).not.toThrow()
      expect(() => h.plugin.setOptions({ frequencyMax: 6000 })).not.toThrow()
      expect(() => h.plugin.setOptions({ labels: false, useWebWorker: true })).not.toThrow()
    })

    it('accepts a height and a minimum before decode, while the automatic maximum is unknown', () => {
      const h = createPlugin({}, { buffer: null })
      expect(() => h.plugin.setOptions({ height: 300 })).not.toThrow()
      expect(() => h.plugin.setOptions({ frequencyMin: 5000 })).not.toThrow()
    })
  })

  describe('no-op detection', () => {
    it('resolves unchanged calls at once without drawing or computing', async () => {
      const h = createPlugin()
      await firstDraw()
      const [canvas] = h.internals.canvases

      for (const options of [{}, { height: 200 }, { workerTimeout: 5000 }, { frequencyMax: undefined }]) {
        const settled = track(h.plugin.setOptions(options))
        await flush()
        expect(settled.state).toBe('resolved')
      }
      jest.advanceTimersByTime(100)
      await flush()

      expect(h.events.ready).toHaveBeenCalledTimes(1)
      expect(posted()).toHaveLength(1)
      expect(h.internals.canvases[0]).toBe(canvas)
    })

    it('resolves an unchanged call at once while an unrelated redraw is scheduled', async () => {
      const h = createPlugin()
      await firstDraw()

      // A redraw at an unchanged zoom schedules the cached render
      h.emitter.emit('redraw')
      const settled = track(h.plugin.setOptions({}))
      await flush()

      expect(settled.state).toBe('resolved')
      expect(h.events.ready).toHaveBeenCalledTimes(1)
    })

    it('settles unchanged calls made from a ready listener without another draw', async () => {
      const h = createPlugin()
      await firstDraw()
      const fromReady: Settled[] = []
      h.plugin.on(
        'ready',
        () => {
          fromReady.push(
            track(h.plugin.setOptions({})),
            track(h.plugin.setOptions({ height: 250 })),
            track(h.plugin.setOptions({ fallbackToMainThread: true })),
          )
        },
        { once: true },
      )

      track(h.plugin.setOptions({ height: 250 }))
      nextFrame()
      await flush()
      const [canvas] = h.internals.canvases
      jest.advanceTimersByTime(100)
      await flush()

      expect(fromReady.map((settled) => settled.state)).toEqual(['resolved', 'resolved', 'resolved'])
      expect(h.events.ready).toHaveBeenCalledTimes(2)
      expect(h.internals.canvases[0]).toBe(canvas)
      expect(posted()).toHaveLength(1)
    })

    it('redraws once when an explicit maximum goes back to automatic', async () => {
      const h = createPlugin({ frequencyMax: 3000 })
      await firstDraw()
      expect(lastCrop()).toEqual([4, 12])

      const settled = track(h.plugin.setOptions({ frequencyMax: 0 }))
      nextFrame()
      jest.advanceTimersByTime(100)
      await flush()

      expect(settled.state).toBe('resolved')
      expect(h.events.ready).toHaveBeenCalledTimes(2)
      expect(lastCrop()).toEqual([0, 16])
    })
  })

  it('applies a new workerTimeout to the next request without recomputing', async () => {
    const h = createPlugin({ fallbackToMainThread: false })
    await firstDraw()

    const policy = track(h.plugin.setOptions({ workerTimeout: 1000 }))
    await flush()
    expect(policy.state).toBe('resolved')
    expect(posted()).toHaveLength(1)

    const analysis = track(h.plugin.setOptions({ fftSamples: 1024 }))
    jest.advanceTimersByTime(50)
    jest.advanceTimersByTime(999)
    await flush()
    expect(analysis.state).toBe('pending')

    jest.advanceTimersByTime(1)
    await flush()
    expect(analysis.state).toBe('rejected')
    expect(analysis.error.message).toBe('Worker timeout')
  })

  describe('lifecycle', () => {
    it('settles a request made before decode with the first draw, which uses the new options', async () => {
      const h = createPlugin({}, { buffer: null })
      const settled = track(h.plugin.setOptions({ height: 300, fftSamples: 1024 }))
      jest.advanceTimersByTime(100)
      await flush()
      expect(settled.state).toBe('pending')
      expect(posted()).toHaveLength(0)

      h.setBuffer(makeBuffer())
      h.emitter.emit('redraw')
      jest.advanceTimersByTime(50)
      expect(lastPosted().options.fftSamples).toBe(1024)
      respond()
      await flush()

      expect(settled.state).toBe('resolved')
      expect(h.internals.canvases[0].style.height).toBe('300px')
    })

    it('rejects pending requests with AbortError on destroy, and calls made after it', async () => {
      const h = createPlugin()
      await firstDraw()

      const pending = track(h.plugin.setOptions({ fftSamples: 1024 }))
      jest.advanceTimersByTime(50)
      h.plugin.destroy()
      await flush()

      expect(pending.state).toBe('rejected')
      expect(pending.error.name).toBe('AbortError')

      const afterDestroy = track(h.plugin.setOptions({ height: 300 }))
      await flush()
      expect(afterDestroy.state).toBe('rejected')
      expect(afterDestroy.error.name).toBe('AbortError')
    })
  })

  it('settles a display change made from a ready listener with the next draw, not the current one', async () => {
    const h = createPlugin()
    await firstDraw()
    let inner: Settled | undefined
    h.plugin.on(
      'ready',
      () => {
        inner = track(h.plugin.setOptions({ height: 300 }))
      },
      { once: true },
    )

    const outer = track(h.plugin.setOptions({ height: 250 }))
    nextFrame()
    await flush()

    expect(outer.state).toBe('resolved')
    expect(inner?.state).toBe('pending')
    expect(h.internals.canvases[0].style.height).toBe('250px')

    nextFrame()
    await flush()

    expect(inner?.state).toBe('resolved')
    expect(h.internals.canvases[0].style.height).toBe('300px')
    expect(h.events.ready).toHaveBeenCalledTimes(3)
  })

  it('treats analysis options as fixed with frequenciesDataUrl, and redraws a display change', async () => {
    const data = [Array.from({ length: FRAMES }, () => Array.from({ length: BINS }, () => 100))]
    const originalFetch = global.fetch
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => data })
    global.fetch = fetchMock as any
    try {
      const h = createPlugin({
        frequenciesDataUrl: 'https://example.com/frequencies.json',
        sampleRate: 8000,
        useWebWorker: false,
      })
      jest.advanceTimersByTime(50)
      await flush()
      expect(h.events.ready).toHaveBeenCalledTimes(1)

      expect(() => h.plugin.setOptions({ fftSamples: 1024 })).toThrow()

      const settled = track(h.plugin.setOptions({ height: 300 }))
      jest.advanceTimersByTime(50)
      await flush()

      expect(settled.state).toBe('resolved')
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(h.internals.canvases[0].style.height).toBe('300px')
    } finally {
      global.fetch = originalFetch
    }
  })

  describe('automatic maximum', () => {
    async function loadSecondBuffer(h: ReturnType<typeof createPlugin>): Promise<void> {
      h.setBuffer(makeBuffer(16000))
      h.emitter.emit('redraw')
      jest.advanceTimersByTime(50)
      respond()
      await flush()
    }

    it('keeps the first buffer latch on a retained plugin, as before', async () => {
      const h = createPlugin({ labels: true, height: 256 })
      await firstDraw()
      expect(lastCrop()).toEqual([0, 16])
      expect(topLabel()).toBe('4.0')

      await loadSecondBuffer(h)

      // 0-4000 Hz of a 0-8000 Hz band
      expect(lastCrop()).toEqual([8, 8])
      expect(topLabel()).toBe('4.0')
    })

    it('respects a maximum passed to the constructor', async () => {
      createPlugin({ labels: true, height: 256, frequencyMax: 3000 })
      await firstDraw()

      expect(lastCrop()).toEqual([4, 12])
      expect(topLabel()).toBe('3.0')
    })

    it('keeps the latch for an automatic request, and resets it after an explicit maximum', async () => {
      const h = createPlugin({ labels: true, height: 256 })
      await firstDraw()
      await loadSecondBuffer(h)

      const unchanged = track(h.plugin.setOptions({ frequencyMax: 0 }))
      nextFrame()
      await flush()
      expect(unchanged.state).toBe('resolved')
      expect(h.events.ready).toHaveBeenCalledTimes(2)
      expect(() => h.plugin.setOptions({ frequencyMin: 6000, frequencyMax: 0 })).toThrow()

      track(h.plugin.setOptions({ frequencyMax: 7000 }))
      nextFrame()
      await flush()
      expect(lastCrop()).toEqual([2, 14])

      let fromReady: Settled | undefined
      h.plugin.on(
        'ready',
        () => {
          fromReady = track(h.plugin.setOptions({ frequencyMax: 0 }))
        },
        { once: true },
      )
      const reset = track(h.plugin.setOptions({ frequencyMax: 0 }))
      nextFrame()
      jest.advanceTimersByTime(100)
      await flush()

      expect(reset.state).toBe('resolved')
      expect(fromReady?.state).toBe('resolved')
      expect(lastCrop()).toEqual([0, 16])
      expect(topLabel()).toBe('8.0')
      expect(h.events.ready).toHaveBeenCalledTimes(4)
      expect(posted()).toHaveLength(2)

      const repeated = track(h.plugin.setOptions({ frequencyMax: 0 }))
      nextFrame()
      await flush()
      expect(repeated.state).toBe('resolved')
      expect(h.events.ready).toHaveBeenCalledTimes(4)
    })

    it('validates a minimum against the Nyquist target of an explicit maximum reset', async () => {
      const h = createPlugin()
      await firstDraw()
      await loadSecondBuffer(h)
      track(h.plugin.setOptions({ frequencyMax: 7000 }))

      expect(() => h.plugin.setOptions({ frequencyMin: 7500, frequencyMax: 0 })).not.toThrow()
    })
  })

  it('does not report the error of a computation that a newer analysis replaced', async () => {
    const h = createPlugin({ useWebWorker: false, fftSamples: 256, noverlap: 0 })
    jest.advanceTimersByTime(50)
    await flush()
    expect(h.events.ready).toHaveBeenCalledTimes(1)
    // An error listener that would cancel the replacement as well
    h.plugin.on('error', () => h.plugin.destroy())

    // Window names are not validated up front, so this computation throws on the main thread
    const failing = track(h.plugin.setOptions({ windowFunc: 'not-a-window' }))
    let replacement: Settled | undefined
    jest.advanceTimersByTime(50)
    // A promise job that runs before the failed computation reaches the render's catch
    void Promise.resolve().then(() => {
      replacement = track(h.plugin.setOptions({ windowFunc: 'hann', fftSamples: 512 }))
    })
    await flush()

    expect(failing.state).toBe('rejected')
    expect(failing.error.name).toBe('AbortError')
    expect(h.events.error).not.toHaveBeenCalled()
    expect(replacement?.state).toBe('pending')

    jest.advanceTimersByTime(50)
    await flush()

    expect(replacement?.state).toBe('resolved')
    expect(h.events.ready).toHaveBeenCalledTimes(2)
  })

  it('neither caches nor draws an analysis answered just before a newer one starts', async () => {
    const h = createPlugin()
    await firstDraw()
    const [canvas] = h.internals.canvases

    track(h.plugin.setOptions({ fftSamples: 1024 }))
    jest.advanceTimersByTime(50)
    const dataA = makeFrequencies(1)
    respond(lastPosted(), dataA)
    // A promise job (queueMicrotask is faked) that runs between the worker's answer and the
    // plugin's continuations that would cache and draw it
    void Promise.resolve().then(() => {
      h.plugin.setOptions({ fftSamples: 2048 })
    })
    await flush()

    expect(h.internals.cachedFrequencies).not.toBe(dataA)
    expect(h.events.ready).toHaveBeenCalledTimes(1)
    expect(h.internals.canvases[0]).toBe(canvas)

    jest.advanceTimersByTime(50)
    expect(lastPosted().options.fftSamples).toBe(2048)
  })
})

describe('SpectrogramPlugin setOptions in windowed rendering mode', () => {
  it('warns, rejects and changes nothing', async () => {
    const h = createPlugin({ rendering: 'windowed' })
    jest.advanceTimersByTime(0)
    expect(h.element.style.height).toBe('200px')
    const reset = jest.spyOn(h.internals.windowed.segmentManager, 'reset')
    const requests = posted().length

    const settled = track(h.plugin.setOptions({ height: 300 }))
    await flush()

    expect(settled.state).toBe('rejected')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('setOptions() is not supported'))
    expect(reset).not.toHaveBeenCalled()
    expect(posted()).toHaveLength(requests)

    // The next windowed render still uses the creation height
    h.emitter.emit('ready')
    expect(h.element.style.height).toBe('200px')
  })
})
