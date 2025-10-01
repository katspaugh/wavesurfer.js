/**
 * Enhanced Player - integrates with state management
 * Maintains backward compatibility while providing state-based updates
 */

import EventEmitter, { type GeneralEventTypes } from './event-emitter.js'
import { ResourcePool } from './utils/resources.js'
import type { StateStore } from './state/store.js'
import type { PlaybackState } from './state/state.types.js'

type PlayerOptions = {
  media?: HTMLMediaElement
  mediaControls?: boolean
  autoplay?: boolean
  playbackRate?: number
  store?: StateStore<any> // Optional state store for integration
}

class Player<T extends GeneralEventTypes> extends EventEmitter<T> {
  protected media: HTMLMediaElement
  protected resources = new ResourcePool()
  private isExternalMedia = false
  private store?: StateStore<any>

  constructor(options: PlayerOptions) {
    super()

    this.store = options.store

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
      const cleanup = this.onMediaEvent(
        'canplay',
        () => {
          if (options.playbackRate != null) {
            this.media.playbackRate = options.playbackRate
          }
        },
        { once: true },
      )
      this.resources.addCleanup(cleanup)
    }

    this.initializeMediaEventSync()
  }

  /**
   * Sync media element state with store
   */
  private initializeMediaEventSync() {
    if (!this.store) return

    // Sync playback state changes to store
    this.resources.addCleanup(
      this.onMediaEvent('play', () => {
        this.updatePlaybackState({ isPlaying: true })
      })
    )

    this.resources.addCleanup(
      this.onMediaEvent('pause', () => {
        this.updatePlaybackState({ isPlaying: false })
      })
    )

    this.resources.addCleanup(
      this.onMediaEvent('seeking', () => {
        this.updatePlaybackState({ isSeeking: true })
      })
    )

    this.resources.addCleanup(
      this.onMediaEvent('seeked', () => {
        this.updatePlaybackState({ isSeeking: false })
      })
    )

    this.resources.addCleanup(
      this.onMediaEvent('timeupdate', () => {
        this.updatePlaybackState({ currentTime: this.media.currentTime })
      })
    )

    this.resources.addCleanup(
      this.onMediaEvent('ratechange', () => {
        this.updatePlaybackState({ playbackRate: this.media.playbackRate })
      })
    )

    this.resources.addCleanup(
      this.onMediaEvent('volumechange', () => {
        this.updatePlaybackState({
          volume: this.media.volume,
          muted: this.media.muted,
        })
      })
    )
  }

  /**
   * Update playback state in store
   */
  private updatePlaybackState(updates: Partial<PlaybackState>) {
    if (!this.store) return

    this.store.update((state) => ({
      ...state,
      playback: {
        ...state.playback,
        ...updates,
      },
    }))
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
    if (url && prevSrc === url) return

    this.revokeSrc()
    const newSrc = blob instanceof Blob && (this.canPlayType(blob.type) || !url) ? URL.createObjectURL(blob) : url

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
    this.resources.dispose()

    if (this.isExternalMedia) return

    this.media.pause()
    this.revokeSrc()
    this.media.removeAttribute('src')
    this.media.load()
    this.media.remove()
  }

  protected setMediaElement(element: HTMLMediaElement) {
    this.media = element
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
    const media = this.media as HTMLAudioElement & { setSinkId: (sinkId: string) => Promise<void> }
    return media.setSinkId(sinkId)
  }
}

export default Player
