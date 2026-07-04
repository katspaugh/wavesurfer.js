const mockWorkerInstances: any[] = []

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
