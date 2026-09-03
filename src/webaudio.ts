import EventEmitter from './event-emitter.js'
import { Scope } from './scope.js'

type WebAudioPlayerEvents = {
  loadedmetadata: []
  canplay: []
  play: []
  pause: []
  seeking: []
  seeked: []
  timeupdate: []
  volumechange: []
  emptied: []
  ended: []
  error: [error: Error]
}

function setWebAudioSessionPlayback() {
  const navigator = globalThis.navigator as (Navigator & { audioSession?: { type: string } }) | undefined
  if (!navigator?.audioSession) return

  try {
    navigator.audioSession.type = 'playback'
  } catch (e) {
    console.warn('Setting navigator.audioSession.type failed:', e)
  }
}

/**
 * A Web Audio buffer player emulating the behavior of an HTML5 Audio element.
 *
 * Note: This class does not manage blob: URLs. If you pass a blob: URL to setSrc(),
 * you are responsible for revoking it when done. The Player class (player.ts) handles
 * blob URL lifecycle management automatically.
 */
class WebAudioPlayer extends EventEmitter<WebAudioPlayerEvents> {
  private audioContext: AudioContext
  private gainNode: GainNode
  private bufferNode: AudioBufferSourceNode | null = null
  private playStartTime = 0
  private playbackPosition = 0
  private _muted = false
  private _playbackRate = 1
  private _duration: number | undefined = undefined
  private buffer: AudioBuffer | null = null
  public currentSrc = ''
  public paused = true
  public crossOrigin: string | null = null
  public seeking = false
  public autoplay = false
  public error: Error | null = null
  // Owns only the one-shot 'ended' listener registered in stopAt() below (the
  // raw-acquisition ESLint ban requires it go through Scope); disposed in
  // destroy(). Everything else in this class is cleaned up manually because
  // it isn't a DOM/timer/observer resource the ban covers.
  private scope = new Scope()

  constructor(audioContext?: AudioContext) {
    super()
    setWebAudioSessionPlayback()
    this.audioContext = audioContext || new AudioContext()
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  addEventListener = this.on

  /** Unsubscribe from an event */
  removeEventListener = this.un

  async load() {
    return
  }

  /** For compatibility with HTMLMediaElement.remove(). Delegates to destroy(). */
  remove() {
    this.destroy()
  }

  private _destroyed = false
  // Guards the src setter's async fetch/decode chain: each src assignment (and
  // destroy()) bumps the generation, so a stale chain can never apply its
  // decoded buffer -- even when the same URL is assigned again later.
  private srcGeneration = 0
  private srcFetchAbort: AbortController | null = null

  /** Clean up all resources. Idempotent — safe to call multiple times. */
  destroy() {
    if (this._destroyed) return
    this._destroyed = true

    // Tear down the stopAt() 'ended' listener, if any is pending
    this.scope.dispose()

    // Invalidate and abort any in-flight fetch/decode chain
    this.srcGeneration++
    this.srcFetchAbort?.abort()
    this.srcFetchAbort = null
    this.currentSrc = ''

    // Stop and disconnect buffer node
    if (this.bufferNode) {
      this.bufferNode.onended = null
      try {
        this.bufferNode.stop()
      } catch {
        // Ignore InvalidStateError if node already stopped
      }
      this.bufferNode.disconnect()
      this.bufferNode = null
    }

    // Disconnect gain node
    this.gainNode.disconnect()

    // Close audio context (returns a promise, catch rejection if already closed)
    // Guard with typeof check for mock environments where close may not exist
    if (typeof this.audioContext.close === 'function') {
      Promise.resolve(this.audioContext.close.call(this.audioContext)).catch(() => undefined)
    }

    // Clear buffer reference
    this.buffer = null

    // Clear all event listeners
    this.unAll()
  }

  get src() {
    return this.currentSrc
  }

  set src(value: string) {
    this.currentSrc = value
    this._duration = undefined
    // A new load starts with a clean slate, like HTMLMediaElement.error
    this.error = null

    // Invalidate any in-flight fetch/decode chain for a previous assignment.
    // A generation check (not a URL comparison) so that re-setting the SAME
    // URL (A -> B -> A) can't let the stale first chain apply its result, and
    // abort the previous network request outright instead of just ignoring it.
    const generation = ++this.srcGeneration
    this.srcFetchAbort?.abort()
    this.srcFetchAbort = null

    if (!value) {
      this.buffer = null
      this.emit('emptied')
      return
    }

    const abortController = new AbortController()
    this.srcFetchAbort = abortController

    fetch(value, { signal: abortController.signal })
      .then((response) => {
        if (response.status >= 400) {
          throw new Error(`Failed to fetch ${value}: ${response.status} (${response.statusText})`)
        }
        return response.arrayBuffer()
      })
      .then((arrayBuffer) => {
        if (generation !== this.srcGeneration) return null
        return this.audioContext.decodeAudioData(arrayBuffer)
      })
      .then((audioBuffer) => {
        if (generation !== this.srcGeneration) return

        this.buffer = audioBuffer

        this.emit('loadedmetadata')
        this.emit('canplay')

        if (this.autoplay) this.play()
      })
      .catch((err) => {
        if (generation !== this.srcGeneration) return // stale request lost the race
        // Emit error for proper error handling
        console.error('WebAudioPlayer load error:', err)
        this.error = err instanceof Error ? err : new Error(String(err))
        this.emit('error', this.error)
      })
  }

  private _play() {
    if (!this.paused) return
    this.paused = false

    // Clean up old buffer node completely before creating new one
    if (this.bufferNode) {
      this.bufferNode.onended = null
      this.bufferNode.disconnect()
    }

    this.bufferNode = this.audioContext.createBufferSource()
    if (this.buffer) {
      this.bufferNode.buffer = this.buffer
    }
    this.bufferNode.playbackRate.value = this._playbackRate
    this.bufferNode.connect(this.gainNode)

    let currentPos = this.playbackPosition
    if (currentPos >= this.duration || currentPos < 0) {
      currentPos = 0
      this.playbackPosition = 0
    }

    this.bufferNode.start(this.audioContext.currentTime, currentPos)
    this.playStartTime = this.audioContext.currentTime

    this.bufferNode.onended = () => {
      if (!this.paused && this.duration - this.currentTime < 0.01) {
        this.pause()
        this.emit('ended')
      }
    }
  }

  private _pause() {
    this.playbackPosition = this.currentTime
    this.paused = true
    // Clear onended before stopping to prevent spurious 'ended' event
    if (this.bufferNode) {
      this.bufferNode.onended = null
      try {
        this.bufferNode.stop()
      } catch {
        // Ignore InvalidStateError if node already stopped
      }
    }
  }

  async play() {
    if (!this.paused) return
    // An AudioContext created without a user gesture starts suspended
    // (autoplay policy); starting a buffer node on it "plays" silently.
    // Not awaited: the context clock doesn't advance while suspended, so the
    // node start below is queued correctly, and 'play' stays synchronous.
    if (this.audioContext.state === 'suspended' && typeof this.audioContext.resume === 'function') {
      this.audioContext.resume().catch(() => undefined)
    }
    this._play()
    this.emit('play')
  }

  pause() {
    if (this.paused) return
    this._pause()
    this.emit('pause')
  }

  stopAt(timeSeconds: number) {
    // The stop is scheduled on the AudioContext clock, so convert the remaining
    // media time to real time via the playback rate
    const delay = (timeSeconds - this.currentTime) / this._playbackRate
    const currentBufferNode = this.bufferNode
    // A stop time already in the past would make AudioScheduledSourceNode.stop()
    // throw a RangeError -- clamp to "now" (stop immediately) instead.
    currentBufferNode?.stop(this.audioContext.currentTime + Math.max(0, delay))

    if (currentBufferNode) {
      // Each stopAt() call adds one more disposer to this.scope, even though the `{ once: true }`
      // listener below removes itself from the DOM node once it fires - Scope.listen()'s own
      // bookkeeping doesn't know about `once` and only prunes disposers on an explicit early-remove
      // or scope.dispose(). This does not unbounded-leak in practice: it's bounded by how many
      // times a single WebAudioPlayer instance has stopAt() called on it over its lifetime (not by
      // audio duration or playback time), and the whole array - including any already-fired
      // no-op removeEventListener entries - is pruned in one shot by destroy()'s scope.dispose().
      this.scope.listen(
        currentBufferNode,
        'ended',
        () => {
          if (currentBufferNode === this.bufferNode) {
            this.bufferNode = null
            this.pause()
            // The 'ended' event fires with some latency, so clamp the reported
            // position to the exact stop time
            this.playbackPosition = Math.min(timeSeconds, this.duration)
            this.emit('timeupdate')
          }
        },
        { once: true },
      )
    }
  }

  async setSinkId(deviceId: string) {
    const ac = this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> }
    return ac.setSinkId(deviceId)
  }

  get playbackRate() {
    return this._playbackRate
  }
  set playbackRate(value) {
    const wasPlaying = !this.paused
    if (wasPlaying) this._pause()
    this._playbackRate = value
    if (wasPlaying) this._play()

    if (this.bufferNode) {
      this.bufferNode.playbackRate.value = value
    }
  }

  get currentTime() {
    return this.paused
      ? this.playbackPosition
      : this.playbackPosition + (this.audioContext.currentTime - this.playStartTime) * this._playbackRate
  }
  set currentTime(value) {
    const wasPlaying = !this.paused

    if (wasPlaying) this._pause()
    this.playbackPosition = value
    if (wasPlaying) this._play()

    // Seeks in a buffer player are instantaneous, so 'seeked' follows
    // 'seeking' immediately. Without it, Player's seeking-state bridge
    // (set true on 'seeking', cleared only on 'seeked') sticks forever.
    this.emit('seeking')
    this.emit('seeked')
    this.emit('timeupdate')
  }

  get duration() {
    return this._duration ?? (this.buffer?.duration || 0)
  }
  set duration(value: number) {
    this._duration = value
  }

  get volume() {
    return this.gainNode.gain.value
  }
  set volume(value) {
    this.gainNode.gain.value = value
    this.emit('volumechange')
  }

  get muted() {
    return this._muted
  }
  set muted(value: boolean) {
    if (this._muted === value) return
    this._muted = value

    if (this._muted) {
      this.gainNode.disconnect()
    } else {
      this.gainNode.connect(this.audioContext.destination)
    }
  }

  public canPlayType(mimeType: string) {
    return /^(audio|video)\//.test(mimeType)
  }

  /** Get the GainNode used to play the audio. Can be used to attach filters. */
  public getGainNode(): GainNode {
    return this.gainNode
  }

  /** Get decoded audio */
  public getChannelData(): Float32Array[] {
    const channels: Float32Array[] = []
    if (!this.buffer) return channels
    const numChannels = this.buffer.numberOfChannels
    for (let i = 0; i < numChannels; i++) {
      channels.push(this.buffer.getChannelData(i))
    }
    return channels
  }

  /**
   * Imitate `HTMLElement.removeAttribute` for compatibility with `Player`.
   */
  public removeAttribute(attrName: string) {
    switch (attrName) {
      case 'src':
        this.src = ''
        break
      case 'playbackRate':
        this.playbackRate = 0
        break
      case 'currentTime':
        this.currentTime = 0
        break
      case 'duration':
        this.duration = 0
        break
      case 'volume':
        this.volume = 0
        break
      case 'muted':
        this.muted = false
        break
    }
  }
}

export default WebAudioPlayer
