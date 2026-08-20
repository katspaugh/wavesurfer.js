import EventEmitter, { type GeneralEventTypes } from './event-emitter.js'
import { signal, type WritableSignal } from './reactive/store.js'
import { Scope } from './scope.js'

type PlayerOptions = {
  media?: HTMLMediaElement
  mediaControls?: boolean
  autoplay?: boolean
  playbackRate?: number
}

const HAVE_FUTURE_DATA = 3

class Player<T extends GeneralEventTypes> extends EventEmitter<T> {
  protected media: HTMLMediaElement
  private isExternalMedia = false
  private _ownBlobUrl: string | null = null

  // Reactive state - make media state observable
  private _isPlaying: WritableSignal<boolean>
  private _currentTime: WritableSignal<number>
  private _duration: WritableSignal<number>
  private _volume: WritableSignal<number>
  private _muted: WritableSignal<boolean>
  private _playbackRate: WritableSignal<number>
  private _seeking: WritableSignal<boolean>
  // WebKit can discard or corrupt a seek made before the media can play.
  private pendingTime: number | null = null
  // Note: Player has no separate "root" scope of its own -- mediaScope IS its
  // whole ownership tree. (A wrapper root named `scope`, as a plain mechanical
  // reading of the plan might suggest, would collide with WaveSurfer's own
  // `scope` field of the same name: TS rejects two classes in an extends
  // chain declaring a same-named field with different visibility (TS2415),
  // and even reconciling visibility wouldn't help since it's a single
  // storage slot per instance -- WaveSurfer's field initializer would run
  // after Player's and silently stomp the reference Player already captured
  // for mediaScope's parent. Keeping Player's and WaveSurfer's scopes as two
  // independent trees also matches their pre-existing independence: neither
  // class's cleanup array was ever connected to the other's.)
  private mediaScope = new Scope()
  // setupReactiveMediaEvents() only ever ran from the constructor,
  // historically -- but destroy() disposes+recreates mediaScope (see below),
  // and WaveSurfer's destroy() -> load() reuse contract means the reactive
  // media-signal bridge needs reviving too. ensureMediaEvents() makes that
  // idempotent: the constructor calls it, and WaveSurfer's own
  // ensureCoreEvents() (called at the top of loadAudio()) calls it again
  // post-destroy; destroy() flips the flag back off so the next call revives
  // the bridge. setMediaElement() is a separate, unconditional path (it must
  // always rebind to the NEW element, flag or no) -- it calls
  // setupReactiveMediaEvents() directly and marks the flag true afterward so
  // a later ensureMediaEvents() call (e.g. from a subsequent loadAudio())
  // doesn't double-register on top of it.
  private mediaEventsInitialized = false

  // Expose reactive state as writable signals
  // These are writable to allow WaveSurfer to compose them into centralized state
  public get isPlayingSignal(): WritableSignal<boolean> {
    return this._isPlaying
  }
  public get currentTimeSignal(): WritableSignal<number> {
    return this._currentTime
  }
  public get durationSignal(): WritableSignal<number> {
    return this._duration
  }
  public get volumeSignal(): WritableSignal<number> {
    return this._volume
  }
  public get mutedSignal(): WritableSignal<boolean> {
    return this._muted
  }
  public get playbackRateSignal(): WritableSignal<number> {
    return this._playbackRate
  }
  public get seekingSignal(): WritableSignal<boolean> {
    return this._seeking
  }

  constructor(options: PlayerOptions) {
    super()

    if (options.media) {
      this.media = options.media
      this.isExternalMedia = true
    } else {
      this.media = document.createElement('audio')
    }

    // Initialize reactive state
    this._isPlaying = signal(false)
    this._currentTime = signal(0)
    this._duration = signal(0)
    this._volume = signal(this.media.volume)
    this._muted = signal(this.media.muted)
    this._playbackRate = signal(this.media.playbackRate || 1)
    this._seeking = signal(false)

    // Setup reactive media event handlers
    this.ensureMediaEvents()

    // Controls
    if (options.mediaControls) {
      this.media.controls = true
    }
    // Autoplay
    if (options.autoplay) {
      this.media.autoplay = true
    }
    // Speed
    if (options.playbackRate != null) {
      this.onMediaEvent(
        'canplay',
        () => {
          if (options.playbackRate != null) {
            this.media.playbackRate = options.playbackRate
          }
        },
        { once: true },
      )
    }
  }

  /**
   * Idempotently (re)establishes the reactive media-event bridge (see
   * mediaEventsInitialized above). Safe to call any number of times --
   * a no-op once already initialized until destroy() resets the flag.
   */
  protected ensureMediaEvents(): void {
    if (this.mediaEventsInitialized) return
    this.mediaEventsInitialized = true
    this.setupReactiveMediaEvents()
  }

  /**
   * Setup reactive media event handlers that update signals
   * This bridges the imperative HTMLMediaElement API to reactive state
   */
  private setupReactiveMediaEvents() {
    // Playing state
    this.mediaScope.add(
      this.onMediaEvent('play', () => {
        this._isPlaying.set(true)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('pause', () => {
        this._isPlaying.set(false)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('ended', () => {
        this._isPlaying.set(false)
      }),
    )

    // Time tracking
    this.mediaScope.add(
      this.onMediaEvent('timeupdate', () => {
        this._currentTime.set(this.media.currentTime)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('durationchange', () => {
        this._duration.set(this.media.duration || 0)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('loadedmetadata', () => {
        this._duration.set(this.media.duration || 0)
      }),
    )

    this.mediaScope.add(this.onMediaEvent('canplay', () => this.applyPendingTime()))

    // Seeking state
    this.mediaScope.add(
      this.onMediaEvent('seeking', () => {
        if (this.pendingTime != null && Math.abs(this.media.currentTime - this.pendingTime) > 0.01) {
          this.pendingTime = null
        }
        this._seeking.set(true)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('seeked', () => {
        this._seeking.set(false)
      }),
    )

    // Volume and muted
    this.mediaScope.add(
      this.onMediaEvent('volumechange', () => {
        this._volume.set(this.media.volume)
        this._muted.set(this.media.muted)
      }),
    )

    // Playback rate
    this.mediaScope.add(
      this.onMediaEvent('ratechange', () => {
        this._playbackRate.set(this.media.playbackRate)
      }),
    )
  }

  protected onMediaEvent<K extends keyof HTMLElementEventMap>(
    event: K,
    callback: (ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    // This IS player.ts's own listener-registration primitive for HTMLMediaElement events (mirrors
    // scope.listen's add/remove pairing); every caller registers the returned remover on mediaScope
    // (a real Scope) itself (see the constructor above).
    // eslint-disable-next-line no-restricted-syntax
    this.media.addEventListener(event, callback, options)
    return () => this.media.removeEventListener(event, callback, options)
  }

  protected getSrc() {
    return this.media.currentSrc || this.media.src || ''
  }

  private revokeSrc() {
    // Only revoke blob URLs that we created (not ones owned by external callers)
    if (this._ownBlobUrl) {
      URL.revokeObjectURL(this._ownBlobUrl)
      this._ownBlobUrl = null
    }
  }

  private canPlayType(type: string): boolean {
    return this.media.canPlayType(type) !== ''
  }

  private applyPendingTime(): void {
    if (this.pendingTime == null) return
    const time = this.pendingTime
    this.media.currentTime = time
    this.pendingTime = null
  }

  protected setSrc(url: string, blob?: Blob) {
    const prevSrc = this.getSrc()
    if (url && prevSrc === url) return // no need to change the source

    this.revokeSrc()
    const newSrc = blob instanceof Blob && (this.canPlayType(blob.type) || !url) ? URL.createObjectURL(blob) : url
    this.pendingTime = null

    // Track blob URLs we created so we can revoke them on destroy
    if (newSrc !== url) {
      this._ownBlobUrl = newSrc
    }

    // Reset the media element, otherwise it keeps the previous source
    if (prevSrc) {
      this.media.removeAttribute('src')
    }

    if (newSrc || url) {
      try {
        this.media.src = newSrc
      } catch {
        this.media.src = url
      }
    }
  }

  protected destroy() {
    this.pendingTime = null
    // Cleanup reactive media event listeners
    this.mediaScope.dispose()
    // Player instances are reused after destroy (see WaveSurfer's loadAudio
    // comment about issue #3637). setMediaElement() already disposes and
    // replaces mediaScope unconditionally at its own start, so this isn't
    // strictly required for that path -- it's here for consistency /
    // defensiveness, so a destroyed-but-reused Player is never left holding
    // a disposed scope that would silently no-op (or immediately re-run)
    // anything registered on it before setMediaElement() is called again.
    this.mediaScope = new Scope()
    // Flip so the next ensureMediaEvents() call (constructor never runs
    // again, but WaveSurfer's ensureCoreEvents() -- called from loadAudio()
    // -- does) revives the reactive media-signal bridge just torn down above.
    this.mediaEventsInitialized = false

    // Revoke blob URLs that we created
    this.revokeSrc()

    // Clear all event emitter listeners
    this.unAll()

    if (this.isExternalMedia) return
    this.media.pause()
    this.media.removeAttribute('src')
    // Load resets the media element to its initial state
    this.media.load()
    // Remove from DOM after cleanup
    this.media.remove()
  }

  protected setMediaElement(element: HTMLMediaElement) {
    this.pendingTime = null
    // Cleanup reactive event listeners from old media element
    this.mediaScope.dispose()
    this.mediaScope = new Scope()

    // Set new media element
    this.media = element

    // Reinitialize reactive event listeners on new media element. This is
    // unconditional (bypassing ensureMediaEvents()'s flag guard) because the
    // element itself changed -- the bridge must always rebind, regardless of
    // whether it was already "initialized" for the old element. Mark the
    // flag true afterward so a later ensureMediaEvents() call (e.g. from
    // WaveSurfer's ensureCoreEvents() at the top of a subsequent loadAudio(),
    // for a destroy() -> setMediaElement() -> load() sequence) sees the
    // bridge as already live and doesn't double-register on top of it.
    this.setupReactiveMediaEvents()
    this.mediaEventsInitialized = true
  }

  /** Start playing the audio */
  public async play(): Promise<void> {
    try {
      if (this.media.readyState >= HAVE_FUTURE_DATA) this.applyPendingTime()
      const result = await this.media.play()
      // A resolved play promise means playback is possible. `canplay` normally
      // applies the seek first; this also supports custom media implementations.
      this.applyPendingTime()
      return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      throw err
    }
  }

  /** Pause the audio */
  public pause(): void {
    this.media.pause()
  }

  /** Check if the audio is playing */
  public isPlaying(): boolean {
    return !this.media.paused && !this.media.ended
  }

  /** Jump to a specific time in the audio (in seconds) */
  public setTime(time: number) {
    const currentTime = Math.max(0, Math.min(time, this.getDuration()))
    if (this.media.readyState < HAVE_FUTURE_DATA) {
      this.pendingTime = currentTime
      return
    }
    this.pendingTime = null
    this.media.currentTime = currentTime
  }

  /** Get the duration of the audio in seconds */
  public getDuration(): number {
    return this.media.duration
  }

  /** Get the current audio position in seconds */
  public getCurrentTime(): number {
    return this.pendingTime ?? this.media.currentTime
  }

  /** Get the audio volume */
  public getVolume(): number {
    return this.media.volume
  }

  /** Set the audio volume */
  public setVolume(volume: number) {
    this.media.volume = volume
  }

  /** Get the audio muted state */
  public getMuted(): boolean {
    return this.media.muted
  }

  /** Mute or unmute the audio */
  public setMuted(muted: boolean) {
    this.media.muted = muted
  }

  /** Get the playback speed */
  public getPlaybackRate(): number {
    return this.media.playbackRate
  }

  /** Check if the audio is seeking */
  public isSeeking(): boolean {
    return this.media.seeking
  }

  /** Set the playback speed, pass an optional false to NOT preserve the pitch */
  public setPlaybackRate(rate: number, preservePitch?: boolean) {
    // preservePitch is true by default in most browsers
    if (preservePitch != null) {
      this.media.preservesPitch = preservePitch
    }
    this.media.playbackRate = rate
  }

  /** Get the HTML media element */
  public getMediaElement(): HTMLMediaElement {
    return this.media
  }

  /** Set a sink id to change the audio output device */
  public setSinkId(sinkId: string): Promise<void> {
    // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId
    const media = this.media as HTMLAudioElement & { setSinkId: (sinkId: string) => Promise<void> }
    return media.setSinkId(sinkId)
  }
}

export default Player
