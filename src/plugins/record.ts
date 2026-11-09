/**
 * Record audio from the microphone with a real-time waveform preview
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin, type PluginContext } from '../define-plugin.js'
import { FrameScheduler } from '../frame-scheduler.js'
import type WaveSurfer from '../wavesurfer.js'
import type { WaveSurferOptions } from '../wavesurfer.js'

export type RecordPluginOptions = {
  /** The MIME type to use when recording audio */
  mimeType?: MediaRecorderOptions['mimeType']
  /** The audio bitrate to use when recording audio, defaults to 128000 to avoid a VBR encoding. */
  audioBitsPerSecond?: MediaRecorderOptions['audioBitsPerSecond']
  /** Whether to render the recorded audio at the end, true by default */
  renderRecordedAudio?: boolean
  /** Whether to render the scrolling waveform, false by default */
  scrollingWaveform?: boolean
  /** The duration of the scrolling waveform window, defaults to 5 seconds */
  scrollingWaveformWindow?: number
  /** Accumulate and render the waveform data as the audio is being recorded, false by default */
  continuousWaveform?: boolean
  /** The duration of the continuous waveform, in seconds */
  continuousWaveformDuration?: number
  /**
   * The timeslice (ms) to use for the media recorder. When set, 'record-data-available'
   * fires every timeslice instead of only when the recording stops or pauses.
   * Note: timesliced WebM recordings have no duration in their metadata.
   */
  mediaRecorderTimeslice?: number
}

export type RecordPluginDeviceOptions = MediaTrackConstraints

export type RecordPluginEvents = BasePluginEvents & {
  /** Fires when the recording starts */
  'record-start': []
  /** Fires when the recording is paused */
  'record-pause': [blob: Blob]
  /** Fires when the recording is resumed */
  'record-resume': []
  /* When the recording stops, either by calling stopRecording or when the media recorder stops */
  'record-end': [blob: Blob]
  /**
   * Fires when an active recording (or paused recording) is stopped because the
   * capture device ended on its own — e.g. a Bluetooth headset powered off or a
   * dock was unplugged — rather than by a stopRecording()/destroy() call.
   * A final 'record-end' with the recorded blob still follows.
   */
  'record-ended-externally': []
  /** Fires continuously while recording */
  'record-progress': [duration: number]
  /** On every new recorded chunk: every `mediaRecorderTimeslice` if set, otherwise on stop/pause */
  'record-data-available': [blob: Blob]
}

type MicStream = {
  onDestroy: () => void
  onEnd: () => void
}

/** @internal test-only: live views of one lifecycle's private state */
type TestInternals = {
  readonly frameScheduler: FrameScheduler
  readonly mediaRecorder: MediaRecorder | null
  readonly stream: MediaStream | null
  /** The record-progress tick the frame scheduler runs */
  tick: () => void
}

type RecordPluginApi = {
  /** Render a real-time waveform of a microphone stream. Called by startMic(). */
  renderMicStream(stream: MediaStream): MicStream
  /** Request access to the microphone and start monitoring incoming audio */
  startMic(options?: RecordPluginDeviceOptions): Promise<MediaStream>
  /** Stop monitoring incoming audio */
  stopMic(): void
  /**
   * Start recording audio from the microphone.
   *
   * Calling this while a recording is already active restarts: the previous
   * session is discarded (no 'record-end' is emitted for it -- call
   * stopRecording() first if you want its final blob).
   */
  startRecording(options?: RecordPluginDeviceOptions): Promise<void>
  /** Get the duration of the recording */
  getDuration(): number
  /** Check if the audio is being recorded */
  isRecording(): boolean
  isPaused(): boolean
  isActive(): boolean
  /** Stop the recording */
  stopRecording(): void
  /** Pause the recording */
  pauseRecording(): void
  /** Resume the recording */
  resumeRecording(): void
  /** @internal test-only, see TestInternals */
  __recordInternalsForTests(): TestInternals
}

type RecordEndListener = (blob: Blob) => void

/**
 * The two things setup() needs from the plugin's own event emitter, which the
 * definePlugin context (emit only) does not offer. Provided by the RecordPlugin
 * class below, through `hosts`.
 */
type RecordHost = {
  /**
   * Subscribe to the plugin's own 'record-end'. A real subscription, so it runs in
   * subscription order among the app's listeners, and destroy() (unAll) drops it.
   */
  onceRecordEnd: (listener: RecordEndListener) => () => void
  /** The 'record-end' listeners subscribed right now, in subscription order */
  recordEndListeners: () => RecordEndListener[]
}

// Keyed by the plugin's own options object: the RecordPlugin constructor creates
// one per instance and registers its host under it, and setup() receives that
// same object (definePlugin passes `this.options`) on every (re-)init.
const hosts = new WeakMap<RecordPluginOptions, RecordHost>()

const DEFAULT_BITS_PER_SECOND = 128000
const DEFAULT_SCROLLING_WAVEFORM_WINDOW = 5
const FPS = 100

const MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3']
const findSupportedMimeType = () => MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))

/**
 * One plugin lifecycle: from construction or a re-init after destroy() to the
 * next destroy(). Everything here is private to the lifecycle, so `ctx.scope`
 * (disposed by destroy(), and replaced by a re-init) tells a late callback --
 * a MediaRecorder event or a permission prompt that resolves after destroy --
 * that its lifecycle is over.
 */
function setupRecord(
  ctx: PluginContext<RecordPluginEvents>,
  options: RecordPluginOptions,
  host: RecordHost,
): RecordPluginApi {
  // Undefined before _init() (setup runs at construction, see RecordPlugin) and
  // after destroy(). After a re-init, ctx.wavesurfer is the NEW lifecycle's, so
  // this lifecycle's late callbacks must not touch it once the scope is disposed.
  const liveWavesurfer = (): WaveSurfer | undefined => (ctx.scope.disposed ? undefined : ctx.wavesurfer)

  let stream: MediaStream | null = null
  let mediaRecorder: MediaRecorder | null = null
  let dataWindow: Float32Array | null = null
  let isWaveformPaused = false
  let originalOptions: Partial<WaveSurferOptions> | undefined
  let lastStartTime = 0
  let lastDuration = 0
  let duration = 0
  let micStream: MicStream | null = null
  let unsubscribeRecordEnd: (() => void) | undefined
  // Early-removal handles for the per-track 'ended' listeners registered in
  // startMic(). Registered via ctx.scope.listen(), so destroy() removes them
  // even if stopMic() never ran; stopMic() calls these on a normal stop.
  let unsubscribeTrackEnded: (() => void)[] = []
  let recordedBlobUrl: string | null = null
  // The 'record-end' listeners subscribed when destroy() stopped an active
  // recording. MediaRecorder fires 'stop' from a queued task, after destroy()
  // has cleared the listeners (unAll), so the final blob goes to these instead.
  let finalRecordEndListeners: RecordEndListener[] | null = null

  // Teardown on destroy(). Registered first, so the scope's LIFO disposal runs
  // it last: after the mic child scope and the track listeners are disposed,
  // and -- definePlugin disposes the scope before the 'destroy' event and
  // unAll() -- while the app's listeners are still subscribed.
  ctx.scope.add(() => {
    if (isActive()) finalRecordEndListeners = host.recordEndListeners()
    applyOriginalOptionsIfNeeded()
    stopRecording()
    stopMic()
    // Unconditional: stopRecording() only stops it while recording
    frameScheduler.stop()
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl)
      recordedBlobUrl = null
    }
  })

  const frameScheduler = new FrameScheduler(ctx.scope)

  const tick = () => {
    const currentTime = performance.now() - lastStartTime
    duration = isPaused() ? duration : lastDuration + currentTime
    ctx.emit('record-progress', duration)
  }

  const applyOriginalOptionsIfNeeded = () => {
    // ctx.wavesurfer rather than liveWavesurfer(): the teardown above restores
    // the options while the scope is already marked disposed
    const wavesurfer = ctx.wavesurfer as WaveSurfer | undefined
    if (wavesurfer && originalOptions) {
      wavesurfer.setOptions(originalOptions)
      originalOptions = undefined
    }
  }

  const renderMicStream = (micMediaStream: MediaStream): MicStream => {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(micMediaStream)
    const analyser = audioContext.createAnalyser()
    source.connect(analyser)

    // Use smaller FFT size for more responsive peak detection
    if (options.continuousWaveform || options.scrollingWaveform) {
      analyser.fftSize = 32
    }
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)

    let sampleIdx = -1
    let monitorStartTime = performance.now()
    // Whether the next frame must go through a real load() (see drawWaveform)
    let needsLoad = true

    const hostWavesurfer = liveWavesurfer()
    if (hostWavesurfer) {
      // Snapshot only the keys this session overrides (below, and minPxPerSec
      // in the continuous-mode render callback), so the restore on stop
      // neither reverts options the app changed meanwhile nor re-applies
      // load-time options (peaks, duration, audioRate...) that setOptions()
      // acts on.
      // Keys are written even when their value is undefined, so the restore
      // also clears a value the session set on a previously unset key.
      if (!originalOptions) {
        const hostOptions = hostWavesurfer.options
        const snapshot: Partial<WaveSurferOptions> = { interact: hostOptions.interact }
        if (options.scrollingWaveform) {
          snapshot.cursorWidth = hostOptions.cursorWidth
          snapshot.normalize = hostOptions.normalize
          snapshot.maxPeak = hostOptions.maxPeak
        }
        // Only overridden when unset (see drawWaveform)
        if (options.continuousWaveform && !hostOptions.minPxPerSec) {
          snapshot.minPxPerSec = hostOptions.minPxPerSec
        }
        originalOptions = snapshot
      }

      hostWavesurfer.options.interact = false
      if (options.scrollingWaveform) {
        hostWavesurfer.options.cursorWidth = 0
        // Use fixed max peak in scrolling mode to prevent "dancing" waveform
        hostWavesurfer.options.normalize = true
        hostWavesurfer.options.maxPeak = 1
      }
    }

    const drawWaveform = () => {
      if (isWaveformPaused) return

      analyser.getFloatTimeDomainData(dataArray)

      if (options.scrollingWaveform) {
        // Scrolling waveform - use peak values for smooth rendering
        const windowSize = Math.floor((options.scrollingWaveformWindow || 0) * FPS)

        // Calculate peak value from the current buffer
        let maxValue = 0
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i])
          if (value > maxValue) {
            maxValue = value
          }
        }

        if (dataWindow?.length === windowSize) {
          // Shift old data to the left in place, dropping the oldest sample.
          // Safe to mutate: the renderer draws synchronously and every tick
          // re-renders from this array anyway.
          dataWindow.copyWithin(0, 1)
        } else {
          // Zero-filled, so the first tick (no window yet) needs no copy
          dataWindow = new Float32Array(windowSize)
        }

        // Add new peak value at the end
        dataWindow[windowSize - 1] = maxValue
      } else if (options.continuousWaveform) {
        // Continuous waveform
        if (!dataWindow) {
          sampleIdx = -1
          monitorStartTime = performance.now()
          const size = options.continuousWaveformDuration
            ? Math.round(options.continuousWaveformDuration * FPS)
            : (liveWavesurfer()?.getWidth() ?? 0) * window.devicePixelRatio
          dataWindow = new Float32Array(size)
        }

        let maxValue = 0
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i])
          if (value > maxValue) {
            maxValue = value
          }
        }

        // The interval can run late or be throttled. Place peaks on the same
        // elapsed-time axis as the recording cursor instead of assuming every
        // callback represents exactly 1 / FPS seconds.
        const elapsedMs = isRecording()
          ? lastDuration + performance.now() - lastStartTime
          : performance.now() - monitorStartTime
        const nextSampleIdx = Math.max(sampleIdx, Math.floor((elapsedMs / 1000) * FPS))
        if (nextSampleIdx >= dataWindow.length) {
          const tempArray = new Float32Array(Math.max(dataWindow.length * 2, nextSampleIdx + 1))
          tempArray.set(dataWindow, 0)
          dataWindow = tempArray
        }

        dataWindow.fill(maxValue, sampleIdx + 1, nextSampleIdx + 1)
        sampleIdx = nextSampleIdx
      } else {
        dataWindow = dataArray
      }

      // Render the waveform
      const wavesurfer = liveWavesurfer()
      if (wavesurfer) {
        const peaks = dataWindow
        const totalDuration = peaks.length / FPS
        const windowDuration = options.scrollingWaveform ? options.scrollingWaveformWindow || 0 : totalDuration
        const cursorTime = isRecording() && options.continuousWaveform ? sampleIdx / FPS : 0
        const afterRender = () => {
          // Re-read: a load() settles asynchronously, possibly after destroy()
          const current = liveWavesurfer()
          if (current && options.continuousWaveform) {
            current.setTime(cursorTime)

            if (!current.options.minPxPerSec) {
              current.setOptions({
                minPxPerSec: current.getWidth() / current.getDuration(),
              })
            }
          }
        }
        const onRenderError = (err: unknown) => console.error('Error rendering real-time recording data:', err)

        if (needsLoad) {
          // The session's first frame is a real load(): it clears a previous
          // recording's media source, pauses playback and gives the app one
          // round of load/decode/ready for the preview.
          needsLoad = false
          wavesurfer
            .load('', [peaks], windowDuration)
            .then(afterRender)
            .catch((err) => {
              // Superseded by a newer load() -- not an error here
              if (err instanceof DOMException && err.name === 'AbortError') return
              onRenderError(err)
            })
        } else {
          // Later frames only swap the peaks: a full load() 100 times a
          // second would flood the app with load/decode/ready events. Skipped
          // (false) while a load() is in flight.
          try {
            if (wavesurfer.replacePeaks([peaks], windowDuration)) afterRender()
          } catch (err) {
            onRenderError(err)
          }
        }
      }
    }

    // A child of the lifecycle scope: startMic()/stopMic() can run several
    // times over the plugin's life, so these mic-specific resources need
    // their own disposable unit. Being a CHILD also means destroy() (which
    // disposes ctx.scope) cleans this up even if stopMic() was never called.
    const micScope = ctx.scope.child()
    // Registered before the interval so LIFO disposal clears the interval
    // first and only then disconnects/closes the audio graph (stop drawing
    // before tearing down what it reads).
    micScope.add(() => {
      source?.disconnect()
      audioContext?.close()
    })
    micScope.interval(drawWaveform, 1000 / FPS)

    return {
      onDestroy: () => micScope.dispose(),
      onEnd: () => {
        // Fires when a recording ends on its own (not via an explicit
        // stopMic()/destroy() call) -- a domain-event reaction, not a
        // teardown resource, so it stays wired through the plugin's own
        // 'record-end' (see startMic()).
        isWaveformPaused = true
        stopMic()
      },
    }
  }

  const startMic = async (deviceOptions?: RecordPluginDeviceOptions): Promise<MediaStream> => {
    // Stop previous mic stream if exists to clean up AudioContext
    if (micStream) {
      stopMic()
    }

    let newStream: MediaStream
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceOptions ?? true,
      })
    } catch (err) {
      throw new Error('Error accessing the microphone: ' + (err as Error).message)
    }

    // The plugin may have been destroyed (and possibly re-initialized) while
    // the permission prompt was up. Without this guard the stream (and the
    // AudioContext + render interval renderMicStream would attach) would leak
    // -- the tab's recording indicator stays on with no way to stop it.
    if (ctx.scope.disposed) {
      newStream.getTracks().forEach((track) => track.stop())
      throw new Error('The plugin was destroyed while requesting the microphone')
    }

    const newMicStream = renderMicStream(newStream)
    micStream = newMicStream
    unsubscribeRecordEnd = host.onceRecordEnd(newMicStream.onEnd)
    stream = newStream

    // Detect the capture device disappearing mid-session (e.g. a Bluetooth
    // headset powering off, a dock being unplugged): the track then fires
    // 'ended' on its own. Note that our own track.stop() calls (stopMic)
    // do NOT fire 'ended', so this only catches external loss.
    unsubscribeTrackEnded = newStream
      .getTracks()
      .map((track) => ctx.scope.listen(track, 'ended', () => handleTrackEnded()))

    return newStream
  }

  /**
   * A capture track ended on its own (device lost) rather than via our own
   * track.stop() calls. Stop gracefully: the recorder's onstop still delivers
   * the final blob through 'record-end', and 'record-ended-externally' lets
   * the app tell this apart from a user-initiated stop.
   */
  const handleTrackEnded = () => {
    if (isActive()) {
      // Covers both recording and paused states. Emit before stopping so the
      // app can update its UI knowing the 'record-end' that follows (async,
      // from the recorder's queued onstop) was not user-initiated.
      ctx.emit('record-ended-externally')
      stopRecording()
      // stopMic() (mic teardown, track-listener removal, option restore)
      // runs via the 'record-end' subscription when onstop fires.
    } else {
      // Preview-only mic session (startMic without a recording): the device
      // is gone, so tear down the monitoring instead of freezing silently.
      stopMic()
    }
  }

  const stopMic = () => {
    micStream?.onDestroy()
    unsubscribeRecordEnd?.()
    micStream = null
    unsubscribeRecordEnd = undefined
    // Remove the per-track 'ended' listeners before stopping the tracks.
    // track.stop() doesn't fire 'ended', so this is about not leaking
    // listeners across mic sessions, not about suppressing a spurious event.
    unsubscribeTrackEnded.forEach((unsubscribe) => unsubscribe())
    unsubscribeTrackEnded = []
    // renderMicStream() hijacked the host's options (interact, in scrolling
    // mode cursorWidth/normalize/maxPeak, in continuous mode an unset
    // minPxPerSec); restore just those keys when the mic session ends. The
    // record-end render path also restores (whichever runs first wins; the
    // other is a no-op) -- but without this, a preview-only startMic() ->
    // stopMic() or a renderRecordedAudio: false recording left the waveform
    // permanently non-interactive.
    applyOriginalOptionsIfNeeded()
    if (!stream) return
    stream.getTracks().forEach((track) => track.stop())
    stream = null
    mediaRecorder = null
  }

  const startRecording = async (deviceOptions?: RecordPluginDeviceOptions) => {
    const recordStream = stream || (await startMic(deviceOptions))
    dataWindow = null

    // Restarting: neutralize the previous recorder before stopping it.
    // MediaRecorder.stop() queues 'dataavailable' + 'stop' events that would
    // otherwise dispatch into the NEW session's handlers assigned below --
    // a stale foreign chunk corrupting the new blob, and a spurious
    // 'record-end' right after 'record-start'.
    const previousRecorder = mediaRecorder
    if (previousRecorder && previousRecorder.state !== 'inactive') {
      previousRecorder.ondataavailable = null
      previousRecorder.onpause = null
      previousRecorder.onstop = null
      previousRecorder.stop()
      frameScheduler.stop()
    }

    // A fresh recorder per session: reusing the old instance would keep its
    // queued events (and any stale handler state) attached to the new session.
    const recorder = new MediaRecorder(recordStream, {
      mimeType: options.mimeType || findSupportedMimeType(),
      audioBitsPerSecond: options.audioBitsPerSecond,
    })
    mediaRecorder = recorder

    const recordedChunks: BlobPart[] = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
      // A chunk queued before destroy() must not reach a re-initialized lifecycle
      if (!ctx.scope.disposed) ctx.emit('record-data-available', event.data)
    }

    const emitWithBlob = (ev: 'record-pause' | 'record-end') => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType })

      if (ctx.scope.disposed) {
        // destroy() stopped this recording (and the plugin may have been
        // re-initialized since): the live listeners are gone or belong to a
        // new lifecycle, so the final blob goes only to the listeners that
        // were subscribed at destroy(). Nothing is rendered: destroy() has
        // already done its own blob URL revocation pass.
        const listeners = ev === 'record-end' ? finalRecordEndListeners : null
        if (listeners) {
          finalRecordEndListeners = null
          listeners.forEach((listener) => {
            try {
              listener(blob)
            } catch (err) {
              console.error('Error in record-end listener during destroy teardown:', err)
            }
          })
        }
        return
      }

      ctx.emit(ev, blob)

      if (options.renderRecordedAudio) {
        applyOriginalOptionsIfNeeded()
        // Revoke previous blob URL before creating a new one
        if (recordedBlobUrl) {
          URL.revokeObjectURL(recordedBlobUrl)
        }
        recordedBlobUrl = URL.createObjectURL(blob)
        liveWavesurfer()?.load(recordedBlobUrl)
      }
    }

    recorder.onpause = () => emitWithBlob('record-pause')

    recorder.onstop = () => emitWithBlob('record-end')

    recorder.start(options.mediaRecorderTimeslice)
    lastStartTime = performance.now()
    lastDuration = 0
    duration = 0
    isWaveformPaused = false
    frameScheduler.start(tick)

    ctx.emit('record-start')
  }

  const isRecording = () => mediaRecorder?.state === 'recording'

  const isPaused = () => mediaRecorder?.state === 'paused'

  // Explicit existence check: with no recorder, `undefined !== 'inactive'`
  // would wrongly report an active recording on a fresh plugin.
  const isActive = () => !!mediaRecorder && mediaRecorder.state !== 'inactive'

  const stopRecording = () => {
    if (isActive()) {
      mediaRecorder?.stop()
      frameScheduler.stop()
    }
  }

  const pauseRecording = () => {
    if (isRecording()) {
      isWaveformPaused = true
      mediaRecorder?.requestData()
      mediaRecorder?.pause()
      frameScheduler.stop()
      // Progress ticks may be throttled while mic waveform draws continue.
      // Capture the actual recording time so resumed peaks keep advancing.
      lastDuration += performance.now() - lastStartTime
      duration = lastDuration
    }
  }

  const resumeRecording = () => {
    if (isPaused()) {
      isWaveformPaused = false
      mediaRecorder?.resume()
      lastStartTime = performance.now()
      frameScheduler.start(tick)
      ctx.emit('record-resume')
    }
  }

  const testInternals: TestInternals = {
    get frameScheduler() {
      return frameScheduler
    },
    get mediaRecorder() {
      return mediaRecorder
    },
    get stream() {
      return stream
    },
    tick,
  }

  return {
    renderMicStream,
    startMic,
    stopMic,
    startRecording,
    getDuration: () => duration,
    isRecording,
    isPaused,
    isActive,
    stopRecording,
    pauseRecording,
    resumeRecording,
    __recordInternalsForTests: () => testInternals,
  }
}

const Defined = definePlugin<RecordPluginOptions, RecordPluginEvents, RecordPluginApi>(
  'RecordPlugin',
  // The RecordPlugin constructor registers the host before it first runs setup
  (ctx, options) => setupRecord(ctx, options, hosts.get(options) as RecordHost),
)

/**
 * The definePlugin()-produced class, plus what definePlugin has no hook for:
 * - Setup runs in the constructor, not first on _init(): the recording methods
 *   work on a plugin that was never registered with a wavesurfer (they then
 *   just skip the waveform), as they always have. The first _init() adopts
 *   that lifecycle; an _init() after destroy() starts a fresh one.
 * - It tracks its 'record-end' subscriptions through the public on/un/unAll,
 *   so a recording stopped by destroy() can still hand its final blob (which
 *   MediaRecorder delivers asynchronously, after unAll) to the listeners that
 *   were subscribed at destroy().
 * - The options defaults, the static getAvailableAudioDevices().
 */
class RecordPlugin extends Defined {
  private recordEndListeners = new Set<RecordEndListener>()

  /** Create an instance of the Record plugin */
  constructor(options?: RecordPluginOptions) {
    const pluginOptions: RecordPluginOptions = {
      ...options,
      audioBitsPerSecond: options?.audioBitsPerSecond ?? DEFAULT_BITS_PER_SECOND,
      scrollingWaveform: options?.scrollingWaveform ?? false,
      scrollingWaveformWindow: options?.scrollingWaveformWindow ?? DEFAULT_SCROLLING_WAVEFORM_WINDOW,
      continuousWaveform: options?.continuousWaveform ?? false,
      renderRecordedAudio: options?.renderRecordedAudio ?? true,
      mediaRecorderTimeslice: options?.mediaRecorderTimeslice ?? undefined,
    }
    super(pluginOptions)
    hosts.set(pluginOptions, {
      onceRecordEnd: (listener) => this.once('record-end', listener),
      recordEndListeners: () => [...this.recordEndListeners],
    })
    super.onInit()
  }

  /** Create an instance of the Record plugin */
  public static create(options?: RecordPluginOptions) {
    return new RecordPlugin(options)
  }

  /** Get a list of available audio devices
   * You can use this to get the device ID of the microphone to use with the startMic and startRecording methods
   * Will return an empty array if the browser doesn't support the MediaDevices API or if the user has not granted access to the microphone
   * You can ask for permission to the microphone by calling startMic
   */
  public static async getAvailableAudioDevices() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => devices.filter((device) => device.kind === 'audioinput'))
  }

  protected onInit() {
    // The constructor already set up a lifecycle: keep it unless destroy()
    // ended it (its scope is then disposed)
    if (this.scope.disposed) super.onInit()
  }

  public on<EventName extends keyof RecordPluginEvents>(
    event: EventName,
    listener: (...args: RecordPluginEvents[EventName]) => void,
    options?: { once?: boolean },
  ): () => void {
    if (event !== 'record-end') return super.on(event, listener, options)
    const recordEndListener = listener as unknown as RecordEndListener
    // A once-listener is tracked by the function the emitter actually holds,
    // so un() -- which the wrapper calls on itself when it fires -- untracks it
    const registered: RecordEndListener = options?.once
      ? (blob) => {
          this.un('record-end', registered)
          recordEndListener(blob)
        }
      : recordEndListener
    this.recordEndListeners.add(registered)
    super.on('record-end', registered)
    return () => this.un('record-end', registered)
  }

  public un<EventName extends keyof RecordPluginEvents>(
    event: EventName,
    listener: (...args: RecordPluginEvents[EventName]) => void,
  ): void {
    super.un(event, listener)
    if (event === 'record-end') this.recordEndListeners.delete(listener as unknown as RecordEndListener)
  }

  public unAll(): void {
    super.unAll()
    this.recordEndListeners.clear()
  }
}

export default RecordPlugin
