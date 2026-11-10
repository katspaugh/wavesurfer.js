import { createSpectrogramWorkerClient, type SpectrogramWorkerClientDeps } from '../spectrogram-worker-client.js'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessageerror: ((e: unknown) => void) | null = null
  postMessage = jest.fn()
  terminate = jest.fn()
  constructor() {
    FakeWorker.instances.push(this)
  }
}

class ThrowingWorker {
  constructor() {
    throw new Error('blocked by CSP')
  }
}

type Timer = { callback: () => void; ms: number; cancel: jest.Mock }

function createClient(overrides: Partial<SpectrogramWorkerClientDeps> = {}) {
  const timers: Timer[] = []
  let timeout = 1000
  const deps: SpectrogramWorkerClientDeps = {
    WorkerCtor: FakeWorker as unknown as new () => Worker,
    getTimeout: () => timeout,
    setTimer: (callback, ms) => {
      const cancel = jest.fn()
      timers.push({ callback, ms, cancel })
      return cancel
    },
    ...overrides,
  }
  const client = createSpectrogramWorkerClient(deps)
  return {
    client,
    timers,
    setTimeoutMs: (ms: number) => {
      timeout = ms
    },
    fake: () => client.worker as unknown as FakeWorker,
  }
}

const reply = (worker: FakeWorker, data: Record<string, unknown>) => worker.onmessage?.({ data })
const audio = [new Float32Array([0, 1])]

describe('createSpectrogramWorkerClient', () => {
  const originalWorker = (globalThis as any).Worker

  beforeAll(() => {
    // jsdom has no Worker; initialize() only checks that the global exists
    ;(globalThis as any).Worker = function Worker() {}
  })

  afterAll(() => {
    ;(globalThis as any).Worker = originalWorker
  })

  beforeEach(() => {
    FakeWorker.instances = []
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('initialize', () => {
    it('starts without a worker and creates one from the injected constructor', () => {
      const { client } = createClient()
      expect(client.worker).toBeNull()
      expect(client.pending.size).toBe(0)
      client.initialize()
      expect(client.worker).toBe(FakeWorker.instances[0])
      expect(client.constructionFailed).toBe(false)
    })

    it('warns and creates nothing without a worker constructor, without latching a failure', () => {
      const { client } = createClient({ WorkerCtor: undefined })
      client.initialize()
      expect(client.worker).toBeNull()
      expect(client.constructionFailed).toBe(false)
      expect(console.warn).toHaveBeenCalledWith(
        'Worker not available in this environment, using main thread calculation',
      )
    })

    it('warns and creates nothing when the environment has no Worker global', () => {
      const saved = (globalThis as any).Worker
      delete (globalThis as any).Worker
      try {
        const { client } = createClient()
        client.initialize()
        expect(client.worker).toBeNull()
        expect(FakeWorker.instances).toHaveLength(0)
        expect(client.constructionFailed).toBe(false)
      } finally {
        ;(globalThis as any).Worker = saved
      }
    })

    it('latches a constructor failure as permanent', () => {
      const { client } = createClient({ WorkerCtor: ThrowingWorker as unknown as new () => Worker })
      client.initialize()
      expect(client.worker).toBeNull()
      expect(client.constructionFailed).toBe(true)
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to initialize worker, falling back to main thread:',
        expect.any(Error),
      )
    })
  })

  describe('post', () => {
    it('throws synchronously without a worker', () => {
      const { client } = createClient()
      expect(() => client.post(audio, {})).toThrow('Worker not available')
    })

    it('posts a calculateFrequencies message and resolves with the matching result', async () => {
      const { client, fake, timers } = createClient()
      client.initialize()
      const options = { fftSamples: 512 }
      const promise = client.post(audio, options)

      const message = fake().postMessage.mock.calls[0][0]
      expect(message).toEqual({ type: 'calculateFrequencies', id: expect.any(String), audioData: audio, options })
      expect(client.pending.size).toBe(1)

      const result = [[new Uint8Array([1, 2])]]
      reply(fake(), { type: 'frequenciesResult', id: message.id, result })
      await expect(promise).resolves.toBe(result)
      expect(client.pending.size).toBe(0)
      expect(timers[0].cancel).toHaveBeenCalled()
    })

    it('rejects with the error the worker reports', async () => {
      const { client, fake } = createClient()
      client.initialize()
      const promise = client.post(audio, {})
      const { id } = fake().postMessage.mock.calls[0][0]
      reply(fake(), { type: 'frequenciesResult', id, error: 'out of memory' })
      await expect(promise).rejects.toThrow('out of memory')
      expect(client.pending.size).toBe(0)
    })

    it('matches concurrent replies to their own requests by id, in any order', async () => {
      const { client, fake } = createClient()
      client.initialize()
      const first = client.post(audio, {})
      const second = client.post(audio, {})
      const [firstId, secondId] = fake().postMessage.mock.calls.map((call) => call[0].id)
      expect(firstId).not.toBe(secondId)

      const a = [[new Uint8Array([1])]]
      const b = [[new Uint8Array([2])]]
      reply(fake(), { type: 'frequenciesResult', id: secondId, result: b })
      reply(fake(), { type: 'frequenciesResult', id: firstId, result: a })
      await expect(first).resolves.toBe(a)
      await expect(second).resolves.toBe(b)
    })

    it('ignores replies of another type or for an unknown id', () => {
      const { client, fake } = createClient()
      client.initialize()
      void client.post(audio, {})
      const { id } = fake().postMessage.mock.calls[0][0]
      reply(fake(), { type: 'progress', id, result: [] })
      reply(fake(), { type: 'frequenciesResult', id: 'unknown', result: [] })
      expect(client.pending.size).toBe(1)
    })

    it('reads the timeout on every request, and 0 disables it', () => {
      const { client, timers, setTimeoutMs } = createClient()
      client.initialize()
      void client.post(audio, {})
      setTimeoutMs(0)
      void client.post(audio, {})
      setTimeoutMs(250)
      void client.post(audio, {})
      expect(timers.map((timer) => timer.ms)).toEqual([1000, 250])
      expect(client.pending.size).toBe(3)
    })

    it('disposes the worker and rejects every pending request when a request times out', async () => {
      const { client, fake, timers } = createClient()
      client.initialize()
      const worker = fake()
      const first = client.post(audio, {})
      const second = client.post(audio, {})
      timers[0].callback()
      await expect(first).rejects.toThrow('Worker timeout')
      await expect(second).rejects.toThrow('Worker timeout')
      expect(worker.terminate).toHaveBeenCalledTimes(1)
      expect(client.worker).toBeNull()
      expect(client.pending.size).toBe(0)
    })

    it('does nothing when a timeout fires for a request that already settled', async () => {
      const { client, fake, timers } = createClient()
      client.initialize()
      const worker = fake()
      const promise = client.post(audio, {})
      const { id } = worker.postMessage.mock.calls[0][0]
      reply(worker, { type: 'frequenciesResult', id, result: [] })
      await promise
      timers[0].callback()
      expect(worker.terminate).not.toHaveBeenCalled()
      expect(client.worker).toBe(worker)
    })

    it('rejects and forgets a request whose postMessage throws, cancelling its timer', async () => {
      const { client, fake, timers } = createClient()
      client.initialize()
      const cloneError = new Error('could not be cloned')
      fake().postMessage.mockImplementation(() => {
        throw cloneError
      })
      await expect(client.post(audio, {})).rejects.toBe(cloneError)
      expect(client.pending.size).toBe(0)
      expect(timers[0].cancel).toHaveBeenCalled()
      // The worker itself is kept
      expect(client.worker).not.toBeNull()
    })
  })

  describe('worker failures and dispose', () => {
    it.each([
      ['onerror', 'Worker error'],
      ['onmessageerror', 'Worker message error'],
    ] as const)('%s disposes the worker and rejects pending requests', async (handler, message) => {
      const { client, fake, timers } = createClient()
      client.initialize()
      const worker = fake()
      const promise = client.post(audio, {})
      worker[handler]?.(new Event('error'))
      await expect(promise).rejects.toThrow(message)
      expect(worker.terminate).toHaveBeenCalled()
      expect(timers[0].cancel).toHaveBeenCalled()
      expect(client.worker).toBeNull()
      expect(client.pending.size).toBe(0)
      // A runtime failure is not latched: a new worker can be created
      expect(client.constructionFailed).toBe(false)
      client.initialize()
      expect(client.worker).toBe(FakeWorker.instances[1])
    })

    it('dispose terminates the worker, cancels timers and rejects with the given error', async () => {
      const { client, fake, timers } = createClient()
      client.initialize()
      const worker = fake()
      const promise = client.post(audio, {})
      const error = new Error('destroyed')
      client.dispose(error)
      await expect(promise).rejects.toBe(error)
      expect(worker.terminate).toHaveBeenCalledTimes(1)
      expect(timers[0].cancel).toHaveBeenCalled()
      expect(client.worker).toBeNull()
      expect(client.pending.size).toBe(0)
    })

    it('dispose is safe without a worker and when called twice', () => {
      const { client } = createClient()
      expect(() => client.dispose(new Error('a'))).not.toThrow()
      client.initialize()
      const worker = client.worker as unknown as FakeWorker
      client.dispose(new Error('b'))
      client.dispose(new Error('c'))
      expect(worker.terminate).toHaveBeenCalledTimes(1)
    })

    it('keeps the same pending map instance across dispose', () => {
      const { client } = createClient()
      const pending = client.pending
      client.initialize()
      void client.post(audio, {}).catch(() => undefined)
      client.dispose(new Error('x'))
      expect(client.pending).toBe(pending)
    })
  })
})
