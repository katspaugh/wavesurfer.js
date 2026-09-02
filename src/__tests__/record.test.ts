import RecordPlugin from '../plugins/record.js'

describe('RecordPlugin teardown', () => {
  it('emits record-end BEFORE listeners are cleared on destroy', () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    plugin.on('record-end', onEnd)

    // Simulate an active recorder whose stop() triggers the browser's
    // onstop handler synchronously, which in real code emits 'record-end'.
    const anyPlugin = plugin as any
    anyPlugin.mediaRecorder = {
      state: 'recording',
      stop: () => anyPlugin.emit('record-end', new Blob()),
      stream: { getTracks: () => [] },
    }

    plugin.destroy()

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('record-progress works after destroy + re-init', () => {
    const plugin = RecordPlugin.create()
    plugin.destroy()
    plugin._init({} as never)

    const anyPlugin = plugin as any
    const onProgress = jest.fn()
    plugin.on('record-progress', onProgress)

    // onInit() (run by _init() above) recreates frameScheduler bound to the
    // fresh post-destroy scope; start()'s synchronous first tick reaches the
    // plugin's tick handler and emits 'record-progress'.
    anyPlugin.frameScheduler.start(anyPlugin.handleTick)

    expect(onProgress).toHaveBeenCalled()
  })

  it('stops the frame scheduler on plugin destroy', () => {
    const plugin = RecordPlugin.create()
    const anyPlugin = plugin as any
    anyPlugin.frameScheduler.start(jest.fn())
    expect(anyPlugin.frameScheduler.running).toBe(true)

    plugin.destroy()

    expect(anyPlugin.frameScheduler.running).toBe(false)
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

function createFakeMicStream(): MediaStream {
  return {
    getTracks: () => [{ stop: jest.fn() }],
  } as unknown as MediaStream
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
    const firstRecorder = (plugin as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder
    // The first session produces a chunk
    firstRecorder.ondataavailable?.({ data: new Blob(['old-session-chunk']) })

    // Restart: the old recorder's queued 'stop' must not dispatch into the
    // new session's handlers (spurious record-end right after record-start)
    await plugin.startRecording()
    await flushMicrotasks()

    expect(onStart).toHaveBeenCalledTimes(2)
    expect(onEnd).not.toHaveBeenCalled()
    expect((plugin as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder).not.toBe(firstRecorder)

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

  it('stops the granted tracks when destroy + re-init happens during a pending getUserMedia', async () => {
    let grantStream!: (stream: MediaStream) => void
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          grantStream = resolve
        }),
    )

    const plugin = RecordPlugin.create()
    const renderMicStreamSpy = jest.spyOn(plugin, 'renderMicStream')

    const micPromise = plugin.startMic()
    plugin.destroy()
    plugin._init({} as never) // resets `destroyed` -- the captured scope stays disposed

    const trackStop = jest.fn()
    grantStream({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream)

    await expect(micPromise).rejects.toThrow(/destroyed/)
    expect(trackStop).toHaveBeenCalled()
    expect(renderMicStreamSpy).not.toHaveBeenCalled()
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
      ;(plugin as any).handleTick()
      expect(plugin.getDuration()).toBe(500)

      plugin.pauseRecording()
      now = 16_500
      onProgress.mockClear()
      plugin.resumeRecording()

      expect(plugin.getDuration()).toBe(500)
      expect(onProgress).toHaveBeenLastCalledWith(500)

      now = 16_600
      ;(plugin as any).handleTick()
      expect(plugin.getDuration()).toBe(600)
    } finally {
      plugin.destroy()
      await flushMicrotasks()
      nowSpy.mockRestore()
    }
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
    const renderMicStreamSpy = jest.spyOn(plugin, 'renderMicStream')

    const micPromise = plugin.startMic()
    plugin.destroy()

    const trackStop = jest.fn()
    grantStream({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream)

    await expect(micPromise).rejects.toThrow(/destroyed/)
    // The mic must actually be released -- otherwise the tab's recording
    // indicator stays on forever with nothing left to stop it.
    expect(trackStop).toHaveBeenCalled()
    // And nothing may attach the stream to the post-destroy fresh scope.
    expect(renderMicStreamSpy).not.toHaveBeenCalled()
  })
})
