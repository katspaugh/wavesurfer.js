const mockWorkerInstances: any[] = []
const mockWorkerState = { constructorAttempts: 0, constructorShouldThrow: false }

jest.mock(
  'web-worker:./spectrogram-worker.ts',
  () => ({
    __esModule: true,
    default: class MockSpectrogramWorker {
      onmessage: ((e: { data: any }) => void) | null = null
      onerror: ((e: Event) => void) | null = null
      onmessageerror: ((e: Event) => void) | null = null
      postMessage = jest.fn()
      terminate = jest.fn()
      constructor() {
        mockWorkerState.constructorAttempts++
        if (mockWorkerState.constructorShouldThrow) {
          throw new Error('worker construction blocked')
        }
        mockWorkerInstances.push(this)
      }
    },
  }),
  { virtual: true },
)

import Spectrogram from '../plugins/spectrogram.js'
import WindowedSpectrogram from '../plugins/spectrogram-windowed.js'
import { paintColumnPixels } from '../fft.js'

const SAMPLE_RATE = 8000
const LENGTH = 4096

function makeBuffer(): AudioBuffer {
  const data = new Float32Array(LENGTH)
  for (let i = 0; i < LENGTH; i++) {
    data[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE)
  }
  return {
    sampleRate: SAMPLE_RATE,
    length: LENGTH,
    duration: LENGTH / SAMPLE_RATE,
    numberOfChannels: 1,
    getChannelData: () => data,
  } as unknown as AudioBuffer
}

// SpectrogramPlugin is a definePlugin() plugin: its setup() (which attaches the public/test API
// and creates the worker) only runs once the plugin is registered with a wavesurfer instance, not
// at `.create()` time - see hover.test.ts/regions.test.ts for the same `_init()` pattern with
// other ported plugins. WindowedSpectrogramPlugin is now a thin shim delegating into the same
// setup() (see spectrogram-windowed.ts), so it needs the identical `_init()` treatment - its
// windowed-only internals (calculateFrequencies/calculateFrequenciesMainThread/
// calculateFrequenciesWithWorker, and the segment manager) live under
// __spectrogramInternalsForTests().windowed, same as spectrogram-windowed-destroy.test.ts.
function createFakeWaveSurfer(overrides: Record<string, unknown> = {}) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'offsetWidth', { value: 600, configurable: true })
  Object.defineProperty(wrapper, 'clientWidth', { value: 600, configurable: true })
  return {
    options: {},
    getWrapper: () => wrapper,
    getDecodedData: () => null,
    on: () => () => undefined,
    ...overrides,
  }
}

/** Reports how a promise settled within `ms`, without waiting longer */
function settledWithin(promise: Promise<unknown>, ms: number): Promise<'resolved' | 'rejected' | 'pending'> {
  return Promise.race([
    promise.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    ),
    new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), ms)),
  ])
}

beforeAll(() => {
  // jsdom has no Worker; the plugins only check its existence before using the bundled constructor
  ;(globalThis as any).Worker = function Worker() {}
})

beforeEach(() => {
  mockWorkerInstances.length = 0
  mockWorkerState.constructorAttempts = 0
  mockWorkerState.constructorShouldThrow = false
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('SpectrogramPlugin worker error handling', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin = Spectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options }) as any
    plugin._init(createFakeWaveSurfer() as any)
    return { plugin, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('rejects the in-flight promise when the worker errors, even with workerTimeout: 0', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.__spectrogramInternalsForTests().calculateFrequenciesWithWorker(makeBuffer())
    promise.catch(() => undefined)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.onerror(new Event('error'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(plugin.__spectrogramInternalsForTests().workerPromises.size).toBe(0)
    expect(worker.terminate).toHaveBeenCalled()
    expect(plugin.__spectrogramInternalsForTests().worker).toBeNull()
  })

  it('clears the timeout timer when the worker errors', async () => {
    const { plugin, worker } = createPlugin()
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout')
    const promise = plugin.__spectrogramInternalsForTests().calculateFrequenciesWithWorker(makeBuffer())

    worker.onerror(new Event('error'))

    await expect(promise).rejects.toThrow('Worker error')
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('rejects the in-flight promise on a message deserialization error', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.__spectrogramInternalsForTests().calculateFrequenciesWithWorker(makeBuffer())
    promise.catch(() => undefined)

    worker.onmessageerror(new Event('messageerror'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(plugin.__spectrogramInternalsForTests().workerPromises.size).toBe(0)
    expect(plugin.__spectrogramInternalsForTests().worker).toBeNull()
  })

  it('falls back to the main thread immediately after a worker error', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies.length).toBe(1)
    expect(frequencies[0].length).toBeGreaterThan(0)
    expect(frequencies[0][0]).toBeInstanceOf(Uint8Array)
  })

  it('rejects pending promises on destroy', async () => {
    const { plugin } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.__spectrogramInternalsForTests().calculateFrequenciesWithWorker(makeBuffer())
    promise.catch(() => undefined)

    plugin.destroy()

    await expect(promise).rejects.toThrow('Spectrogram plugin destroyed')
    expect(plugin.__spectrogramInternalsForTests().workerPromises.size).toBe(0)
  })
})

describe('WindowedSpectrogramPlugin worker error handling', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options })
    plugin._init(createFakeWaveSurfer() as any)
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = makeBuffer()
    return { plugin, internals, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('rejects the in-flight promise when the worker errors instead of waiting out the timeout', async () => {
    const { internals, worker } = createPlugin()
    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.onerror(new Event('error'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(internals.workerPromises.size).toBe(0)
    expect(worker.terminate).toHaveBeenCalled()
    expect(internals.worker).toBeNull()
  })

  it('slices channel data to the segment range before postMessage instead of cloning the whole buffer', async () => {
    // makeBuffer() is LENGTH (4096) samples at SAMPLE_RATE (8000) = 0.512s total. Requesting
    // just [0, 0.25) must postMessage only floor(0.25 * 8000) = 2000 samples per channel, not
    // getChannelData()'s full 4096-sample view - postMessage's structured clone copies the
    // WHOLE ArrayBuffer backing a TypedArray view (not just the viewed range), so posting the
    // full-length view directly would clone the entire decoded channel on every segment
    // request, however small the segment.
    const { internals, worker } = createPlugin()
    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)

    expect(worker.postMessage).toHaveBeenCalledTimes(1)
    const { audioData, options } = worker.postMessage.mock.calls[0][0]
    expect(audioData[0].length).toBe(2000)
    // The worker still re-subarrays internally using options.startTime/endTime (same protocol
    // as the full-buffer path) - since the data it now receives IS the slice, those must be
    // shifted to be relative to it (0..sliceDuration), not the original absolute [0, 0.25).
    expect(options.startTime).toBe(0)
    expect(options.endTime).toBeCloseTo(2000 / 8000, 10)
  })

  it('rejects the in-flight promise on a message deserialization error', async () => {
    const { internals, worker } = createPlugin()
    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)

    worker.onmessageerror(new Event('messageerror'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(internals.workerPromises.size).toBe(0)
    expect(internals.worker).toBeNull()
  })

  it('cleans up the pending request when postMessage throws synchronously', async () => {
    const { internals, worker } = createPlugin()
    worker.postMessage.mockImplementation(() => {
      throw new Error('DataCloneError')
    })

    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)

    await expect(promise).rejects.toThrow('DataCloneError')
    expect(internals.workerPromises.size).toBe(0)
  })

  it('clears the timeout timer when a result arrives', async () => {
    const { internals, worker } = createPlugin()
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout')
    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)
    const { id } = worker.postMessage.mock.calls[0][0]
    const result = [[new Uint8Array([1, 2, 3])]]

    worker.onmessage({ data: { type: 'frequenciesResult', id, result } })

    await expect(promise).resolves.toEqual(result)
    expect(internals.workerPromises.size).toBe(0)
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('rejects pending promises on destroy', async () => {
    const { plugin, internals } = createPlugin()
    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)

    plugin.destroy()

    // Message text is now unified with SpectrogramPlugin's own teardown (both rendering modes
    // share one setup()/teardown now) - was 'Plugin destroyed' pre-unification.
    await expect(promise).rejects.toThrow('Spectrogram plugin destroyed')
    expect(internals.workerPromises.size).toBe(0)
  })

  it('does not recreate the worker for a computation that runs after destroy', async () => {
    // destroy()'s teardown (spectrogram-setup.ts's ctx.scope.add block) disposes the worker
    // exactly once and relies on that being the plugin's last one - it never runs again. A
    // worker built by a post-destroy computation would therefore never be terminated: a
    // permanent live-Worker leak. `buffer` is normally nulled by that same teardown, closing
    // off the only path that reaches worker construction; poking it back non-null (as this test
    // does) simulates a caller still holding a stale reference and firing a computation anyway -
    // the ctx.scope.disposed check is the guard that must catch that instead.
    const { plugin, internals } = createPlugin()
    const workerCountBeforeDestroy = mockWorkerInstances.length

    plugin.destroy()
    internals.buffer = makeBuffer()

    // No worker to respond, so this falls back to (and completes via) the main-thread path -
    // the point under test is only that it does so WITHOUT building a new worker first.
    await internals.windowed.calculateFrequencies(0, 0.25)

    expect(mockWorkerInstances.length).toBe(workerCountBeforeDestroy)
    expect(internals.worker).toBeNull()
  })
})

describe('SpectrogramPlugin fallbackToMainThread option', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin = Spectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options }) as any
    plugin._init(createFakeWaveSurfer() as any)
    return { plugin, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('falls back to the main thread by default, without emitting an error', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const promise = plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies[0].length).toBeGreaterThan(0)
    expect(errors).toHaveLength(0)
  })

  it('emits an error and skips the main-thread computation when disabled', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0, fallbackToMainThread: false })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const promise = plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
  })

  it('applies to worker timeouts as well', async () => {
    const { plugin } = createPlugin({ workerTimeout: 1, fallbackToMainThread: false })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const frequencies = await plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    expect(frequencies).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/timeout/i)
  })

  it('re-creates the worker on the next computation after a failure', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    worker.onerror(new Event('error'))
    await promise
    expect(plugin.__spectrogramInternalsForTests().worker).toBeNull()

    const workerCount = mockWorkerInstances.length
    const second = plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    expect(mockWorkerInstances.length).toBe(workerCount + 1)
    const newWorker = mockWorkerInstances[mockWorkerInstances.length - 1]
    expect(plugin.__spectrogramInternalsForTests().worker).toBe(newWorker)
    expect(newWorker.postMessage).toHaveBeenCalledTimes(1)
    newWorker.onerror(new Event('error'))
    await second
  })

  it('does not cache a failed computation', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0, fallbackToMainThread: false })
    const buffer = makeBuffer()
    plugin.wavesurfer = { getDecodedData: () => buffer, options: {} }

    const promise = plugin.getFrequenciesData()
    worker.onerror(new Event('error'))
    const frequencies = await promise

    expect(frequencies).toEqual([])
    expect(plugin.__spectrogramInternalsForTests().cachedFrequencies).toBeNull()
  })

  it('drawSpectrogram tolerates an empty result instead of throwing', () => {
    const { plugin } = createPlugin()
    expect(() => plugin.__spectrogramInternalsForTests().drawSpectrogram([])).not.toThrow()
  })
})

describe('WindowedSpectrogramPlugin fallbackToMainThread option', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options })
    plugin._init(createFakeWaveSurfer() as any)
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = makeBuffer()
    return { plugin, internals, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('falls back to the main thread by default', async () => {
    const { internals, worker } = createPlugin()
    const promise = internals.windowed.calculateFrequencies(0, 0.25)
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies[0].length).toBeGreaterThan(0)
  })

  it('emits an error and skips the main-thread computation when disabled', async () => {
    const { plugin, internals, worker } = createPlugin({ fallbackToMainThread: false })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const promise = internals.windowed.calculateFrequencies(0, 0.25)
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('re-creates the worker on the next computation after a failure', async () => {
    const { internals, worker } = createPlugin()
    const promise = internals.windowed.calculateFrequencies(0, 0.25)
    worker.onerror(new Event('error'))
    await promise
    expect(internals.worker).toBeNull()

    const workerCount = mockWorkerInstances.length
    const second = internals.windowed.calculateFrequencies(0, 0.25)
    expect(mockWorkerInstances.length).toBe(workerCount + 1)
    mockWorkerInstances[mockWorkerInstances.length - 1].onerror(new Event('error'))
    await second
  })
})

describe('failure-state hygiene (stale cache and construction latch)', () => {
  const fakeResult = [[new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]]

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

  function respondToLastRequest(worker: any, result: unknown) {
    const { id } = worker.postMessage.mock.calls[worker.postMessage.mock.calls.length - 1][0]
    worker.onmessage({ data: { type: 'frequenciesResult', id, result } })
  }

  it('invalidates the stale cache when a recomputation for a new buffer fails', async () => {
    const plugin: any = Spectrogram.create({
      useWebWorker: true,
      noverlap: 256,
      scale: 'linear',
      workerTimeout: 0,
      fallbackToMainThread: false,
    })
    plugin._init(createFakeWaveSurfer() as any)
    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]

    const bufferA = makeBuffer()
    plugin.wavesurfer = { getDecodedData: () => bufferA, options: {} }
    const first = plugin.getFrequenciesData()
    await tick() // let the async chain reach the worker dispatch
    respondToLastRequest(worker, fakeResult)
    await first
    expect(plugin.__spectrogramInternalsForTests().cachedFrequencies).toEqual(fakeResult)

    const bufferB = makeBuffer()
    plugin.wavesurfer = { getDecodedData: () => bufferB, options: {} }
    const second = plugin.getFrequenciesData()
    await tick()
    worker.onerror(new Event('error'))
    const frequencies = await second

    expect(frequencies).toEqual([])
    // Audio A's data must not survive to be drawn against audio B
    expect(plugin.__spectrogramInternalsForTests().cachedFrequencies).toBeNull()
    expect(plugin.__spectrogramInternalsForTests().cachedBuffer).toBeNull()
  })

  it('clears previously drawn canvases when asked to draw an empty result', () => {
    const plugin: any = Spectrogram.create({ useWebWorker: true, noverlap: 256 })
    plugin._init(createFakeWaveSurfer() as any)
    const canvas = document.createElement('canvas')
    plugin.__spectrogramInternalsForTests().canvasContainer.appendChild(canvas)
    plugin.__spectrogramInternalsForTests().canvases.push(canvas)
    plugin.__spectrogramInternalsForTests().drawnCanvases[0] = true

    plugin.__spectrogramInternalsForTests().drawSpectrogram([])

    expect(plugin.__spectrogramInternalsForTests().canvases).toHaveLength(0)
    expect(plugin.__spectrogramInternalsForTests().canvasContainer.contains(canvas)).toBe(false)
  })

  it.each([
    [
      'SpectrogramPlugin',
      Spectrogram,
      (plugin: any) => plugin._init(createFakeWaveSurfer() as any),
      (plugin: any) => plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer()),
    ],
    [
      'WindowedSpectrogramPlugin',
      WindowedSpectrogram,
      // calculateFrequencies() bails out (and never attempts worker construction) without a
      // buffer, so this row needs one; the SpectrogramPlugin row's compute() takes its own
      // buffer argument instead and has no such field to set.
      (plugin: any) => {
        plugin._init(createFakeWaveSurfer() as any)
        plugin.__spectrogramInternalsForTests().buffer = makeBuffer()
      },
      (plugin: any) => plugin.__spectrogramInternalsForTests().windowed.calculateFrequencies(0, 0.25),
    ],
  ])('%s stops retrying worker construction after it fails permanently', async (_name, Plugin: any, init, compute) => {
    mockWorkerState.constructorShouldThrow = true
    const plugin: any = Plugin.create({ useWebWorker: true, noverlap: 256, scale: 'linear' })
    init(plugin)
    expect(mockWorkerState.constructorAttempts).toBe(1)

    await compute(plugin)
    await compute(plugin)

    // Construction failed at creation time; computations must not retry it
    expect(mockWorkerState.constructorAttempts).toBe(1)
  })
})

describe('worker timeout disposal', () => {
  it('disposes the worker on timeout and re-creates it on the next computation', async () => {
    const plugin: any = Spectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', workerTimeout: 1 })
    plugin._init(createFakeWaveSurfer() as any)
    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]

    const promise = plugin.__spectrogramInternalsForTests().calculateFrequenciesWithWorker(makeBuffer())
    await expect(promise).rejects.toThrow(/timeout/i)
    // A timed-out result can never be consumed, so the worker itself is disposed
    expect(worker.terminate).toHaveBeenCalled()
    expect(plugin.__spectrogramInternalsForTests().worker).toBeNull()
    expect(plugin.__spectrogramInternalsForTests().workerPromises.size).toBe(0)

    const workerCount = mockWorkerInstances.length
    const second = plugin.__spectrogramInternalsForTests().getFrequencies(makeBuffer())
    expect(mockWorkerInstances.length).toBe(workerCount + 1)
    const newWorker = mockWorkerInstances[mockWorkerInstances.length - 1]
    expect(newWorker.postMessage).toHaveBeenCalledTimes(1)
    newWorker.onerror(new Event('error'))
    await second
  })

  it('windowed: disposes the worker on timeout and re-creates it on the next computation', async () => {
    jest.useFakeTimers()
    try {
      const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear' })
      plugin._init(createFakeWaveSurfer() as any)
      const internals = plugin.__spectrogramInternalsForTests()
      internals.buffer = makeBuffer()
      const worker = mockWorkerInstances[mockWorkerInstances.length - 1]

      // Default workerTimeout (30000ms) - now the same configurable option full mode uses
      // (Phase-1 windowed had this hard-coded; this unification removes that divergence).
      const promise = internals.windowed.calculateFrequenciesWithWorker(0, 0.25)
      promise.catch(() => undefined)
      jest.advanceTimersByTime(30000)
      await expect(promise).rejects.toThrow(/timeout/i)
      expect(worker.terminate).toHaveBeenCalled()
      expect(internals.worker).toBeNull()

      const workerCount = mockWorkerInstances.length
      const second = internals.windowed.calculateFrequencies(0, 0.25)
      expect(mockWorkerInstances.length).toBe(workerCount + 1)
      mockWorkerInstances[mockWorkerInstances.length - 1].onerror(new Event('error'))
      await second
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('drawSpectrogram zero-frame channels', () => {
  it('treats all-channels-empty as nothing to draw instead of crashing in resample', () => {
    const plugin: any = Spectrogram.create({ useWebWorker: true, noverlap: 256 })
    plugin._init(createFakeWaveSurfer() as any)
    // A real width so the pre-fix path reaches the resample crash rather than dying on a
    // missing wrapper (the intended red observable)
    plugin.wavesurfer = {
      getWrapper: () => ({ offsetWidth: 600, clientWidth: 600, scrollWidth: 600 }),
      options: {},
    }
    const canvas = document.createElement('canvas')
    plugin.__spectrogramInternalsForTests().canvasContainer.appendChild(canvas)
    plugin.__spectrogramInternalsForTests().canvases.push(canvas)

    // [[]] = channels exist but a too-short buffer produced zero FFT frames
    expect(() => plugin.__spectrogramInternalsForTests().drawSpectrogram([[]])).not.toThrow()
    expect(plugin.__spectrogramInternalsForTests().canvases).toHaveLength(0)
    expect(plugin.__spectrogramInternalsForTests().canvasContainer.contains(canvas)).toBe(false)
  })
})

describe('paintColumnPixels clamps out-of-range bin values', () => {
  // fillImageDataQuality (full-mode canvas path) and spectrogram-windowing.ts's
  // renderChannelToCanvas (windowed-mode canvas path) both delegate to this one shared helper,
  // so exercising it directly here covers both instead of fighting jsdom's lack of a real 2D
  // canvas context (getContext('2d') returns null without a canvas-mock package, so the
  // drawSpectrogram -> ... -> fillImageDataQuality DOM path never actually reaches pixel
  // painting in this test environment).
  it('does not throw indexing colorMap for a bin value outside [0, 255], and clamps to the nearest valid color', () => {
    // Every internally-computed segment's bin values come from a Uint8Array (already 0-255),
    // but loadFrequenciesData's externally-supplied JSON (frequenciesDataUrl) is only assumed,
    // never runtime-validated, to already be in range - see frequenciesDataUrl's own doc
    // comment. An out-of-range value must clamp to the nearest valid color instead of indexing
    // colorMap out of bounds and throwing on `color[0]` off `undefined`.
    const colorMap: number[][] = Array.from({ length: 256 }, (_, i) => [i / 255, 0, 0, 1])
    const data = new Uint8ClampedArray(4 * 5) // 1 column, 5 rows, RGBA
    const column = [300, -5, 128, 0, 255]

    expect(() => paintColumnPixels(data, column, colorMap, 0, 1, 5)).not.toThrow()

    // row 0 (value 300, clamps to 255 -> colorMap[255] = [1, 0, 0, 1]) lands at the BOTTOM
    // pixel row ((rowCount - row - 1) * columnCount + columnIndex) * 4 = (5-0-1)*1*4 = 16
    expect(data[16]).toBe(255)
    // row 1 (value -5, clamps to 0 -> colorMap[0] = [0, 0, 0, 1]) at pixelIndex (5-1-1)*4 = 12
    expect(data[12]).toBe(0)
  })
})
