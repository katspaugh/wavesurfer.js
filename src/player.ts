import { signal, type WritableSignal } from './reactive/store.js'
import { Scope } from './scope.js'
import type WebAudioPlayer from './webaudio.js'

type PlayerOptions = {
  media?: HTMLMediaElement | WebAudioPlayer
  mediaControls?: boolean
  autoplay?: boolean
  playbackRate?: number
}

const HAVE_FUTURE_DATA = 3

class Player {
  private media: HTMLMediaElement
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
  // Player has no separate "root" scope of its own -- mediaScope IS its whole
  // ownership tree: everything Player owns is a media-event bridge that is
  // torn down (and, on setMediaElement, rebuilt) together.
  private mediaScope = new Scope()

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
    if (options.media) {
      // The ONE acknowledged duck-typing boundary: WebAudioPlayer implements the
      // full HTMLMediaElement surface Player touches (add/removeEventListener,
      // play/pause/load/remove, src/currentSrc, currentTime, duration, volume,
      // muted, playbackRate, paused, ended, seeking, readyState via undefined
      // -> treated as 0, canPlayType, removeAttribute). Everywhere else the
      // types are honest -- do not add further casts between the two.
      this.media = options.media as HTMLMediaElement
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
    this.setupReactiveMediaEvents()

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
      // Registered on mediaScope like every other media listener: with an
      // external media element that never fires 'canplay', an unregistered
      // one-shot listener would survive destroy().
      this.mediaScope.add(
        this.onMediaEvent(
          'canplay',
          () => {
            if (options.playbackRate != null) {
              this.media.playbackRate = options.playbackRate
            }
          },
          { once: true },
        ),
      )
    }
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

  /**
   * Subscribe to an event on the underlying media. Returns an unsubscribe function.
   * @internal
   */
  public onMediaEvent<K extends keyof HTMLElementEventMap>(
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

  /**
   * Get the current media source URL.
   * @internal
   */
  public getSrc() {
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

  /**
   * Set the media source, preferring a blob URL when the blob is playable.
   * @internal
   */
  public setSrc(url: string, blob?: Blob) {
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

  public destroy() {
    // Terminal: the reactive media-event bridge is torn down and not revived.
    this.pendingTime = null
    this.mediaScope.dispose()

    // Revoke blob URLs that we created
    this.revokeSrc()

    if (this.isExternalMedia) return
    this.media.pause()
    this.media.removeAttribute('src')
    // Load resets the media element to its initial state
    this.media.load()
    // Remove from DOM after cleanup
    this.media.remove()
  }

  /**
   * Swap in a new media element and re-attach the reactive event bridge.
   * @internal
   */
  public setMediaElement(element: HTMLMediaElement) {
    this.pendingTime = null
    // Cleanup reactive event listeners from old media element
    this.mediaScope.dispose()
    this.mediaScope = new Scope()

    // Set new media element
    this.media = element

    // Reinitialize reactive event listeners on the new media element
    this.setupReactiveMediaEvents()
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
    // media.duration is NaN before metadata loads and Infinity for streams;
    // clamping against either would poison the time (Math.min(t, NaN) is
    // NaN), so only clamp when a finite duration is known. Under the old
    // inheritance this was masked by virtual dispatch: `this.getDuration()`
    // resolved to WaveSurfer's override with its decoded-duration fallback.
    const duration = this.getDuration()
    const currentTime = Number.isFinite(duration) ? Math.max(0, Math.min(time, duration)) : Math.max(0, time)
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

  /**
   * Get the raw media object. Note: under the WebAudio backend this is really
   * the WebAudioPlayer wearing the HTMLMediaElement surface (see the
   * constructor); WaveSurfer.getMediaElement() owns the null-for-WebAudio
   * public contract.
   * @internal
   */
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
