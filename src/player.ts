import EventEmitter, { type GeneralEventTypes } from './event-emitter.js'
import { signal, type WritableSignal } from './reactive/store.js'

type PlayerOptions = {
  media?: HTMLMediaElement
  mediaControls?: boolean
  autoplay?: boolean
  playbackRate?: number
}

class Player<T extends GeneralEventTypes> extends EventEmitter<T> {
  protected media: HTMLMediaElement
  private isExternalMedia = false

  // Reactive state - make state observable
  private _isPlaying: WritableSignal<boolean>
  private _currentTime: WritableSignal<number>
  private _duration: WritableSignal<number>
  private _volume: WritableSignal<number>
  private _muted: WritableSignal<boolean>
  private _playbackRate: WritableSignal<number>
  private _seeking: WritableSignal<boolean>
  private reactiveMediaEventCleanups: Array<() => void> = []

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
   * Setup reactive media event handlers that update signals
   * This bridges the imperative HTMLMediaElement API to reactive state
   */
  private setupReactiveMediaEvents() {
    // Playing state
    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('play', () => {
        this._isPlaying.set(true)
      }),
    )

    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('pause', () => {
        this._isPlaying.set(false)
      }),
    )

    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('ended', () => {
        this._isPlaying.set(false)
      }),
    )

    // Time tracking
    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('timeupdate', () => {
        this._currentTime.set(this.media.currentTime)
      }),
    )

    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('durationchange', () => {
        this._duration.set(this.media.duration)
      }),
    )

    // Seeking state
    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('seeking', () => {
        this._seeking.set(true)
      }),
    )

    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('seeked', () => {
        this._seeking.set(false)
      }),
    )

    // Volume
    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('volumechange', () => {
        this._volume.set(this.media.volume)
        this._muted.set(this.media.muted)
      }),
    )

    // Playback rate
    this.reactiveMediaEventCleanups.push(
      this.onMediaEvent('ratechange', () => {
        this._playbackRate.set(this.media.playbackRate)
      }),
    )
  }

  // Public getters for reactive state
  /** Get reactive isPlaying stream */
  public get isPlaying$() {
    return this._isPlaying
  }

  /** Get reactive currentTime stream */
  public get currentTime$() {
    return this._currentTime
  }

  /** Get reactive duration stream */
  public get duration$() {
    return this._duration
  }

  /** Get reactive volume stream */
  public get volume$() {
    return this._volume
  }

  /** Get reactive muted stream */
  public get muted$() {
    return this._muted
  }

  /** Get reactive playbackRate stream */
  public get playbackRate$() {
    return this._playbackRate
  }

  /** Get reactive seeking stream */
  public get seeking$() {
    return this._seeking
  }

  protected onMediaEvent<K extends keyof HTMLElementEventMap>(
    event: K,
    callback: (ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    this.media.addEventListener(event, callback, options)
    return () => this.media.removeEventListener(event, callback, options)
  }

  protected getSrc() {
    return this.media.currentSrc || this.media.src || ''
  }

  private revokeSrc() {
    const src = this.getSrc()
    if (src.startsWith('blob:')) {
      URL.revokeObjectURL(src)
    }
  }

  private canPlayType(type: string): boolean {
    return this.media.canPlayType(type) !== ''
  }

  protected setSrc(url: string, blob?: Blob) {
    const prevSrc = this.getSrc()
    if (url && prevSrc === url) return // no need to change the source

    this.revokeSrc()
    const newSrc = blob instanceof Blob && (this.canPlayType(blob.type) || !url) ? URL.createObjectURL(blob) : url

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
    // Clean up media event listeners
    this.reactiveMediaEventCleanups.forEach((cleanup) => cleanup())
    this.reactiveMediaEventCleanups = []

    if (this.isExternalMedia) return
    this.media.pause()
    this.revokeSrc()
    this.media.removeAttribute('src')
    // Load resets the media element to its initial state
    this.media.load()
    // Remove from DOM after cleanup
    this.media.remove()
  }

  protected setMediaElement(element: HTMLMediaElement) {
    // Clean up old media element listeners
    this.reactiveMediaEventCleanups.forEach((cleanup) => cleanup())
    this.reactiveMediaEventCleanups = []

    this.media = element

    // Set up listeners for new media element
    this.setupReactiveMediaEvents()
  }

  /** Start playing the audio */
  public async play(): Promise<void> {
    try {
      return await this.media.play()
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
    this.media.currentTime = Math.max(0, Math.min(time, this.getDuration()))
  }

  /** Get the duration of the audio in seconds */
  public getDuration(): number {
    return this.media.duration
  }

  /** Get the current audio position in seconds */
  public getCurrentTime(): number {
    return this.media.currentTime
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
