import { signal, type WritableSignal } from './reactive/store.js'

/**
 * The media events every Player implementation can be subscribed to via
 * onMediaEvent(). A subset of the HTMLMediaElement event surface that both
 * backends support: MediaElementPlayer forwards the real DOM events,
 * WebAudioPlayer emits them from its own emitter at the equivalent points.
 */
export type PlayerMediaEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'durationchange'
  | 'loadedmetadata'
  | 'canplay'
  | 'seeking'
  | 'seeked'
  | 'volumechange'
  | 'ratechange'
  | 'emptied'
  | 'error'

/**
 * The abstract playback engine. WaveSurfer owns one Player by composition and
 * delegates the public playback API to it; the two implementations are
 * MediaElementPlayer (an HTMLMediaElement) and WebAudioPlayer (an
 * AudioContext + AudioBufferSourceNode). Everything backend-specific lives in
 * the subclasses -- this class owns only what is genuinely shared: the
 * reactive playback signals and the blob-URL bookkeeping for setSrc().
 */
abstract class Player {
  // Reactive playback state, shared by all implementations. Subclasses write
  // to these signals (from media events or directly at the mutation sites);
  // WaveSurfer composes them into its centralized state by subscription.
  protected readonly signals = {
    isPlaying: signal(false),
    currentTime: signal(0),
    duration: signal(0),
    volume: signal(1),
    muted: signal(false),
    playbackRate: signal(1),
    seeking: signal(false),
  }

  // A blob: URL created by setSrc() (i.e. owned by this player, as opposed to
  // one passed in by an external caller) -- revoked on the next setSrc(),
  // on destroy(), or on detach().
  private ownBlobUrl: string | null = null

  public get isPlayingSignal(): WritableSignal<boolean> {
    return this.signals.isPlaying
  }
  public get currentTimeSignal(): WritableSignal<number> {
    return this.signals.currentTime
  }
  public get durationSignal(): WritableSignal<number> {
    return this.signals.duration
  }
  public get volumeSignal(): WritableSignal<number> {
    return this.signals.volume
  }
  public get mutedSignal(): WritableSignal<boolean> {
    return this.signals.muted
  }
  public get playbackRateSignal(): WritableSignal<number> {
    return this.signals.playbackRate
  }
  public get seekingSignal(): WritableSignal<boolean> {
    return this.signals.seeking
  }

  /**
   * Subscribe to a media event. Returns an unsubscribe function.
   * @internal
   */
  public abstract onMediaEvent(event: PlayerMediaEvent, callback: () => void, options?: { once?: boolean }): () => void

  /** Start playing the audio */
  public abstract play(): Promise<void>

  /** Pause the audio */
  public abstract pause(): void

  /** Check if the audio is playing */
  public abstract isPlaying(): boolean

  /** Check if the audio is seeking */
  public abstract isSeeking(): boolean

  /** Jump to a specific time in the audio (in seconds) */
  public abstract setTime(time: number): void

  /**
   * Schedule playback to stop at the given time (in seconds).
   * @internal
   */
  public abstract stopAt(time: number): void

  /**
   * Cancel a stop scheduled with stopAt() where the backend supports it.
   * The WebAudio backend schedules the stop on the audio clock and cannot
   * unschedule it (same as before this API existed), so the base
   * implementation is a no-op.
   * @internal
   */
  public clearStopAt(): void {
    return
  }

  /** Get the duration of the audio in seconds */
  public abstract getDuration(): number

  /** Get the current audio position in seconds */
  public abstract getCurrentTime(): number

  /** Get the audio volume */
  public abstract getVolume(): number

  /** Set the audio volume */
  public abstract setVolume(volume: number): void

  /** Get the audio muted state */
  public abstract getMuted(): boolean

  /** Mute or unmute the audio */
  public abstract setMuted(muted: boolean): void

  /** Get the playback speed */
  public abstract getPlaybackRate(): number

  /** Set the playback speed, pass an optional false to NOT preserve the pitch */
  public abstract setPlaybackRate(rate: number, preservePitch?: boolean): void

  /** Set a sink id to change the audio output device */
  public abstract setSinkId(sinkId: string): Promise<void>

  /**
   * Get the current media source URL.
   * @internal
   */
  public abstract getSrc(): string

  /**
   * Set the media source, preferring a blob URL when the blob is playable.
   * Implementations resolve the source via resolveSrc() so blob-URL ownership
   * is tracked here in the base class.
   * @internal
   */
  public abstract setSrc(url: string, blob?: Blob): void

  /**
   * Overwrite the reported duration where the backend allows it (the WebAudio
   * backend with no URL to decode). No-op where duration is media-derived.
   * @internal
   */
  public setDuration(duration: number): void {
    void duration
  }

  /**
   * The HTML media element driving playback, or null for a backend that has
   * none (WebAudio).
   * @internal
   */
  public abstract getMediaElement(): HTMLMediaElement | null

  /**
   * The current media error normalized to an Error, or null.
   * @internal
   */
  public abstract getError(): Error | null

  protected abstract canPlayType(type: string): boolean

  /** Tear down the player. Terminal. */
  public abstract destroy(): void

  /**
   * Release resources WaveSurfer created on behalf of an externally-owned
   * player (a user-supplied WebAudioPlayer) without tearing the player down.
   * @internal
   */
  public detach(): void {
    this.revokeSrc()
  }

  /**
   * Resolve the source for setSrc(): a fresh blob URL when the blob is
   * playable (tracked for revocation), the plain URL otherwise. Revokes the
   * previously-owned blob URL first.
   */
  protected resolveSrc(url: string, blob?: Blob): string {
    this.revokeSrc()
    const newSrc = blob instanceof Blob && (this.canPlayType(blob.type) || !url) ? URL.createObjectURL(blob) : url
    if (newSrc !== url) {
      this.ownBlobUrl = newSrc
    }
    return newSrc
  }

  protected revokeSrc(): void {
    // Only revoke blob URLs that we created (not ones owned by external callers)
    if (this.ownBlobUrl) {
      URL.revokeObjectURL(this.ownBlobUrl)
      this.ownBlobUrl = null
    }
  }

  /**
   * Clamp a time to [0, duration]. media duration is NaN before metadata
   * loads and Infinity for streams; clamping against either would poison the
   * time (Math.min(t, NaN) is NaN), so only clamp when a finite duration is
   * known.
   */
  protected clampTime(time: number, duration: number): number {
    return Number.isFinite(duration) ? Math.max(0, Math.min(time, duration)) : Math.max(0, time)
  }
}

export default Player
