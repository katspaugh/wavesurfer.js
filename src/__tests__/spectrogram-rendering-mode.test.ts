// Pins the "merged-mode" contract: SpectrogramPlugin itself (not just the deprecated
// spectrogram-windowed.ts shim) can be driven directly with `rendering: 'windowed'`, and the
// worker-timeout unification (windowed mode now honors the same configurable workerTimeout
// option full mode does, instead of a hard-coded 30s).

import SpectrogramPlugin from '../plugins/spectrogram.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'
import { createFakeAudioBuffer } from './helpers/audio-buffer.js'
import { createEmitter } from './helpers/create-emitter.js'
import { mockWorkerInstances } from './helpers/spectrogram-worker-mock.js'

// See spectrogram-destroy.test.ts for the underlying _init() precedent: SpectrogramPlugin's
// Api (including __spectrogramInternalsForTests()) only exists on the instance once _init()
// has run.

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
    plugin._init(createFakeWaveSurfer())

    const internals = plugin.__spectrogramInternalsForTests()

    expect(internals.windowed).toBeDefined()
    expect(internals.windowed.segmentManager).toBeDefined()
    expect(typeof internals.windowed.calculateFrequencies).toBe('function')
    expect(typeof internals.windowed.calculateFrequenciesMainThread).toBe('function')
    expect(typeof internals.windowed.calculateFrequenciesWithWorker).toBe('function')
  })

  it('leaves __spectrogramInternalsForTests().windowed undefined by default (rendering omitted)', () => {
    const plugin: any = SpectrogramPlugin.create({})
    plugin._init(createFakeWaveSurfer())

    const internals = plugin.__spectrogramInternalsForTests()

    expect(internals.windowed).toBeUndefined()
  })

  it('also leaves windowed undefined for an explicit rendering: "full"', () => {
    const plugin: any = SpectrogramPlugin.create({ rendering: 'full' })
    plugin._init(createFakeWaveSurfer())

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
      plugin._init(createFakeWaveSurfer())
      const internals = plugin.__spectrogramInternalsForTests()
      internals.buffer = createFakeAudioBuffer(new Float32Array(8000))

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
    plugin._init(createFakeWaveSurfer())
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = createFakeAudioBuffer(new Float32Array(8000))

    const promise = internals.windowed.calculateFrequenciesWithWorker(0, 1)
    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { id } = worker.postMessage.mock.calls[0][0]
    const result = [[new Uint8Array([1, 2, 3])]]
    worker.onmessage({ data: { type: 'frequenciesResult', id, result } })

    await expect(promise).resolves.toEqual(result)
  })
})

describe('SpectrogramPlugin full-mode-only data APIs no-op in windowed mode', () => {
  // loadFrequenciesData/getFrequenciesData/clearCache all operate on the whole-buffer
  // cachedBuffer/cachedFrequencies state that full mode's render() populates and consults;
  // windowed mode has its own per-segment cache in segmentManager and never touches that state.
  // Calling these in windowed mode would fight the segment renderer (loadFrequenciesData in
  // particular would draw a whole-buffer result over/under the segment canvases). Deferred sweep
  // item from the Task-4 report: resolved as a warn-and-no-op rather than a throw, since this is
  // reachable from public API misuse, not a programming error inside this file.
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('loadFrequenciesData() warns and does not fetch or draw', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as any

    const plugin: any = SpectrogramPlugin.create({ rendering: 'windowed' })
    plugin._init(createFakeWaveSurfer())

    await expect(plugin.loadFrequenciesData('https://example.com/data.json')).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/loadFrequenciesData.*windowed/)
  })

  it('getFrequenciesData() warns and resolves null without touching the decoded buffer', async () => {
    const plugin: any = SpectrogramPlugin.create({ rendering: 'windowed' })
    plugin._init(createFakeWaveSurfer())

    await expect(plugin.getFrequenciesData()).resolves.toBeNull()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/getFrequenciesData.*windowed/)
  })

  it('clearCache() warns and is a no-op', () => {
    const plugin: any = SpectrogramPlugin.create({ rendering: 'windowed' })
    plugin._init(createFakeWaveSurfer())

    expect(() => plugin.clearCache()).not.toThrow()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/clearCache.*windowed/)
  })

  it('does NOT warn for these APIs in full mode', async () => {
    const plugin: any = SpectrogramPlugin.create({})
    plugin._init(createFakeWaveSurfer())

    plugin.clearCache()
    await plugin.getFrequenciesData() // getDecodedData() returns null -> resolves null, no warn

    expect(warnSpy).not.toHaveBeenCalled()
  })
})

/** A fake wavesurfer whose on()/emit() actually work, for tests that need to fire an event
 * (e.g. 'timeupdate') and observe the plugin's reaction, unlike createFakeWaveSurfer's
 * always-no-op `on: () => () => undefined`. */
function createEmitterWaveSurfer(overrides: Record<string, unknown> = {}) {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'offsetWidth', { value: 600, configurable: true })
  Object.defineProperty(wrapper, 'clientWidth', { value: 600, configurable: true })
  return {
    options: {},
    getWrapper: () => wrapper,
    getDecodedData: () => null,
    ...createEmitter(),
    ...overrides,
  }
}

describe('a rejected fire-and-forget render routes to the plugin error event', () => {
  // throttledRender's `void render()` and scheduleWindowedRender's `void
  // segmentManager?.renderVisibleWindow()` are both invoked from a timer callback with nothing
  // to await their promise - an uncaught rejection there is an unhandled promise rejection, not
  // a normal plugin error, unless the caller routes it to ctx.emit('error', ...) itself.

  it('full mode: a computeFrequencies failure during the initial render is emitted, not unhandled', async () => {
    jest.useFakeTimers()
    try {
      // getChannelData() throwing is a minimal, direct way to make getFrequencies() reject
      // without needing a genuinely malformed FFT input.
      const throwingBuffer = {
        sampleRate: 8000,
        length: 100,
        duration: 100 / 8000,
        numberOfChannels: 1,
        getChannelData: () => {
          throw new Error('getChannelData boom')
        },
      } as unknown as AudioBuffer

      const plugin: any = SpectrogramPlugin.create({})
      const errors: Error[] = []
      plugin.on('error', (error: Error) => errors.push(error))
      plugin._init(createFakeWaveSurfer({ getDecodedData: () => throwingBuffer }))

      // Initial-render-after-init (ctx.scope.timeout(() => throttledRender(), 0)) schedules
      // throttledRender, which (no cached frequencies yet) schedules render() another
      // renderThrottleMs (50ms) later.
      jest.advanceTimersByTime(0)
      jest.advanceTimersByTime(50)
      // Let the rejected getFrequencies()/render() promise chain actually settle.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('getChannelData boom')
    } finally {
      jest.useRealTimers()
    }
  })

  it('windowed mode: a rejected renderVisibleWindow is emitted, not unhandled', async () => {
    jest.useFakeTimers()
    try {
      const plugin: any = SpectrogramPlugin.create({ rendering: 'windowed' })
      const errors: Error[] = []
      plugin.on('error', (error: Error) => errors.push(error))
      const fakeWavesurfer = createEmitterWaveSurfer()
      plugin._init(fakeWavesurfer as any)

      const internals = plugin.__spectrogramInternalsForTests().windowed
      jest.spyOn(internals.segmentManager, 'renderVisibleWindow').mockRejectedValue(new Error('segment boom'))

      // scheduleWindowedRender's registered 'timeupdate' listener debounces via a 16ms timer.
      ;(fakeWavesurfer as any).emit('timeupdate')
      jest.advanceTimersByTime(16)
      await Promise.resolve()
      await Promise.resolve()

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('segment boom')
    } finally {
      jest.useRealTimers()
    }
  })
})

/** A sine-tone AudioBuffer at 8 kHz; `length` varied per buffer so different "files" produce
 * genuinely different frequency data (frame counts included). */
function makeToneBuffer(length: number, toneHz = 440): AudioBuffer {
  const data = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    data[i] = Math.sin((2 * Math.PI * toneHz * i) / 8000)
  }
  return createFakeAudioBuffer(data)
}

/** Settle the fire-and-forget render()/getFrequenciesData() promise chains under fake timers
 * (which stall real setTimeout-based waiting) without advancing any timer. */
async function flushMicrotasks(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve()
  }
}

describe('full mode invalidates cached render state when the decoded buffer changes', () => {
  // These tests drive drawSpectrogram over real canvases; jsdom's own getContext throws a noisy
  // "not implemented" virtual-console error before returning null, so stub it to return null
  // directly - the same value the code path handles (drawCanvas bails on a null context).
  let getContextSpy: jest.SpyInstance
  beforeEach(() => {
    getContextSpy = jest
      .spyOn(window.HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  })
  afterEach(() => {
    getContextSpy.mockRestore()
  })

  // Regression: after ws.load(fileB) at an unchanged zoom level, throttledRender saw zoomDiff
  // === 0 with cachedFrequencies still holding file A's data and took the fastRender() branch,
  // drawing file A's spectrogram against file B's audio forever (windowed mode already handled
  // this via startWindowedRender's segmentManager.reset(); full mode did not).
  it('falls through to a full re-render instead of fast-rendering the previous buffer at unchanged zoom', async () => {
    jest.useFakeTimers()
    try {
      const bufferA = makeToneBuffer(4096)
      const bufferB = makeToneBuffer(6144)
      let decoded: AudioBuffer | null = bufferA
      const fakeWavesurfer = createEmitterWaveSurfer({
        getDecodedData: () => decoded,
        options: { minPxPerSec: 100 },
      })

      const plugin: any = SpectrogramPlugin.create({ noverlap: 256, scale: 'linear' })
      plugin._init(fakeWavesurfer as any)
      const internals = plugin.__spectrogramInternalsForTests()

      // Initial render after init: the 0ms init timeout schedules throttledRender, which (no
      // cached frequencies yet) schedules the full render() another renderThrottleMs (50ms) out.
      jest.advanceTimersByTime(0)
      jest.advanceTimersByTime(50)
      await flushMicrotasks()
      expect(internals.cachedBuffer).toBe(bufferA)

      // "Load a new file": the decoded buffer changes, minPxPerSec (zoom) does not - so
      // zoomDiff is 0 and only the buffer-identity check can force the full render.
      decoded = bufferB
      ;(fakeWavesurfer as any).emit('redraw')
      jest.advanceTimersByTime(50)
      await flushMicrotasks()

      // Pre-fix this stayed bufferA: fastRender() drew file A's cachedFrequencies and never
      // recomputed for file B.
      expect(internals.cachedBuffer).toBe(bufferB)
    } finally {
      jest.useRealTimers()
    }
  })

  it('re-renders when the buffer changes while a render is already in flight (redraw not dropped)', async () => {
    jest.useFakeTimers()
    try {
      const bufferA = makeToneBuffer(4096)
      const bufferB = makeToneBuffer(6144)
      let decoded: AudioBuffer | null = bufferA
      const fakeWavesurfer = createEmitterWaveSurfer({
        getDecodedData: () => decoded,
        options: { minPxPerSec: 100 },
      })

      const plugin: any = SpectrogramPlugin.create({ noverlap: 256, scale: 'linear' })
      plugin._init(fakeWavesurfer as any)
      const internals = plugin.__spectrogramInternalsForTests()

      // Start the initial render but do NOT let its async frequency
      // computation resolve yet: isRendering is true.
      jest.advanceTimersByTime(0)
      jest.advanceTimersByTime(50)

      // File B decodes while file A's render is still in flight. Pre-fix,
      // throttledRender's isRendering early-return dropped this redraw and
      // nothing ever re-triggered rendering: the stale spectrogram stayed.
      decoded = bufferB
      ;(fakeWavesurfer as any).emit('redraw')

      // Let render A finish; its finally must queue the follow-up render.
      await flushMicrotasks()
      jest.advanceTimersByTime(50)
      await flushMicrotasks()

      expect(internals.cachedBuffer).toBe(bufferB)
    } finally {
      jest.useRealTimers()
    }
  })

  // Regression for the second leg of the same bug: even when the full render() path DID
  // recompute frequencies for the new buffer, drawSpectrogram reused cachedResampledData keyed
  // only on width - same container width, so file A's resampled columns were drawn anyway.
  it('drops the width-keyed resampled cache when frequencies are recomputed for a new buffer', async () => {
    const bufferA = makeToneBuffer(4096)
    const bufferB = makeToneBuffer(6144)
    let decoded: AudioBuffer | null = bufferA
    const plugin: any = SpectrogramPlugin.create({ noverlap: 256, scale: 'linear' })
    plugin._init(createFakeWaveSurfer({ getDecodedData: () => decoded }))
    const internals = plugin.__spectrogramInternalsForTests()

    const frequenciesA = await plugin.getFrequenciesData()
    internals.drawSpectrogram(frequenciesA)
    const staleResampled = internals.cachedResampledData
    // Sanity: the 600px-wide fake wrapper forces resampling (frame count !== 600), so the
    // width-keyed cache is actually populated before the buffer swap.
    expect(staleResampled).not.toBeNull()

    decoded = bufferB
    const frequenciesB = await plugin.getFrequenciesData()
    internals.drawSpectrogram(frequenciesB)

    // Pre-fix this was identical (`toBe`): cachedWidth still matched the container width, so
    // drawSpectrogram drew file A's cached resampled columns instead of resampling file B's
    // freshly computed frequencies.
    expect(internals.cachedResampledData).not.toBe(staleResampled)
    expect(internals.cachedBuffer).toBe(bufferB)
  })
})

describe('full mode frequenciesDataUrl rendering defaults frequencyMax to Nyquist', () => {
  // Regression: frequencyMax starts as `options.frequencyMax || 0` and was only defaulted to
  // Nyquist inside the audio-computed paths (getFrequencies/startWindowedRender). The
  // pre-computed data path (loadFrequenciesData -> drawSpectrogram) ran neither, so freqMax
  // stayed 0, the bitmap crop height rounded to zero, createImageBitmap rejected (silently),
  // and the spectrogram rendered blank unless the user also set frequencyMax explicitly.
  it('draws pre-computed data with a non-zero bitmap crop height instead of a blank spectrogram', async () => {
    const FRAMES = 4
    const BINS = 8
    // frequenciesDataUrl JSON: [channel][frame][bin] as plain arrays (JSON can't carry real
    // Uint8Arrays; drawSpectrogram's consumers only rely on indexing/length - see the
    // frequenciesDataUrl option's doc comment).
    const data = [
      Array.from({ length: FRAMES }, (_, frame) =>
        Array.from({ length: BINS }, (_, bin) => (frame * BINS + bin) % 256),
      ),
    ]

    const originalFetch = global.fetch
    const originalGetContext = window.HTMLCanvasElement.prototype.getContext
    const originalImageData = (globalThis as any).ImageData
    const originalCreateImageBitmap = (globalThis as any).createImageBitmap

    // jsdom has neither a real 2D context nor ImageData/createImageBitmap; stub just enough of
    // them for drawSpectrogram to reach its createImageBitmap crop call (the observable under
    // test) instead of bailing on a null context.
    const createImageBitmapMock = jest.fn(() => Promise.resolve({ close: jest.fn() }))
    try {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data }) as any
      window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        fillStyle: '',
        fillRect: jest.fn(),
        drawImage: jest.fn(),
      })) as any
      ;(globalThis as any).ImageData = class {
        data: Uint8ClampedArray
        constructor(
          public width: number,
          public height: number,
        ) {
          this.data = new Uint8ClampedArray(width * height * 4)
        }
      }
      ;(globalThis as any).createImageBitmap = createImageBitmapMock

      const plugin: any = SpectrogramPlugin.create({
        frequenciesDataUrl: 'https://example.com/frequencies.json',
        sampleRate: 8000,
        scale: 'linear',
      })
      plugin._init(createFakeWaveSurfer())

      await plugin.loadFrequenciesData('https://example.com/frequencies.json')

      // createImageBitmap(imageData, sx, sy, sw, sh): with frequencyMax left at 0 the crop
      // height (sh) was Math.round(bitmapHeight * (0 - 0)) === 0 - a zero-height source rect,
      // i.e. nothing to draw. Defaulted to Nyquist (options.sampleRate / 2), the crop covers
      // the full bin range.
      expect(createImageBitmapMock).toHaveBeenCalled()
      const cropHeight = (createImageBitmapMock.mock.calls[0] as unknown[])[4]
      expect(cropHeight).toBe(BINS)
    } finally {
      global.fetch = originalFetch
      window.HTMLCanvasElement.prototype.getContext = originalGetContext
      ;(globalThis as any).ImageData = originalImageData
      ;(globalThis as any).createImageBitmap = originalCreateImageBitmap
    }
  })
})

describe('windowed mode splitChannels fallback', () => {
  // Unified with full mode's own `options.splitChannels ?? ctx.wavesurfer.options.splitChannels`
  // form: when the plugin itself doesn't set splitChannels, windowed mode now falls back to the
  // wavesurfer instance's splitChannels option instead of always treating it as false.
  it('honors ctx.wavesurfer.options.splitChannels when the plugin option is unset', async () => {
    const plugin: any = SpectrogramPlugin.create({ rendering: 'windowed' })
    plugin._init(createFakeWaveSurfer({ options: { splitChannels: true } }))
    const internals = plugin.__spectrogramInternalsForTests()
    internals.buffer = {
      sampleRate: 8000,
      duration: 1,
      numberOfChannels: 2,
      getChannelData: () => new Float32Array(8000),
    }

    const frequencies = await internals.windowed.calculateFrequenciesMainThread(0, 0.5)

    expect(frequencies.length).toBe(2)
  })
})
