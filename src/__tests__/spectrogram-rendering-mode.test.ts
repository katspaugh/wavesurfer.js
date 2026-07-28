// Pins the brief-mandated "merged-mode" contract for Phase 4 Task 3: SpectrogramPlugin itself
// (not just the deprecated spectrogram-windowed.ts shim) can be driven directly with
// `rendering: 'windowed'`, and the worker-timeout unification (windowed mode now honors the
// same configurable workerTimeout option full mode does, instead of Phase 1's hard-coded 30s).

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

import SpectrogramPlugin from '../plugins/spectrogram.js'

// See spectrogram-destroy.test.ts for the underlying _init() precedent: SpectrogramPlugin's
// Api (including __spectrogramInternalsForTests()) only exists on the instance once _init()
// has run.
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

beforeAll(() => {
  // jsdom has no Worker; the plugin only checks its existence before using the bundled constructor
  ;(globalThis as any).Worker = function Worker() {}
})

beforeEach(() => {
  mockWorkerInstances.length = 0
})

describe('SpectrogramPlugin rendering mode dispatch', () => {
  it('populates __spectrogramInternalsForTests().windowed when rendering: "windowed"', () => {
    const plugin: any = SpectrogramPlugin.create({ rendering: 'windowed' })
    plugin._init(createFakeWaveSurfer() as any)

    const internals = plugin.__spectrogramInternalsForTests()

    expect(internals.windowed).toBeDefined()
    expect(internals.windowed.segmentManager).toBeDefined()
    expect(typeof internals.windowed.calculateFrequencies).toBe('function')
    expect(typeof internals.windowed.calculateFrequenciesMainThread).toBe('function')
    expect(typeof internals.windowed.calculateFrequenciesWithWorker).toBe('function')
  })

  it('leaves __spectrogramInternalsForTests().windowed undefined by default (rendering omitted)', () => {
    const plugin: any = SpectrogramPlugin.create({})
    plugin._init(createFakeWaveSurfer() as any)

    const internals = plugin.__spectrogramInternalsForTests()

    expect(internals.windowed).toBeUndefined()
  })

  it('also leaves windowed undefined for an explicit rendering: "full"', () => {
    const plugin: any = SpectrogramPlugin.create({ rendering: 'full' })
    plugin._init(createFakeWaveSurfer() as any)

    expect(plugin.__spectrogramInternalsForTests().windowed).toBeUndefined()
  })
})

describe('SpectrogramPlugin windowed mode honors a configurable workerTimeout', () => {
  it('does not time out before the configured duration, and does after it', async () => {
    jest.useFakeTimers()
    try {
      // A distinctive, non-default value: proves the CONFIGURED number is actually used, not
      // just that some timeout eventually fires (which the old 30000-hard-coded windowed
      // plugin would also do, defeating the point of this test).
      const WORKER_TIMEOUT_MS = 12345

      const plugin: any = SpectrogramPlugin.create({
        rendering: 'windowed',
        useWebWorker: true,
        workerTimeout: WORKER_TIMEOUT_MS,
      })
      plugin._init(createFakeWaveSurfer() as any)
      const internals = plugin.__spectrogramInternalsForTests()
      internals.buffer = {
        sampleRate: 8000,
        duration: 1,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(8000),
      }

      const promise = internals.windowed.calculateFrequenciesWithWorker(0, 1)
      promise.catch(() => undefined)

      jest.advanceTimersByTime(WORKER_TIMEOUT_MS - 1)
      // Still pending: give the microtask queue a chance to settle without letting fake timers
      // advance further.
      await Promise.resolve()
      let settled = false
      promise.then(
        () => (settled = true),
        () => (settled = true),
      )
      await Promise.resolve()
      expect(settled).toBe(false)

      jest.advanceTimersByTime(1)
      await expect(promise).rejects.toThrow(/timeout/i)

      const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
      expect(worker.terminate).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('workerTimeout: 0 disables the timeout in windowed mode too', async () => {
    const plugin: any = SpectrogramPlugin.create({
      rendering: 'windowed',
      useWebWorker: true,
      workerTimeout: 0,
    })
    plugin._init(createFakeWaveSurfer() as any)
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = {
      sampleRate: 8000,
      duration: 1,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(8000),
    }

    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 1)
    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { id } = worker.postMessage.mock.calls[0][0]
    const result = [[new Uint8Array([1, 2, 3])]]
    worker.onmessage({ data: { type: 'frequenciesResult', id, result } })

    await expect(promise).resolves.toEqual(result)
  })
})
