import { FrameScheduler } from './frame-scheduler.js'
import Player, { type PlayerMediaEvent } from './player.js'
import { Scope } from './scope.js'

type MediaElementPlayerOptions = {
  media?: HTMLMediaElement
  mediaControls?: boolean
  autoplay?: boolean
  playbackRate?: number
}

const HAVE_FUTURE_DATA = 3

/**
 * The HTML media element implementation of Player: owns the `<audio>` element
 * (or wraps an external one), the reactive media-event bridge, the WebKit
 * pending-seek workaround, and the rAF-based stop-at watcher.
 */
class MediaElementPlayer extends Player {
  private media: HTMLMediaElement
  private isExternalMedia = false

  // WebKit can discard or corrupt a seek made before the media can play.
  private pendingTime: number | null = null
  // Where stopAt() asked playback to stop, enforced by the rAF watcher below
  // and by the 'timeupdate' bridge (rAF is suspended in hidden tabs while
  // media 'timeupdate' keeps firing -- without the latter, a scheduled stop
  // would overshoot arbitrarily in a background tab).
  private stopAtPosition: number | null = null

  // The root ownership tree. mediaScope (a child) holds every media-event
  // bridge listener, so it can be torn down and rebuilt on setMediaElement()
  // without disturbing the rest; the stop-at scheduler registers its stop()
  // on the root so destroy() always cancels a pending rAF loop.
  private scope = new Scope()
  private mediaScope = this.scope.child()
  private stopAtScheduler = new FrameScheduler(this.scope)

  constructor(options: MediaElementPlayerOptions = {}) {
    super()

    if (options.media) {
      this.media = options.media
      this.isExternalMedia = true
    } else {
      this.media = document.createElement('audio')
    }

    // Sync the shared signals to the media element's initial state
    this.signals.volume.set(this.media.volume)
    this.signals.muted.set(this.media.muted)
    this.signals.playbackRate.set(this.media.playbackRate || 1)

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
        this.signals.isPlaying.set(true)
        // Resume watching a stop scheduled before playback (re)started
        if (this.stopAtPosition != null) {
          this.watchStopAt()
        }
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('pause', () => {
        this.signals.isPlaying.set(false)
        this.stopAtPosition = null
        this.stopAtScheduler.stop()
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('ended', () => {
        this.signals.isPlaying.set(false)
        this.stopAtPosition = null
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('emptied', () => {
        this.stopAtPosition = null
        this.stopAtScheduler.stop()
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('error', () => {
        this.stopAtPosition = null
      }),
    )

    // Time tracking
    this.mediaScope.add(
      this.onMediaEvent('timeupdate', () => {
        this.signals.currentTime.set(this.media.currentTime)
        this.checkStopAt()
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('durationchange', () => {
        this.signals.duration.set(this.media.duration || 0)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('loadedmetadata', () => {
        this.signals.duration.set(this.media.duration || 0)
      }),
    )

    this.mediaScope.add(this.onMediaEvent('canplay', () => this.applyPendingTime()))

    // Seeking state
    this.mediaScope.add(
      this.onMediaEvent('seeking', () => {
        if (this.pendingTime != null && Math.abs(this.media.currentTime - this.pendingTime) > 0.01) {
          this.pendingTime = null
        }
        this.signals.seeking.set(true)
      }),
    )

    this.mediaScope.add(
      this.onMediaEvent('seeked', () => {
        this.signals.seeking.set(false)
      }),
    )

    // Volume and muted
    this.mediaScope.add(
      this.onMediaEvent('volumechange', () => {
        this.signals.volume.set(this.media.volume)
        this.signals.muted.set(this.media.muted)
      }),
    )

    // Playback rate
    this.mediaScope.add(
      this.onMediaEvent('ratechange', () => {
        this.signals.playbackRate.set(this.media.playbackRate)
      }),
    )
  }

  /**
   * Subscribe to an event on the underlying media. Returns an unsubscribe function.
   * @internal
   */
  public onMediaEvent(event: PlayerMediaEvent, callback: () => void, options?: { once?: boolean }): () => void {
    // This IS media-element-player.ts's own listener-registration primitive for HTMLMediaElement
    // events (mirrors scope.listen's add/remove pairing); every caller registers the returned
    // remover on mediaScope (a real Scope) itself (see the constructor above).
    // eslint-disable-next-line no-restricted-syntax
    this.media.addEventListener(event, callback, options)
    // No capture option is ever used, so the pair matches without one
    return () => this.media.removeEventListener(event, callback)
  }

  /**
   * Get the current media source URL.
   * @internal
   */
  public getSrc() {
    return this.media.currentSrc || this.media.src || ''
  }

  protected canPlayType(type: string): boolean {
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
    // Any (re)load cancels a scheduled stop, even a reload of the same URL
    this.stopAtPosition = null

    const prevSrc = this.getSrc()
    if (url && prevSrc === url) return // no need to change the source

    const newSrc = this.resolveSrc(url, blob)
    this.pendingTime = null

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
    // Terminal: the reactive media-event bridge and the stop-at watcher are
    // torn down and not revived.
    this.pendingTime = null
    this.stopAtPosition = null
    this.scope.dispose()

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
   * Like destroy(), but never touches the media element itself -- used when
   * this player is swapped out for another one and the element (possibly
   * mounted in the DOM, possibly user-owned) must stay alive.
   * @internal
   */
  public detach() {
    this.pendingTime = null
    this.stopAtPosition = null
    this.scope.dispose()
    super.detach()
  }

  /**
   * Swap in a new media element and re-attach the reactive event bridge.
   * @internal
   */
  public setMediaElement(element: HTMLMediaElement) {
    this.pendingTime = null
    // Cleanup reactive event listeners from old media element. The new child
    // of a disposed root scope is itself born disposed, so a swap after
    // destroy() cannot attach anything to the new element.
    this.mediaScope.dispose()
    this.mediaScope = this.scope.child()

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
    // An explicit seek cancels a scheduled stop
    this.stopAtPosition = null
    const currentTime = this.clampTime(time, this.getDuration())
    if (this.media.readyState < HAVE_FUTURE_DATA) {
      this.pendingTime = currentTime
      return
    }
    this.pendingTime = null
    this.media.currentTime = currentTime
  }

  /**
   * Schedule playback to stop at the given time. An HTMLMediaElement has no
   * native scheduled stop, so this is enforced by a rAF watcher (for
   * frame-accurate stops in the foreground) plus the 'timeupdate' bridge (for
   * hidden tabs, where rAF is suspended).
   * @internal
   */
  public stopAt(time: number) {
    this.stopAtPosition = time
    if (this.isPlaying()) {
      this.watchStopAt()
    }
  }

  /** @internal */
  public clearStopAt(): void {
    this.stopAtPosition = null
    this.stopAtScheduler.stop()
  }

  private watchStopAt() {
    this.stopAtScheduler.start(() => this.checkStopAt())
  }

  private checkStopAt() {
    const stopAt = this.stopAtPosition
    if (stopAt == null) {
      this.stopAtScheduler.stop()
      return
    }
    if (this.isPlaying() && this.getCurrentTime() >= stopAt) {
      // The watcher may overshoot the stop position, so clamp the time back
      // to it. setTime() also clears stopAtPosition.
      this.pause()
      this.setTime(stopAt)
    }
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
   * Get the raw media element.
   * @internal
   */
  public getMediaElement(): HTMLMediaElement {
    return this.media
  }

  /**
   * The media element's error normalized to an Error: an HTMLMediaElement
   * reports a MediaError, which is NOT an Error -- normalize it so the public
   * 'error' event typing is honest, preserving the MediaError's message and
   * code.
   * @internal
   */
  public getError(): Error | null {
    const mediaError = this.media.error
    if (!mediaError) return null
    return new Error(mediaError.message || `Media error ${mediaError.code}`)
  }

  /** Set a sink id to change the audio output device */
  public setSinkId(sinkId: string): Promise<void> {
    // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId
    const media = this.media as HTMLAudioElement & { setSinkId: (sinkId: string) => Promise<void> }
    return media.setSinkId(sinkId)
  }
}

export default MediaElementPlayer
