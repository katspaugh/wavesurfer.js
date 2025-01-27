import EventEmitter, { type GeneralEventTypes } from './event-emitter.js'

type PlayerOptions = {
  media?: HTMLMediaElement
  mediaControls?: boolean
  autoplay?: boolean
  playbackRate?: number
}

class Player<T extends GeneralEventTypes> extends EventEmitter<T> {
  protected media: HTMLMediaElement
  private isExternalMedia = false

  constructor(options: PlayerOptions) {
    super()

    if (options.media) {
      this.media = options.media
      this.isExternalMedia = true
    } else {
      this.media = document.createElement('audio')
    }

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
    const src = this.getSrc()
    if (url && src === url) return
    this.revokeSrc()
    const newSrc = blob instanceof Blob && (this.canPlayType(blob.type) || !url) ? URL.createObjectURL(blob) : url

    // Reset the media element, otherwise it keeps the previous source
    if (src) {
      this.media.src = ''
    }

    try {
      this.media.src = newSrc
    } catch (e) {
      this.media.src = url
    }
  }

  protected destroy() {
    if (this.isExternalMedia) return
    this.media.pause()
    this.media.remove()
    this.revokeSrc()
    this.media.src = ''
    // Load resets the media element to its initial state
    this.media.load()
  }

  protected setMediaElement(element: HTMLMediaElement) {
    this.media = element
  }

  /** Start playing the audio */
  public async play(): Promise<void> {
    return this.media.play()
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
    this.media.currentTime = time
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
