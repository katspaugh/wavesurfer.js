import RecordPlugin from '../plugins/record.js'
import WaveSurfer from '../wavesurfer.js'
import { installMatchMediaStub } from './helpers/match-media.js'

describe('RecordPlugin teardown', () => {
  it('emits record-end BEFORE listeners are cleared on destroy', async () => {
    // An active recorder whose stop() runs the onstop handler synchronously,
    // so the 'record-end' it emits happens inside destroy() itself.
    class SyncStopMediaRecorder extends MockMediaRecorder {
      stop() {
        this.state = 'inactive'
        this.onstop?.()
      }
    }
    const restoreMocks = installRecordingMocks(SyncStopMediaRecorder)
    try {
      const plugin = RecordPlugin.create()
      const onEnd = jest.fn()
      plugin.on('record-end', onEnd)
      await plugin.startRecording()

      plugin.destroy()

      expect(onEnd).toHaveBeenCalledTimes(1)
    } finally {
      restoreMocks()
    }
  })

  it('record-progress works after destroy + re-init', () => {
    const plugin = RecordPlugin.create()
    plugin.destroy()
    plugin._init({} as never)

    const internals = plugin.__recordInternalsForTests()
    const onProgress = jest.fn()
    plugin.on('record-progress', onProgress)

    // _init() above set up a fresh lifecycle, with a frame scheduler bound to
    // the fresh post-destroy scope; start()'s synchronous first tick reaches
    // the plugin's tick handler and emits 'record-progress'.
    internals.frameScheduler.start(internals.tick)

    expect(onProgress).toHaveBeenCalled()
  })

  it('stops the frame scheduler on plugin destroy', () => {
    const plugin = RecordPlugin.create()
    const { frameScheduler } = plugin.__recordInternalsForTests()
    frameScheduler.start(jest.fn())
    expect(frameScheduler.running).toBe(true)

    plugin.destroy()

    expect(frameScheduler.running).toBe(false)
  })

  it('destroy is idempotent', () => {
    const plugin = RecordPlugin.create()
    expect(() => {
      plugin.destroy()
      plugin.destroy()
    }).not.toThrow()
  })
})

// A minimal, spec-shaped MediaRecorder mock: `stop()` transitions state to 'inactive'
// synchronously but fires 'onstop' asynchronously via a queued microtask, matching
// real MediaRecorder semantics (and the bug: destroy() completes, including
// super.destroy()'s unAll(), before 'onstop' ever runs).
class MockMediaRecorder {
  static isTypeSupported = () => true
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onpause: (() => void) | null = null
  onstop: (() => void) | null = null

  constructor(_stream: MediaStream, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? 'audio/webm'
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    queueMicrotask(() => this.onstop?.())
  }

  pause() {
    this.state = 'paused'
  }

  resume() {
    this.state = 'recording'
  }

  requestData() {
    // no-op
  }
}

class MockAudioContext {
  createMediaStreamSource() {
    return { connect: jest.fn(), disconnect: jest.fn() }
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getFloatTimeDomainData: jest.fn(),
    }
  }
  close() {
    return Promise.resolve()
  }
}

// Event-capable track mock: real MediaStreamTracks are EventTargets that fire
// 'ended' when the capture device disappears (but NOT on our own stop() calls).
class MockMediaStreamTrack {
  stop = jest.fn()
  addEventListener = jest.fn((type: string, listener: () => void) => {
    if (type === 'ended') this.endedListeners.add(listener)
  })
  removeEventListener = jest.fn((type: string, listener: () => void) => {
    if (type === 'ended') this.endedListeners.delete(listener)
  })
  private endedListeners = new Set<() => void>()

  /** Simulate the device disappearing (dispatches 'ended' to listeners) */
  end() {
    this.endedListeners.forEach((listener) => listener())
  }

  get hasEndedListeners() {
    return this.endedListeners.size > 0
  }
}

function createFakeMicStream(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]): MediaStream {
  return {
    getTracks: () => tracks,
  } as unknown as MediaStream
}

/** Install the browser recording APIs as mocks; returns a function that restores the originals */
function installRecordingMocks(Recorder: typeof MockMediaRecorder = MockMediaRecorder) {
  const originalAudioContext = global.AudioContext
  const originalMediaRecorder = global.MediaRecorder
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  global.AudioContext = MockAudioContext as unknown as typeof AudioContext
  global.MediaRecorder = Recorder as unknown as typeof MediaRecorder
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: { getUserMedia: jest.fn().mockResolvedValue(createFakeMicStream()) },
  })
  URL.createObjectURL = jest.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = jest.fn()
  return () => {
    global.AudioContext = originalAudioContext
    global.MediaRecorder = originalMediaRecorder
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    } else {
      delete (navigator as unknown as Record<string, unknown>).mediaDevices
    }
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
}

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('RecordPlugin destroy-time record-end delivery (realistic async onstop)', () => {
  const originalAudioContext = global.AudioContext
  const originalMediaRecorder = global.MediaRecorder
  const originalMediaDevices = navigator.mediaDevices
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    global.AudioContext = MockAudioContext as unknown as typeof AudioContext
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(createFakeMicStream()) },
    })
    // jsdom doesn't implement the Blob URL registry
    URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    global.AudioContext = originalAudioContext
    global.MediaRecorder = originalMediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: originalMediaDevices,
    })
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('delivers the final record-end blob to listeners even though onstop fires after destroy() returns', async () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    plugin.on('record-end', onEnd)

    await plugin.startRecording()
    plugin.destroy()

    // The real MediaRecorder mock's 'onstop' hasn't run yet at this point —
    // it's a queued microtask, exactly like the browser.
    expect(onEnd).not.toHaveBeenCalled()

    await flushMicrotasks()

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd.mock.calls[0][0]).toBeInstanceOf(Blob)

    // renderRecordedAudio defaults to true, so without the post-destroy guard
    // this post-destroy onstop would call createObjectURL() again for a blob
    // URL that destroy()'s own revocation pass (which already ran) would
    // never revoke -- a leak. destroy() itself revoked once synchronously;
    // the guard must prevent any further calls from this async onstop.
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('does not double-deliver record-end on a normal (non-destroy) stop', async () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    plugin.on('record-end', onEnd)

    await plugin.startRecording()
    plugin.stopRecording()
    await flushMicrotasks()

    expect(onEnd).toHaveBeenCalledTimes(1)

    // Destroying afterwards (recorder already inactive) must not re-deliver.
    plugin.destroy()
    await flushMicrotasks()

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('restarting while recording discards the old session without a spurious record-end or foreign chunks', async () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    const onStart = jest.fn()
    plugin.on('record-end', onEnd)
    plugin.on('record-start', onStart)

    await plugin.startRecording()
    const recorderOf = () => plugin.__recordInternalsForTests().mediaRecorder as unknown as MockMediaRecorder
    const firstRecorder = recorderOf()
    // The first session produces a chunk
    firstRecorder.ondataavailable?.({ data: new Blob(['old-session-chunk']) })

    // Restart: the old recorder's queued 'stop' must not dispatch into the
    // new session's handlers (spurious record-end right after record-start)
    await plugin.startRecording()
    await flushMicrotasks()

    expect(onStart).toHaveBeenCalledTimes(2)
    expect(onEnd).not.toHaveBeenCalled()
    expect(recorderOf()).not.toBe(firstRecorder)

    // The new session's final blob must not contain the old session's chunk
    plugin.stopRecording()
    await flushMicrotasks()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect((onEnd.mock.calls[0][0] as Blob).size).toBe(0)
  })

  it('stopMic restores the hijacked wavesurfer options after a preview-only mic session', async () => {
    const plugin = RecordPlugin.create({ scrollingWaveform: true })
    const options: Record<string, unknown> = { interact: true, cursorWidth: 2, normalize: false }
    const wavesurfer = {
      options,
      setOptions: jest.fn((opts: Record<string, unknown>): void => {
        Object.assign(options, opts)
      }),
    }
    plugin._init(wavesurfer as never)

    await plugin.startMic()
    expect(wavesurfer.options.interact).toBe(false)
    expect(wavesurfer.options.cursorWidth).toBe(0)

    // A preview-only session: no recording, just stopMic(). Previously the
    // options were only restored on the record-end render path or destroy.
    plugin.stopMic()
    expect(wavesurfer.options.interact).toBe(true)
    expect(wavesurfer.options.cursorWidth).toBe(2)
    plugin.destroy()
  })

  describe('option restore on stopMic (only the keys the plugin overrides)', () => {
    const createHost = (options: Record<string, unknown>) => ({
      options,
      getWidth: () => 500,
      getDuration: () => 5,
      load: jest.fn().mockResolvedValue(undefined),
      setTime: jest.fn(),
      setOptions: jest.fn((opts: Record<string, unknown>): void => {
        Object.assign(options, opts)
      }),
    })

    it('keeps an option the app changed during the mic session', async () => {
      const plugin = RecordPlugin.create({ scrollingWaveform: true })
      const wavesurfer = createHost({ interact: true, cursorWidth: 2, waveColor: 'blue', height: 100 })
      plugin._init(wavesurfer as never)

      await plugin.startMic()
      wavesurfer.setOptions({ waveColor: 'red', height: 200 })
      plugin.stopMic()

      expect(wavesurfer.options.waveColor).toBe('red')
      expect(wavesurfer.options.height).toBe(200)
      plugin.destroy()
    })

    it('restores every overridden key to its pre-session value, including previously unset keys', async () => {
      const plugin = RecordPlugin.create({ scrollingWaveform: true })
      // normalize and maxPeak are not set at all before the session
      const wavesurfer = createHost({ interact: true, cursorWidth: 2 })
      plugin._init(wavesurfer as never)

      await plugin.startMic()
      expect(wavesurfer.options).toMatchObject({ interact: false, cursorWidth: 0, normalize: true, maxPeak: 1 })
      plugin.stopMic()

      expect(wavesurfer.options.interact).toBe(true)
      expect(wavesurfer.options.cursorWidth).toBe(2)
      expect(wavesurfer.options.normalize).toBeUndefined()
      expect(wavesurfer.options.maxPeak).toBeUndefined()
      plugin.destroy()
    })

    it('restores the minPxPerSec the continuous waveform set, and only that', async () => {
      let drawWaveform!: () => void
      const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void) => {
        drawWaveform = callback
        return 1
      }) as typeof setInterval)
      const plugin = RecordPlugin.create({ continuousWaveform: true, continuousWaveformDuration: 5 })
      const wavesurfer = createHost({ interact: true, minPxPerSec: 0, cursorWidth: 2 })
      plugin._init(wavesurfer as never)

      try {
        await plugin.startMic()
        drawWaveform()
        await flushMicrotasks()
        expect(wavesurfer.options.minPxPerSec).toBe(100)
        // Not overridden in continuous mode, so an app change survives
        wavesurfer.setOptions({ cursorWidth: 3 })

        plugin.stopMic()
        expect(wavesurfer.options.minPxPerSec).toBe(0)
        expect(wavesurfer.options.interact).toBe(true)
        expect(wavesurfer.options.cursorWidth).toBe(3)
      } finally {
        plugin.destroy()
        intervalSpy.mockRestore()
      }
    })

    it('does not pass load-time options (peaks, duration, audioRate, mediaControls) to the restore', async () => {
      const plugin = RecordPlugin.create({ scrollingWaveform: true })
      const wavesurfer = createHost({
        interact: true,
        cursorWidth: 2,
        peaks: [[0.1, 0.2]],
        duration: 10,
        audioRate: 1.5,
        mediaControls: true,
      })
      plugin._init(wavesurfer as never)

      await plugin.startMic()
      wavesurfer.setOptions.mockClear()
      plugin.stopMic()

      expect(wavesurfer.setOptions).toHaveBeenCalledTimes(1)
      const restored = wavesurfer.setOptions.mock.calls[0][0]
      expect(Object.keys(restored).sort()).toEqual(['cursorWidth', 'interact', 'maxPeak', 'normalize'])
      expect(restored).not.toHaveProperty('peaks')
      expect(restored).not.toHaveProperty('duration')
      plugin.destroy()
    })
  })

  it('does not deliver the old session record-end into a re-initialized lifecycle, but still redelivers to snapshotted listeners', async () => {
    const plugin = RecordPlugin.create()
    const oldLifecycleEnd = jest.fn()
    plugin.on('record-end', oldLifecycleEnd)

    await plugin.startRecording()
    plugin.destroy() // queues the recorder's async onstop; snapshots listeners

    // Re-init BEFORE the queued onstop runs: `destroyed` is false again and
    // this.scope is a fresh object -- the old closure must not cross over.
    plugin._init({} as never)
    const newLifecycleEnd = jest.fn()
    plugin.on('record-end', newLifecycleEnd)

    await flushMicrotasks()

    // The new lifecycle never sees the old session's event or blob render
    expect(newLifecycleEnd).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    // The listeners snapshotted at destroy still receive the final blob
    expect(oldLifecycleEnd).toHaveBeenCalledTimes(1)
    plugin.destroy()
  })

  it('redelivers the final blob only to record-end listeners still subscribed at destroy (on, once, un)', async () => {
    const plugin = RecordPlugin.create()
    const kept = jest.fn()
    const firedOnce = jest.fn()
    const removedByUn = jest.fn()
    const removedByUnsubscribe = jest.fn()
    const pendingOnce = jest.fn()
    plugin.on('record-end', kept)
    plugin.once('record-end', firedOnce)
    plugin.on('record-end', removedByUn)
    const unsubscribe = plugin.on('record-end', removedByUnsubscribe)

    await plugin.startRecording()
    plugin.stopRecording()
    await flushMicrotasks()
    expect(firedOnce).toHaveBeenCalledTimes(1)

    plugin.un('record-end', removedByUn)
    unsubscribe()
    plugin.once('record-end', pendingOnce)

    await plugin.startRecording()
    plugin.destroy()
    await flushMicrotasks()

    expect(kept).toHaveBeenCalledTimes(2)
    expect(firedOnce).toHaveBeenCalledTimes(1)
    expect(removedByUn).toHaveBeenCalledTimes(1)
    expect(removedByUnsubscribe).toHaveBeenCalledTimes(1)
    expect(pendingOnce).toHaveBeenCalledTimes(1)
    expect(pendingOnce.mock.calls[0][0]).toBeInstanceOf(Blob)
  })

  it('stops the mic as a record-end listener, in subscription order with the app listeners', async () => {
    const plugin = RecordPlugin.create()
    const streamSeen: Record<string, boolean> = {}
    const micIsLive = () => plugin.__recordInternalsForTests().stream !== null
    plugin.on('record-end', () => (streamSeen.before = micIsLive()))

    await plugin.startRecording()
    plugin.on('record-end', () => (streamSeen.after = micIsLive()))
    plugin.stopRecording()
    await flushMicrotasks()

    // Subscribed before startMic(): runs before the plugin's own mic teardown
    expect(streamSeen).toEqual({ before: true, after: false })
    plugin.destroy()
  })

  it('keeps the constructor-time session when registered after startMic()', async () => {
    const track = new MockMediaStreamTrack()
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(createFakeMicStream([track]))
    const plugin = RecordPlugin.create()
    await plugin.startMic()

    // The first _init() adopts the lifecycle the constructor set up
    const options: Record<string, unknown> = { interact: true }
    plugin._init({ options, setOptions: jest.fn((opts) => Object.assign(options, opts)) } as never)
    expect(plugin.__recordInternalsForTests().stream).not.toBeNull()

    plugin.stopMic()
    expect(track.stop).toHaveBeenCalled()
    expect(plugin.__recordInternalsForTests().stream).toBeNull()
    plugin.destroy()
  })

  it('does not deliver the old session record-data-available into a re-initialized lifecycle', async () => {
    const plugin = RecordPlugin.create()
    await plugin.startRecording()
    const oldRecorder = plugin.__recordInternalsForTests().mediaRecorder as unknown as MockMediaRecorder
    plugin.destroy()

    plugin._init({} as never)
    const onData = jest.fn()
    plugin.on('record-data-available', onData)
    oldRecorder.ondataavailable?.({ data: new Blob(['late-chunk']) })
    await flushMicrotasks()

    expect(onData).not.toHaveBeenCalled()
    plugin.destroy()
  })

  it('stops the granted tracks when destroy + re-init happens during a pending getUserMedia', async () => {
    let grantStream!: (stream: MediaStream) => void
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          grantStream = resolve
        }),
    )

    const plugin = RecordPlugin.create()
    // renderMicStream()'s first step: the stream must not be attached to anything
    const createSourceSpy = jest.spyOn(MockAudioContext.prototype, 'createMediaStreamSource')

    const micPromise = plugin.startMic()
    plugin.destroy()
    plugin._init({} as never) // a fresh lifecycle -- the request's own scope stays disposed

    const trackStop = jest.fn()
    grantStream({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream)

    await expect(micPromise).rejects.toThrow(/destroyed/)
    expect(trackStop).toHaveBeenCalled()
    expect(createSourceSpy).not.toHaveBeenCalled()
    createSourceSpy.mockRestore()
    plugin.destroy()
  })

  it('does not include paused time in record duration after resuming', async () => {
    let now = 1_000
    const nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now)
    const plugin = RecordPlugin.create()
    const onProgress = jest.fn()
    plugin.on('record-progress', onProgress)

    try {
      await plugin.startRecording()

      now = 1_500
      plugin.__recordInternalsForTests().tick()
      expect(plugin.getDuration()).toBe(500)

      plugin.pauseRecording()
      now = 16_500
      onProgress.mockClear()
      plugin.resumeRecording()

      expect(plugin.getDuration()).toBe(500)
      expect(onProgress).toHaveBeenLastCalledWith(500)

      now = 16_600
      plugin.__recordInternalsForTests().tick()
      expect(plugin.getDuration()).toBe(600)
    } finally {
      plugin.destroy()
      await flushMicrotasks()
      nowSpy.mockRestore()
    }
  })

  it('keeps the continuous waveform cursor aligned after late draws, a mic preview, and a paused progress clock', async () => {
    let now = 1_000
    const nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now)
    const analyserSpy = jest.spyOn(MockAudioContext.prototype, 'createAnalyser').mockReturnValue({
      fftSize: 32,
      frequencyBinCount: 16,
      getFloatTimeDomainData: jest.fn((samples: Float32Array) => samples.fill(0.5)),
    })
    let drawWaveform!: () => void
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void) => {
      drawWaveform = callback
      return 1
    }) as typeof setInterval)
    const wavesurfer = {
      options: { interact: true, minPxPerSec: 1 },
      getWidth: () => 500,
      getDuration: () => 5,
      load: jest.fn().mockResolvedValue(undefined),
      replacePeaks: jest.fn().mockReturnValue(true),
      setTime: jest.fn(),
      setOptions: jest.fn(),
    }
    const plugin = RecordPlugin.create({ continuousWaveform: true, continuousWaveformDuration: 5 })
    plugin._init(wavesurfer as never)

    try {
      await plugin.startMic()
      drawWaveform()
      now = 3_000
      drawWaveform() // only two callbacks in two seconds of preview

      await plugin.startRecording() // reset the preview's waveform position
      drawWaveform()
      now = 3_500
      drawWaveform() // one delayed callback after 500 ms of recording

      // Only the session's first frame is a real load(); the rest swap peaks
      expect(wavesurfer.load).toHaveBeenCalledTimes(1)
      expect(wavesurfer.replacePeaks).toHaveBeenCalledTimes(3)
      const lastRender = wavesurfer.replacePeaks.mock.calls[wavesurfer.replacePeaks.mock.calls.length - 1]
      const peaks = lastRender[0][0] as Float32Array
      expect(peaks[0]).toBe(0.5)
      expect(peaks[50]).toBe(0.5)
      expect(peaks[51]).toBe(0)
      await flushMicrotasks()
      expect(wavesurfer.setTime).toHaveBeenLastCalledWith(0.5)

      // The waveform interval can keep drawing while animation-frame progress
      // callbacks are suspended. Pausing must preserve the elapsed recording
      // time even though handleTick() has not advanced this.duration.
      plugin.pauseRecording()
      expect(plugin.getDuration()).toBe(500)
      now = 13_500
      plugin.resumeRecording()
      now = 13_600
      drawWaveform()

      const resumedPeaks = wavesurfer.replacePeaks.mock.calls[
        wavesurfer.replacePeaks.mock.calls.length - 1
      ][0][0] as Float32Array
      expect(resumedPeaks[51]).toBe(0.5)
      expect(resumedPeaks[60]).toBe(0.5)
      expect(resumedPeaks[61]).toBe(0)
      await flushMicrotasks()
      expect(wavesurfer.setTime).toHaveBeenLastCalledWith(0.6)
    } finally {
      plugin.destroy()
      await flushMicrotasks()
      intervalSpy.mockRestore()
      analyserSpy.mockRestore()
      nowSpy.mockRestore()
    }
  })

  describe('live preview against a real WaveSurfer', () => {
    const originalGetContext = window.HTMLCanvasElement.prototype.getContext

    beforeAll(() => {
      installMatchMediaStub()
      // jsdom has no canvas backend: stub the 2D context the real renderer draws on
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

    const setUp = (pluginOptions: Parameters<typeof RecordPlugin.create>[0]) => {
      let now = 1_000
      const nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now)
      let level = 0
      const analyserSpy = jest.spyOn(MockAudioContext.prototype, 'createAnalyser').mockReturnValue({
        fftSize: 32,
        frequencyBinCount: 16,
        getFloatTimeDomainData: jest.fn((samples: Float32Array) => samples.fill(level)),
      })
      let drawWaveform!: () => void
      const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void) => {
        drawWaveform = callback
        return 1
      }) as typeof setInterval)

      const wavesurfer = WaveSurfer.create({ container: document.createElement('div') })
      const plugin = wavesurfer.registerPlugin(RecordPlugin.create(pluginOptions))
      const events = { load: 0, decode: 0, ready: 0 }
      wavesurfer.on('load', () => events.load++)
      wavesurfer.on('decode', () => events.decode++)
      wavesurfer.on('ready', () => events.ready++)

      // One preview frame: the analyser reports `nextLevel`, a bit over 10 ms
      // pass (exactly 10 ms can floor two frames onto one continuous sample)
      const tick = (nextLevel: number) => {
        level = nextLevel
        now += 11
        drawWaveform()
      }
      const restore = () => {
        wavesurfer.destroy()
        intervalSpy.mockRestore()
        analyserSpy.mockRestore()
        nowSpy.mockRestore()
      }
      return { wavesurfer, plugin, events, tick, restore }
    }

    it('scrolling: emits load/decode/ready once per mic session while every tick updates the waveform', async () => {
      const { wavesurfer, plugin, events, tick, restore } = setUp({
        scrollingWaveform: true,
        scrollingWaveformWindow: 1,
      })
      try {
        await plugin.startMic()
        tick(0.01)
        await flushMicrotasks()
        expect(events).toEqual({ load: 1, decode: 1, ready: 1 })

        const levels = [0.01]
        let previous = wavesurfer.getDecodedData()
        for (let i = 2; i <= 30; i++) {
          tick(i / 100)
          levels.push(i / 100)
          const decoded = wavesurfer.getDecodedData()!
          expect(decoded).not.toBe(previous)
          previous = decoded
          expect(wavesurfer.getDuration()).toBe(1)
          // The window shifted left by one sample: the newest peaks are at the end
          const channel = decoded.getChannelData(0)
          expect(channel).toHaveLength(100)
          expect(Array.from(channel.slice(-levels.length))).toEqual(levels.map((l) => Math.fround(l)))
          expect(channel.slice(0, -levels.length).every((v) => v === 0)).toBe(true)
        }
        await flushMicrotasks()
        expect(events).toEqual({ load: 1, decode: 1, ready: 1 })
        expect(wavesurfer.getState().loadPhase.value).toBe('ready')

        // A new mic session starts with one real load again
        plugin.stopMic()
        await plugin.startMic()
        tick(0.5)
        await flushMicrotasks()
        tick(0.6)
        expect(events).toEqual({ load: 2, decode: 2, ready: 2 })
      } finally {
        restore()
      }
    })

    it('continuous: emits load/decode/ready once per mic session while every tick updates the waveform', async () => {
      const { wavesurfer, plugin, events, tick, restore } = setUp({
        continuousWaveform: true,
        continuousWaveformDuration: 1,
      })
      // jsdom has no layout: give the waveform a width for the minPxPerSec adjustment
      jest.spyOn(wavesurfer, 'getWidth').mockReturnValue(500)
      try {
        await plugin.startMic()
        tick(0.01)
        await flushMicrotasks()
        expect(events).toEqual({ load: 1, decode: 1, ready: 1 })
        // The minPxPerSec adjustment ran after the first render
        expect(wavesurfer.options.minPxPerSec).toBe(500)

        for (let i = 2; i <= 30; i++) {
          tick(i / 100)
          const channel = wavesurfer.getDecodedData()!.getChannelData(0)
          expect(wavesurfer.getDuration()).toBe(1)
          expect(Math.max(...channel)).toBeCloseTo(i / 100)
        }

        // Recording moves the cursor every tick (setTime after each render)
        const setTimeSpy = jest.spyOn(wavesurfer, 'setTime')
        await plugin.startRecording()
        tick(0.4)
        tick(0.4)
        expect(setTimeSpy).toHaveBeenCalledTimes(2)
        expect(setTimeSpy).toHaveBeenLastCalledWith(0.02)

        // The window grows past its initial duration and the duration follows
        for (let i = 0; i < 120; i++) tick(0.3)
        expect(wavesurfer.getDuration()).toBe(2)

        await flushMicrotasks()
        expect(events).toEqual({ load: 1, decode: 1, ready: 1 })
      } finally {
        restore()
      }
    })
  })
})

describe('RecordPlugin capture device loss (track "ended")', () => {
  const originalAudioContext = global.AudioContext
  const originalMediaRecorder = global.MediaRecorder
  const originalMediaDevices = navigator.mediaDevices
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  let track: MockMediaStreamTrack

  beforeEach(() => {
    global.AudioContext = MockAudioContext as unknown as typeof AudioContext
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder
    track = new MockMediaStreamTrack()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(createFakeMicStream([track])) },
    })
    URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    global.AudioContext = originalAudioContext
    global.MediaRecorder = originalMediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: originalMediaDevices,
    })
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('stops an active recording gracefully and emits record-ended-externally, then record-end with the blob', async () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    const onEndedExternally = jest.fn()
    const callOrder: string[] = []
    plugin.on('record-end', () => callOrder.push('record-end'))
    plugin.on('record-ended-externally', () => callOrder.push('record-ended-externally'))
    plugin.on('record-end', onEnd)
    plugin.on('record-ended-externally', onEndedExternally)

    await plugin.startRecording()
    expect(plugin.isRecording()).toBe(true)
    expect(track.hasEndedListeners).toBe(true)

    // The device disappears (e.g. Bluetooth headset powers off)
    track.end()

    expect(onEndedExternally).toHaveBeenCalledTimes(1)
    expect(plugin.isRecording()).toBe(false)
    expect(plugin.isActive()).toBe(false)

    // The recorder's queued onstop still delivers the final blob
    await flushMicrotasks()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(callOrder).toEqual(['record-ended-externally', 'record-end'])

    // The mic session is fully torn down and listeners removed
    expect(track.hasEndedListeners).toBe(false)
    plugin.destroy()
  })

  it('handles device loss while the recording is paused', async () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    const onEndedExternally = jest.fn()
    plugin.on('record-end', onEnd)
    plugin.on('record-ended-externally', onEndedExternally)

    await plugin.startRecording()
    plugin.pauseRecording()
    expect(plugin.isPaused()).toBe(true)

    track.end()

    expect(onEndedExternally).toHaveBeenCalledTimes(1)
    expect(plugin.isActive()).toBe(false)
    expect(plugin.isPaused()).toBe(false)

    await flushMicrotasks()
    expect(onEnd).toHaveBeenCalledTimes(1)
    plugin.destroy()
  })

  it('does not emit record-ended-externally on a user-initiated stop', async () => {
    const plugin = RecordPlugin.create()
    const onEndedExternally = jest.fn()
    plugin.on('record-ended-externally', onEndedExternally)

    await plugin.startRecording()
    plugin.stopRecording()
    await flushMicrotasks()

    expect(onEndedExternally).not.toHaveBeenCalled()
    // Normal stop removed the track listeners along with the mic teardown
    expect(track.hasEndedListeners).toBe(false)
    plugin.destroy()
  })

  it('tears down a preview-only mic session on device loss without emitting recording events', async () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    const onEndedExternally = jest.fn()
    plugin.on('record-end', onEnd)
    plugin.on('record-ended-externally', onEndedExternally)

    await plugin.startMic()
    expect(track.hasEndedListeners).toBe(true)

    track.end()

    // No recording was active: nothing to end, just clean up the monitoring
    expect(onEnd).not.toHaveBeenCalled()
    expect(onEndedExternally).not.toHaveBeenCalled()
    expect(track.hasEndedListeners).toBe(false)
    expect(plugin.__recordInternalsForTests().stream).toBeNull()
    plugin.destroy()
  })

  it('removes track listeners on destroy, and a late "ended" does nothing', async () => {
    const plugin = RecordPlugin.create()
    const onEndedExternally = jest.fn()
    plugin.on('record-ended-externally', onEndedExternally)

    await plugin.startRecording()
    expect(track.hasEndedListeners).toBe(true)

    plugin.destroy()
    await flushMicrotasks()

    expect(track.hasEndedListeners).toBe(false)
    expect(() => track.end()).not.toThrow()
    expect(onEndedExternally).not.toHaveBeenCalled()
  })
})

describe('RecordPlugin startMic destroyed during pending getUserMedia', () => {
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    } else {
      delete (navigator as unknown as Record<string, unknown>).mediaDevices
    }
  })

  it('stops the granted tracks and rejects instead of leaking a live mic', async () => {
    // A controllable getUserMedia: resolves only when we say so, simulating
    // the browser permission prompt being up while the plugin is destroyed.
    let grantStream!: (stream: MediaStream) => void
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              grantStream = resolve
            }),
        ),
      },
    })

    const plugin = RecordPlugin.create()
    // renderMicStream()'s first step: an AudioContext for the stream
    const originalAudioContext = global.AudioContext
    const audioContextCtor = jest.fn()
    global.AudioContext = audioContextCtor as unknown as typeof AudioContext

    try {
      const micPromise = plugin.startMic()
      plugin.destroy()

      const trackStop = jest.fn()
      grantStream({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream)

      await expect(micPromise).rejects.toThrow(/destroyed/)
      // The mic must actually be released -- otherwise the tab's recording
      // indicator stays on forever with nothing left to stop it.
      expect(trackStop).toHaveBeenCalled()
      // And nothing may attach the stream to the post-destroy fresh scope.
      expect(audioContextCtor).not.toHaveBeenCalled()
    } finally {
      global.AudioContext = originalAudioContext
    }
  })
})
