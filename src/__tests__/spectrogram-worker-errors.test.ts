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
    const plugin = Spectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options })
    return { plugin: plugin as any, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('rejects the in-flight promise when the worker errors, even with workerTimeout: 0', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.calculateFrequenciesWithWorker(makeBuffer())
    promise.catch(() => undefined)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.onerror(new Event('error'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(plugin.workerPromises.size).toBe(0)
    expect(worker.terminate).toHaveBeenCalled()
    expect(plugin.worker).toBeNull()
  })

  it('clears the timeout timer when the worker errors', async () => {
    const { plugin, worker } = createPlugin()
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout')
    const promise = plugin.calculateFrequenciesWithWorker(makeBuffer())

    worker.onerror(new Event('error'))

    await expect(promise).rejects.toThrow('Worker error')
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('rejects the in-flight promise on a message deserialization error', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.calculateFrequenciesWithWorker(makeBuffer())
    promise.catch(() => undefined)

    worker.onmessageerror(new Event('messageerror'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(plugin.workerPromises.size).toBe(0)
    expect(plugin.worker).toBeNull()
  })

  it('falls back to the main thread immediately after a worker error', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.getFrequencies(makeBuffer())
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies.length).toBe(1)
    expect(frequencies[0].length).toBeGreaterThan(0)
    expect(frequencies[0][0]).toBeInstanceOf(Uint8Array)
  })

  it('rejects pending promises on destroy', async () => {
    const { plugin } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.calculateFrequenciesWithWorker(makeBuffer())
    promise.catch(() => undefined)

    plugin.destroy()

    await expect(promise).rejects.toThrow('Spectrogram plugin destroyed')
    expect(plugin.workerPromises.size).toBe(0)
  })
})

describe('WindowedSpectrogramPlugin worker error handling', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options })
    ;(plugin as any).buffer = makeBuffer()
    return { plugin: plugin as any, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('rejects the in-flight promise when the worker errors instead of waiting out the timeout', async () => {
    const { plugin, worker } = createPlugin()
    const promise = plugin.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    worker.onerror(new Event('error'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(plugin.workerPromises.size).toBe(0)
    expect(worker.terminate).toHaveBeenCalled()
    expect(plugin.worker).toBeNull()
  })

  it('rejects the in-flight promise on a message deserialization error', async () => {
    const { plugin, worker } = createPlugin()
    const promise = plugin.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)

    worker.onmessageerror(new Event('messageerror'))

    expect(await settledWithin(promise, 200)).toBe('rejected')
    expect(plugin.workerPromises.size).toBe(0)
    expect(plugin.worker).toBeNull()
  })

  it('cleans up the pending request when postMessage throws synchronously', async () => {
    const { plugin, worker } = createPlugin()
    worker.postMessage.mockImplementation(() => {
      throw new Error('DataCloneError')
    })

    const promise = plugin.calculateFrequenciesWithWorker(0, 0.25)

    await expect(promise).rejects.toThrow('DataCloneError')
    expect(plugin.workerPromises.size).toBe(0)
  })

  it('clears the timeout timer when a result arrives', async () => {
    const { plugin, worker } = createPlugin()
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout')
    const promise = plugin.calculateFrequenciesWithWorker(0, 0.25)
    const { id } = worker.postMessage.mock.calls[0][0]
    const result = [[new Uint8Array([1, 2, 3])]]

    worker.onmessage({ data: { type: 'frequenciesResult', id, result } })

    await expect(promise).resolves.toEqual(result)
    expect(plugin.workerPromises.size).toBe(0)
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('rejects pending promises on destroy', async () => {
    const { plugin } = createPlugin()
    const promise = plugin.calculateFrequenciesWithWorker(0, 0.25)
    promise.catch(() => undefined)

    plugin.destroy()

    await expect(promise).rejects.toThrow('Plugin destroyed')
    expect(plugin.workerPromises.size).toBe(0)
  })
})

describe('SpectrogramPlugin fallbackToMainThread option', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin = Spectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options })
    return { plugin: plugin as any, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('falls back to the main thread by default, without emitting an error', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const promise = plugin.getFrequencies(makeBuffer())
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies[0].length).toBeGreaterThan(0)
    expect(errors).toHaveLength(0)
  })

  it('emits an error and skips the main-thread computation when disabled', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0, fallbackToMainThread: false })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const promise = plugin.getFrequencies(makeBuffer())
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

    const frequencies = await plugin.getFrequencies(makeBuffer())
    expect(frequencies).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/timeout/i)
  })

  it('re-creates the worker on the next computation after a failure', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0 })
    const promise = plugin.getFrequencies(makeBuffer())
    worker.onerror(new Event('error'))
    await promise
    expect(plugin.worker).toBeNull()

    const workerCount = mockWorkerInstances.length
    const second = plugin.getFrequencies(makeBuffer())
    expect(mockWorkerInstances.length).toBe(workerCount + 1)
    const newWorker = mockWorkerInstances[mockWorkerInstances.length - 1]
    expect(plugin.worker).toBe(newWorker)
    expect(newWorker.postMessage).toHaveBeenCalledTimes(1)
    newWorker.onerror(new Event('error'))
    await second
  })

  it('does not cache a failed computation', async () => {
    const { plugin, worker } = createPlugin({ workerTimeout: 0, fallbackToMainThread: false })
    const buffer = makeBuffer()
    plugin.wavesurfer = { getDecodedData: () => buffer }

    const promise = plugin.getFrequenciesData()
    worker.onerror(new Event('error'))
    const frequencies = await promise

    expect(frequencies).toEqual([])
    expect(plugin.cachedFrequencies).toBeNull()
  })

  it('drawSpectrogram tolerates an empty result instead of throwing', () => {
    const { plugin } = createPlugin()
    expect(() => plugin.drawSpectrogram([])).not.toThrow()
  })
})

describe('WindowedSpectrogramPlugin fallbackToMainThread option', () => {
  function createPlugin(options: Record<string, unknown> = {}) {
    const plugin: any = WindowedSpectrogram.create({ useWebWorker: true, noverlap: 256, scale: 'linear', ...options })
    plugin.buffer = makeBuffer()
    return { plugin, worker: mockWorkerInstances[mockWorkerInstances.length - 1] }
  }

  it('falls back to the main thread by default', async () => {
    const { plugin, worker } = createPlugin()
    const promise = plugin.calculateFrequencies(0, 0.25)
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies[0].length).toBeGreaterThan(0)
  })

  it('emits an error and skips the main-thread computation when disabled', async () => {
    const { plugin, worker } = createPlugin({ fallbackToMainThread: false })
    const errors: Error[] = []
    plugin.on('error', (error: Error) => errors.push(error))

    const promise = plugin.calculateFrequencies(0, 0.25)
    worker.onerror(new Event('error'))

    const frequencies = await promise
    expect(frequencies).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('re-creates the worker on the next computation after a failure', async () => {
    const { plugin, worker } = createPlugin()
    const promise = plugin.calculateFrequencies(0, 0.25)
    worker.onerror(new Event('error'))
    await promise
    expect(plugin.worker).toBeNull()

    const workerCount = mockWorkerInstances.length
    const second = plugin.calculateFrequencies(0, 0.25)
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
    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]

    const bufferA = makeBuffer()
    plugin.wavesurfer = { getDecodedData: () => bufferA, options: {} }
    const first = plugin.getFrequenciesData()
    await tick() // let the async chain reach the worker dispatch
    respondToLastRequest(worker, fakeResult)
    await first
    expect(plugin.cachedFrequencies).toEqual(fakeResult)

    const bufferB = makeBuffer()
    plugin.wavesurfer = { getDecodedData: () => bufferB, options: {} }
    const second = plugin.getFrequenciesData()
    await tick()
    worker.onerror(new Event('error'))
    const frequencies = await second

    expect(frequencies).toEqual([])
    // Audio A's data must not survive to be drawn against audio B
    expect(plugin.cachedFrequencies).toBeNull()
    expect(plugin.cachedBuffer).toBeNull()
  })

  it('clears previously drawn canvases when asked to draw an empty result', () => {
    const plugin: any = Spectrogram.create({ useWebWorker: true, noverlap: 256 })
    const canvas = document.createElement('canvas')
    plugin.canvasContainer.appendChild(canvas)
    plugin.canvases.push(canvas)
    plugin.drawnCanvases[0] = true

    plugin.drawSpectrogram([])

    expect(plugin.canvases).toHaveLength(0)
    expect(plugin.canvasContainer.contains(canvas)).toBe(false)
  })

  it.each([
    ['SpectrogramPlugin', Spectrogram, (plugin: any) => plugin.getFrequencies(makeBuffer())],
    ['WindowedSpectrogramPlugin', WindowedSpectrogram, (plugin: any) => plugin.calculateFrequencies(0, 0.25)],
  ])('%s stops retrying worker construction after it fails permanently', async (_name, Plugin: any, compute) => {
    mockWorkerState.constructorShouldThrow = true
    const plugin: any = Plugin.create({ useWebWorker: true, noverlap: 256, scale: 'linear' })
    plugin.buffer = makeBuffer()
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
    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]

    const promise = plugin.calculateFrequenciesWithWorker(makeBuffer())
    await expect(promise).rejects.toThrow(/timeout/i)
    // A timed-out result can never be consumed, so the worker itself is disposed
    expect(worker.terminate).toHaveBeenCalled()
    expect(plugin.worker).toBeNull()
    expect(plugin.workerPromises.size).toBe(0)

    const workerCount = mockWorkerInstances.length
    const second = plugin.getFrequencies(makeBuffer())
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
      plugin.buffer = makeBuffer()
      const worker = mockWorkerInstances[mockWorkerInstances.length - 1]

      const promise = plugin.calculateFrequenciesWithWorker(0, 0.25)
      promise.catch(() => undefined)
      jest.advanceTimersByTime(30000)
      await expect(promise).rejects.toThrow(/timeout/i)
      expect(worker.terminate).toHaveBeenCalled()
      expect(plugin.worker).toBeNull()

      const workerCount = mockWorkerInstances.length
      const second = plugin.calculateFrequencies(0, 0.25)
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
    // A real width so the pre-fix path reaches the resample crash rather than dying on a
    // missing wrapper (the intended red observable)
    plugin.wavesurfer = {
      getWrapper: () => ({ offsetWidth: 600, clientWidth: 600, scrollWidth: 600 }),
      options: {},
    }
    const canvas = document.createElement('canvas')
    plugin.canvasContainer.appendChild(canvas)
    plugin.canvases.push(canvas)

    // [[]] = channels exist but a too-short buffer produced zero FFT frames
    expect(() => plugin.drawSpectrogram([[]])).not.toThrow()
    expect(plugin.canvases).toHaveLength(0)
    expect(plugin.canvasContainer.contains(canvas)).toBe(false)
  })
})
