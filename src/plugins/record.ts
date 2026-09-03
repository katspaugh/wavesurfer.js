/**
 * Record audio from the microphone with a real-time waveform preview
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import { FrameScheduler } from '../frame-scheduler.js'
import { Scope } from '../scope.js'
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
  /** The timeslice to use for the media recorder, defaults to 200ms */
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
  /** On every new recorded chunk */
  'record-data-available': [blob: Blob]
}

type MicStream = {
  onDestroy: () => void
  onEnd: () => void
}

const DEFAULT_BITS_PER_SECOND = 128000
const DEFAULT_SCROLLING_WAVEFORM_WINDOW = 5
const FPS = 100

const MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3']
const findSupportedMimeType = () => MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))

class RecordPlugin extends BasePlugin<RecordPluginEvents, RecordPluginOptions> {
  private stream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private dataWindow: Float32Array | null = null
  private isWaveformPaused = false
  private originalOptions?: Partial<WaveSurferOptions>
  private frameScheduler: FrameScheduler
  private lastStartTime = 0
  private lastDuration = 0
  private duration = 0
  private micStream: MicStream | null = null
  private unsubscribeRecordEnd?: () => void
  // Early-removal handles for the per-track 'ended' listeners registered in
  // startMic(). Registered via this.scope.listen(), so a full destroy()
  // (scope disposal) removes them even if stopMic() never ran; stopMic()
  // calls these to remove them on a normal stop.
  private unsubscribeTrackEnded: (() => void)[] = []
  private recordedBlobUrl: string | null = null
  // Snapshot of 'record-end' listeners taken at destroy() time when a recording is
  // still active. MediaRecorder.stop() fires 'onstop' via a queued task (async), so
  // by the time it runs, super.destroy() may have already cleared listeners via
  // unAll(); this lets the final blob still reach whoever was listening.
  private pendingFinalRecordEndListeners: Set<(...args: unknown[]) => void> | null = null

  // Bound once so it's the same function reference passed to
  // frameScheduler.start() regardless of which FrameScheduler instance is
  // currently live (see onInit()).
  private handleTick = () => {
    const currentTime = performance.now() - this.lastStartTime
    this.duration = this.isPaused() ? this.duration : this.lastDuration + currentTime
    this.emit('record-progress', this.duration)
  }

  /** Create an instance of the Record plugin */
  constructor(options: RecordPluginOptions) {
    super({
      ...options,
      audioBitsPerSecond: options.audioBitsPerSecond ?? DEFAULT_BITS_PER_SECOND,
      scrollingWaveform: options.scrollingWaveform ?? false,
      scrollingWaveformWindow: options.scrollingWaveformWindow ?? DEFAULT_SCROLLING_WAVEFORM_WINDOW,
      continuousWaveform: options.continuousWaveform ?? false,
      renderRecordedAudio: options.renderRecordedAudio ?? true,
      mediaRecorderTimeslice: options.mediaRecorderTimeslice ?? 200,
    })

    // Created against the constructor-time scope so startRecording() works
    // even if a caller never calls _init() (see record.test.ts). onInit()
    // below replaces this with a fresh instance on every (re-)init.
    this.frameScheduler = new FrameScheduler(this.scope)
  }

  protected onInit() {
    // Plugin re-init after destroy() is supported (destroy() -> _init(), see
    // record.test.ts): the chassis scope was disposed by destroy(), so
    // recreate it -- mirroring definePlugin's onInit() -- along with a fresh
    // FrameScheduler registered on it, so a post-re-init startRecording()/
    // resumeRecording() registers its stop() on the live scope.
    this.scope = new Scope()
    this.frameScheduler = new FrameScheduler(this.scope)
  }

  /** Create an instance of the Record plugin */
  public static create(options?: RecordPluginOptions) {
    return new RecordPlugin(options || {})
  }

  public renderMicStream(stream: MediaStream): MicStream {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    source.connect(analyser)

    // Use smaller FFT size for more responsive peak detection
    if (this.options.continuousWaveform || this.options.scrollingWaveform) {
      analyser.fftSize = 32
    }
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)

    let sampleIdx = 0

    if (this.wavesurfer) {
      this.originalOptions ??= {
        ...this.wavesurfer.options,
      }

      this.wavesurfer.options.interact = false
      if (this.options.scrollingWaveform) {
        this.wavesurfer.options.cursorWidth = 0
        // Use fixed max peak in scrolling mode to prevent "dancing" waveform
        this.wavesurfer.options.normalize = true
        this.wavesurfer.options.maxPeak = 1
      }
    }

    const drawWaveform = () => {
      if (this.isWaveformPaused) return

      analyser.getFloatTimeDomainData(dataArray)

      if (this.options.scrollingWaveform) {
        // Scrolling waveform - use peak values for smooth rendering
        const windowSize = Math.floor((this.options.scrollingWaveformWindow || 0) * FPS)

        // Calculate peak value from the current buffer
        let maxValue = 0
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i])
          if (value > maxValue) {
            maxValue = value
          }
        }

        if (!this.dataWindow) {
          this.dataWindow = new Float32Array(windowSize)
        }

        const tempArray = new Float32Array(windowSize)

        if (this.dataWindow && this.dataWindow.length > 0) {
          // Shift old data to the left, dropping the oldest sample
          const keepLength = windowSize - 1
          const oldData = this.dataWindow.slice(-keepLength)
          tempArray.set(oldData, 0)
        }

        // Add new peak value at the end
        tempArray[windowSize - 1] = maxValue
        this.dataWindow = tempArray
      } else if (this.options.continuousWaveform) {
        // Continuous waveform
        if (!this.dataWindow) {
          const size = this.options.continuousWaveformDuration
            ? Math.round(this.options.continuousWaveformDuration * FPS)
            : (this.wavesurfer?.getWidth() ?? 0) * window.devicePixelRatio
          this.dataWindow = new Float32Array(size)
        }

        let maxValue = 0
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i])
          if (value > maxValue) {
            maxValue = value
          }
        }

        if (sampleIdx + 1 > this.dataWindow.length) {
          const tempArray = new Float32Array(this.dataWindow.length * 2)
          tempArray.set(this.dataWindow, 0)
          this.dataWindow = tempArray
        }

        this.dataWindow[sampleIdx] = maxValue
        sampleIdx++
      } else {
        this.dataWindow = dataArray
      }

      // Render the waveform
      if (this.wavesurfer) {
        const totalDuration = (this.dataWindow?.length ?? 0) / FPS
        this.wavesurfer
          .load(
            '',
            [this.dataWindow],
            this.options.scrollingWaveform ? this.options.scrollingWaveformWindow : totalDuration,
          )
          .then(() => {
            if (this.wavesurfer && this.options.continuousWaveform) {
              this.wavesurfer.setTime(this.getDuration() / 1000)

              if (!this.wavesurfer.options.minPxPerSec) {
                this.wavesurfer.setOptions({
                  minPxPerSec: this.wavesurfer.getWidth() / this.wavesurfer.getDuration(),
                })
              }
            }
          })
          .catch((err) => {
            // Rapid re-renders supersede each other; a superseded load()
            // rejects with AbortError by design -- not an error here.
            if (err instanceof DOMException && err.name === 'AbortError') return
            console.error('Error rendering real-time recording data:', err)
          })
      }
    }

    // A child of the plugin's scope: startMic()/stopMic() can run several
    // times over the plugin's life, so these mic-specific resources need
    // their own disposable unit rather than living directly on this.scope.
    // Being a CHILD also means a full plugin destroy() (which disposes
    // this.scope) cascades to clean this up even if stopMic() was somehow
    // never called -- a backstop that replaces the previous once('destroy')
    // wiring, which relied on the same "destroy fires -> clean up mic"
    // relationship but had to be manually threaded through the event bus.
    const micScope = this.scope.child()
    // Registered before the interval so LIFO disposal clears the interval
    // first and only then disconnects/closes the audio graph, preserving the
    // original teardown order (stop drawing before tearing down what it reads).
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
        // teardown resource, so it stays wired through once('record-end')
        // below rather than the scope (see startMic()).
        this.isWaveformPaused = true
        this.stopMic()
      },
    }
  }

  /** Request access to the microphone and start monitoring incoming audio */
  public async startMic(options?: RecordPluginDeviceOptions): Promise<MediaStream> {
    // Stop previous mic stream if exists to clean up AudioContext
    if (this.micStream) {
      this.stopMic()
    }

    // Capture the lifecycle generation BEFORE awaiting: destroy() disposes
    // this.scope, and a subsequent _init() re-init both resets `destroyed`
    // and replaces the scope -- so `this.destroyed` alone cannot detect a
    // destroy that happened while the permission prompt was up if a re-init
    // followed it. The captured scope is disposed in either case.
    const requestScope = this.scope

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options ?? true,
      })
    } catch (err) {
      throw new Error('Error accessing the microphone: ' + (err as Error).message)
    }

    // The plugin may have been destroyed (and possibly re-initialized) while
    // the permission prompt was up. Without this guard the stream (and the
    // AudioContext + render interval renderMicStream would attach to the
    // current scope) would leak into the wrong lifecycle -- the tab's
    // recording indicator stays on with no way to stop it.
    if (this.destroyed || requestScope.disposed) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('The plugin was destroyed while requesting the microphone')
    }

    const micStream = this.renderMicStream(stream)
    this.micStream = micStream
    this.unsubscribeRecordEnd = this.once('record-end', micStream.onEnd)
    this.stream = stream

    // Detect the capture device disappearing mid-session (e.g. a Bluetooth
    // headset powering off, a dock being unplugged): the track then fires
    // 'ended' on its own. Note that our own track.stop() calls (stopMic)
    // do NOT fire 'ended', so this only catches external loss. Registered
    // on the live scope so destroy() removes the listeners as a backstop;
    // stopMic() removes them early on a normal stop.
    this.unsubscribeTrackEnded = stream
      .getTracks()
      .map((track) => this.scope.listen(track, 'ended', () => this.handleTrackEnded()))

    return stream
  }

  /**
   * A capture track ended on its own (device lost) rather than via our own
   * track.stop() calls. Stop gracefully: the recorder's onstop still delivers
   * the final blob through 'record-end', and 'record-ended-externally' lets
   * the app tell this apart from a user-initiated stop.
   */
  private handleTrackEnded() {
    if (this.isActive()) {
      // Covers both recording and paused states. Emit before stopping so the
      // app can update its UI knowing the 'record-end' that follows (async,
      // from the recorder's queued onstop) was not user-initiated.
      this.emit('record-ended-externally')
      this.stopRecording()
      // stopMic() (mic teardown, track-listener removal, option restore)
      // runs via the once('record-end') subscription when onstop fires.
    } else {
      // Preview-only mic session (startMic without a recording): the device
      // is gone, so tear down the monitoring instead of freezing silently.
      this.stopMic()
    }
  }

  /** Stop monitoring incoming audio */
  public stopMic() {
    this.micStream?.onDestroy()
    this.unsubscribeRecordEnd?.()
    this.micStream = null
    this.unsubscribeRecordEnd = undefined
    // Remove the per-track 'ended' listeners before stopping the tracks.
    // track.stop() doesn't fire 'ended', so this is about not leaking
    // listeners across mic sessions, not about suppressing a spurious event.
    this.unsubscribeTrackEnded.forEach((unsubscribe) => unsubscribe())
    this.unsubscribeTrackEnded = []
    // renderMicStream() hijacked the host's options (interact, and in
    // scrolling mode cursorWidth/normalize/maxPeak); restore them when the
    // mic session ends. The record-end render path also restores (whichever
    // runs first wins; the other is a no-op) -- but without this, a
    // preview-only startMic() -> stopMic() or a renderRecordedAudio: false
    // recording left the waveform permanently non-interactive.
    this.applyOriginalOptionsIfNeeded()
    if (!this.stream) return
    this.stream.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.mediaRecorder = null
  }

  /**
   * Start recording audio from the microphone.
   *
   * Calling this while a recording is already active restarts: the previous
   * session is discarded (no 'record-end' is emitted for it -- call
   * stopRecording() first if you want its final blob).
   */
  public async startRecording(options?: RecordPluginDeviceOptions) {
    const stream = this.stream || (await this.startMic(options))
    this.dataWindow = null

    // Restarting: neutralize the previous recorder before stopping it.
    // MediaRecorder.stop() queues 'dataavailable' + 'stop' events that would
    // otherwise dispatch into the NEW session's handlers assigned below --
    // a stale foreign chunk corrupting the new blob, and a spurious
    // 'record-end' right after 'record-start'.
    const previousRecorder = this.mediaRecorder
    if (previousRecorder && previousRecorder.state !== 'inactive') {
      previousRecorder.ondataavailable = null
      previousRecorder.onpause = null
      previousRecorder.onstop = null
      previousRecorder.stop()
      this.frameScheduler.stop()
    }

    // A fresh recorder per session: reusing the old instance would keep its
    // queued events (and any stale handler state) attached to the new session.
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: this.options.mimeType || findSupportedMimeType(),
      audioBitsPerSecond: this.options.audioBitsPerSecond,
    })
    this.mediaRecorder = mediaRecorder

    // The lifecycle generation this recording session belongs to. destroy()
    // -> _init() replaces this.scope, so emitWithBlob (which can run from a
    // MediaRecorder event queued BEFORE destroy but delivered after a
    // re-init, when `destroyed` is false again) compares against this to
    // avoid emitting the old session's record-end -- or loading its blob --
    // into the new lifecycle.
    const sessionScope = this.scope

    const recordedChunks: BlobPart[] = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
      this.emit('record-data-available', event.data)
    }

    const emitWithBlob = (ev: 'record-pause' | 'record-end') => {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType })
      // True when destroy() -> _init() re-initialized the plugin after this
      // session's recorder events were queued: the new lifecycle must not
      // receive the old session's events or blob.
      const staleLifecycle = this.scope !== sessionScope
      if (!staleLifecycle) {
        this.emit(ev, blob)
      }
      if (ev === 'record-end' && this.pendingFinalRecordEndListeners) {
        const snapshot = this.pendingFinalRecordEndListeners
        this.pendingFinalRecordEndListeners = null
        // Redeliver when the live emit above could not reach these listeners:
        // the plugin fully tore down (unAll ran), or it was re-initialized
        // into a new lifecycle (stale-lifecycle emit suppressed). Otherwise
        // this.emit(ev, blob) already reached them live, and redelivering
        // would double-fire.
        if (this.destroyed || staleLifecycle) {
          snapshot.forEach((listener) => {
            try {
              listener(blob)
            } catch (err) {
              console.error('Error in record-end listener during destroy teardown:', err)
            }
          })
        }
      }
      // Guard against onstop firing after destroy() has already run (it's a queued
      // microtask, so it can land after destroy() returns -- see the test above).
      // Without this, a post-destroy onstop would create a fresh blob URL via
      // createObjectURL() that nothing ever revokes, since destroy() has already
      // done its own revocation pass and this code path runs after that.
      if (this.options.renderRecordedAudio && !this.destroyed && !staleLifecycle) {
        this.applyOriginalOptionsIfNeeded()
        // Revoke previous blob URL before creating a new one
        if (this.recordedBlobUrl) {
          URL.revokeObjectURL(this.recordedBlobUrl)
        }
        this.recordedBlobUrl = URL.createObjectURL(blob)
        this.wavesurfer?.load(this.recordedBlobUrl)
      }
    }

    mediaRecorder.onpause = () => emitWithBlob('record-pause')

    mediaRecorder.onstop = () => emitWithBlob('record-end')

    mediaRecorder.start(this.options.mediaRecorderTimeslice)
    this.lastStartTime = performance.now()
    this.lastDuration = 0
    this.duration = 0
    this.isWaveformPaused = false
    this.frameScheduler.start(this.handleTick)

    this.emit('record-start')
  }

  /** Get the duration of the recording */
  public getDuration(): number {
    return this.duration
  }

  /** Check if the audio is being recorded */
  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  public isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused'
  }

  public isActive(): boolean {
    // Explicit existence check: with no recorder, `undefined !== 'inactive'`
    // would wrongly report an active recording on a fresh plugin.
    return !!this.mediaRecorder && this.mediaRecorder.state !== 'inactive'
  }

  /** Stop the recording */
  public stopRecording() {
    if (this.isActive()) {
      this.mediaRecorder?.stop()
      this.frameScheduler.stop()
    }
  }

  /** Pause the recording */
  public pauseRecording() {
    if (this.isRecording()) {
      this.isWaveformPaused = true
      this.mediaRecorder?.requestData()
      this.mediaRecorder?.pause()
      this.frameScheduler.stop()
      this.lastDuration = this.duration
    }
  }

  /** Resume the recording */
  public resumeRecording() {
    if (this.isPaused()) {
      this.isWaveformPaused = false
      this.mediaRecorder?.resume()
      this.lastStartTime = performance.now()
      this.frameScheduler.start(this.handleTick)
      this.emit('record-resume')
    }
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

  /** Destroy the plugin */
  public destroy() {
    this.applyOriginalOptionsIfNeeded()

    // If a recording is still active, MediaRecorder.stop() below will fire 'onstop'
    // asynchronously (a queued task) — after this synchronous destroy() call (and
    // its super.destroy()) has already returned and cleared listeners via unAll().
    // Snapshot the current 'record-end' listeners now, while they're still live, so
    // emitWithBlob() can still deliver the final blob to them later.
    if (this.mediaRecorder && (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused')) {
      // Reaching into EventEmitter's private `listeners` map is an intentional escape
      // hatch: it's the only way to preserve delivery across the async onstop boundary.
      const listeners = (this as unknown as { listeners?: Record<string, Set<(...args: unknown[]) => void>> })
        .listeners?.['record-end']
      this.pendingFinalRecordEndListeners = listeners ? new Set(listeners) : null
    }

    // Stop recording/mic first so any resulting 'record-end' reaches
    // listeners before super.destroy() clears them (unAll).
    this.stopRecording()
    this.stopMic()
    // Unconditional (stopRecording() above only stops when isActive()):
    // matches the old Timer.destroy()'s behavior of always stopping the
    // tick loop regardless of recording state. Idempotent if already
    // stopped.
    this.frameScheduler.stop()
    // Revoke blob URL to free memory
    if (this.recordedBlobUrl) {
      URL.revokeObjectURL(this.recordedBlobUrl)
      this.recordedBlobUrl = null
    }
    // super.destroy() disposes this.scope (frameScheduler's stop() disposer
    // -- already stopped above, only a backstop -- and any mic child scope
    // still attached; normally none, stopMic() above already disposed it).
    // Re-init after destroy() recreates the scope in onInit().
    super.destroy()
  }

  private applyOriginalOptionsIfNeeded() {
    if (this.wavesurfer && this.originalOptions) {
      this.wavesurfer.setOptions(this.originalOptions)
      delete this.originalOptions
    }
  }
}

export default RecordPlugin
