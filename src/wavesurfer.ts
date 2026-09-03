import BasePlugin, { type GenericPlugin } from './base-plugin.js'
import Decoder from './decoder.js'
import { definePlugin } from './define-plugin.js'
import * as dom from './dom.js'
import EventEmitter from './event-emitter.js'
import Fetcher from './fetcher.js'
import { FrameScheduler } from './frame-scheduler.js'
import MediaElementPlayer from './media-element-player.js'
import Player from './player.js'
import Renderer from './renderer.js'
import { effect, signal, type Signal, type WritableSignal } from './reactive/store.js'
import { Scope } from './scope.js'
import WebAudioPlayer from './webaudio.js'
import { createWaveSurferState, type WaveSurferState, type WaveSurferActions } from './state/wavesurfer-state.js'

export type WaveSurferOptions = {
  /** Required: an HTML element or selector where the waveform will be rendered */
  container: HTMLElement | string
  /** The height of the waveform in pixels, or "auto" to fill the container height */
  height?: number | 'auto'
  /** The width of the waveform in pixels or any CSS value; defaults to 100% */
  width?: number | string
  /** The color of the waveform */
  waveColor?: string | string[] | CanvasGradient
  /** The color of the progress mask */
  progressColor?: string | string[] | CanvasGradient
  /** The color of the playback cursor */
  cursorColor?: string
  /** The cursor width */
  cursorWidth?: number
  /** If set, the waveform will be rendered with bars like this: ▁ ▂ ▇ ▃ ▅ ▂ */
  barWidth?: number
  /** Spacing between bars in pixels */
  barGap?: number
  /** Rounded borders for bars */
  barRadius?: number
  /** A vertical scaling factor for the waveform */
  barHeight?: number
  /** Vertical bar alignment */
  barAlign?: 'top' | 'bottom'
  /** Minimum height of bars in pixels */
  barMinHeight?: number
  /** Minimum pixels per second of audio (i.e. the zoom level) */
  minPxPerSec?: number
  /** Stretch the waveform to fill the container, true by default */
  fillParent?: boolean
  /** Audio URL */
  url?: string
  /** Pre-computed audio data, arrays of floats for each channel */
  peaks?: Array<Float32Array | number[]>
  /** Pre-computed audio duration in seconds */
  duration?: number
  /** Use an existing media element instead of creating one */
  media?: HTMLMediaElement
  /** Whether to show default audio element controls */
  mediaControls?: boolean
  /** Play the audio on load */
  autoplay?: boolean
  /** Pass false to disable clicks on the waveform */
  interact?: boolean
  /** Allow to drag the cursor to seek to a new position. If an object with `debounceTime` is provided instead
   * then `dragToSeek` will also be true. If `true` the default is 200ms
   */
  dragToSeek?: boolean | { debounceTime: number }
  /** Hide the scrollbar */
  hideScrollbar?: boolean
  /** Audio rate, i.e. the playback speed */
  audioRate?: number
  /** Automatically scroll the container to keep the current position in viewport */
  autoScroll?: boolean
  /** If autoScroll is enabled, keep the cursor in the center of the waveform during playback */
  autoCenter?: boolean
  /** Decoding sample rate. Doesn't affect the playback. Defaults to 8000 */
  sampleRate?: number
  /**
   * Render each audio channel as a separate waveform.
   * By default, stereo audio is rendered as a single waveform with the left channel on top and the right channel on the bottom.
   */
  splitChannels?: Array<Partial<WaveSurferOptions> & { overlay?: boolean }>
  /** Stretch the waveform to the full height */
  normalize?: boolean
  /** Use a fixed max peak value for normalization instead of calculating from the current data */
  maxPeak?: number
  /** The list of plugins to initialize on start */
  plugins?: GenericPlugin[]
  /** Custom render function */
  renderFunction?: (peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D) => void
  /** Options to pass to the fetch method */
  fetchParams?: RequestInit
  /** Playback "backend" to use, defaults to MediaElement */
  backend?: 'WebAudio' | 'MediaElement'
  /** Nonce for CSP if necessary */
  cspNonce?: string
  /** Override the Blob MIME type */
  blobMimeType?: string
}

const defaultOptions = {
  waveColor: '#999',
  progressColor: '#555',
  cursorWidth: 1,
  minPxPerSec: 0,
  fillParent: true,
  interact: true,
  dragToSeek: false,
  autoScroll: true,
  autoCenter: true,
  sampleRate: 8000,
}

export type WaveSurferEvents = {
  /** After wavesurfer is created */
  init: []
  /** When audio starts loading */
  load: [url: string]
  /** During audio loading */
  loading: [percent: number]
  /** When the audio has been decoded */
  decode: [duration: number]
  /** When the audio is both decoded and can play */
  ready: [duration: number]
  /** When visible waveform is drawn */
  redraw: []
  /** When all audio channel chunks of the waveform have drawn */
  redrawcomplete: []
  /** When the audio starts playing */
  play: []
  /** When the audio pauses */
  pause: []
  /** When the audio finishes playing */
  finish: []
  /** On audio position change, fires continuously during playback */
  timeupdate: [currentTime: number]
  /** An alias of timeupdate but only when the audio is playing */
  audioprocess: [currentTime: number]
  /** When the user seeks to a new position */
  seeking: [currentTime: number]
  /** When the user interacts with the waveform (i.g. clicks or drags on it) */
  interaction: [newTime: number]
  /** When the user clicks on the waveform */
  click: [relativeX: number, relativeY: number]
  /** When the user double-clicks on the waveform */
  dblclick: [relativeX: number, relativeY: number]
  /** When the user drags the cursor */
  drag: [relativeX: number]
  /** When the user starts dragging the cursor */
  dragstart: [relativeX: number]
  /** When the user ends dragging the cursor */
  dragend: [relativeX: number]
  /** When the waveform is scrolled (panned) */
  scroll: [visibleStartTime: number, visibleEndTime: number, scrollLeft: number, scrollRight: number]
  /** When the zoom level changes */
  zoom: [minPxPerSec: number]
  /** Just before the waveform is destroyed so you can clean up your events */
  destroy: []
  /** When source file is unable to be fetched, decoded, or an error is thrown by media element */
  error: [error: Error]
  /** When audio container resizing */
  resize: []
}

class WaveSurfer extends EventEmitter<WaveSurferEvents> {
  public options: WaveSurferOptions & typeof defaultOptions
  // The playback engine: one of the Player implementations
  // (MediaElementPlayer or WebAudioPlayer). WaveSurfer owns it by composition
  // (not inheritance) and delegates the public playback API to it below --
  // all behavior differences between the backends live inside them.
  private player: Player
  // True when the player object itself is user-owned (a user-supplied
  // WebAudioPlayer passed as `media`): destroy() must then release only what
  // WaveSurfer created (player.detach()) instead of tearing the player down.
  // A user-supplied HTMLMediaElement is different: WaveSurfer creates (and
  // owns) the MediaElementPlayer wrapper, which itself knows to leave the
  // external element alone on destroy.
  private playerIsExternal = false
  private renderer: Renderer
  private plugins: GenericPlugin[] = []
  private decodedData: AudioBuffer | null = null
  // The WebAudioPlayer this instance created for backend: 'WebAudio', if any.
  // Kept separately from `player` so destroy() still tears it down (closing
  // its AudioContext) even if setMediaElement() swapped it out.
  private internalWebAudioPlayer: WebAudioPlayer | null = null
  // WaveSurfer's own stable playback signals, mirrored from the current
  // player's signals (see bindPlayerSignals). The indirection keeps the
  // composed WaveSurferState valid across setMediaElement() swaps that
  // replace the player instance (and with it, its signal objects).
  private readonly playbackSignals = {
    isPlaying: signal(false),
    currentTime: signal(0),
    duration: signal(0),
    volume: signal(1),
    muted: signal(false),
    playbackRate: signal(1),
    isSeeking: signal(false),
  }
  protected scope: Scope = new Scope()
  private mediaEventScope = this.scope.child()
  private frameScheduler: FrameScheduler = new FrameScheduler(this.scope)
  private loadScope: Scope | null = null
  // Scopes marked here were superseded by a newer load() at the moment
  // supersession happened (see loadAudio) -- distinct from a scope merely
  // being disposed, which also happens on destroy(). Checked from loadAudio's
  // catch block to swallow only genuinely-superseded loads, never a
  // destroy-triggered abort or a real failure. WeakSet so a superseded
  // scope isn't kept alive once nothing else references it.
  private supersededLoadScopes = new WeakSet<Scope>()
  // destroy() is terminal: once true, load()/loadBlob() reject and
  // registerPlugin() throws. Create a new instance instead of reusing a
  // destroyed one.
  private isDestroyed = false

  // Reactive state
  private wavesurferState: WaveSurferState
  private wavesurferActions: WaveSurferActions

  public static readonly BasePlugin = BasePlugin
  public static readonly dom = dom
  public static readonly definePlugin = definePlugin

  /** Create a new WaveSurfer instance */
  public static create(options: WaveSurferOptions) {
    return new WaveSurfer(options)
  }

  /** Get the reactive state for advanced use cases */
  public getState(): WaveSurferState {
    return this.wavesurferState
  }

  /** Get the renderer instance for plugin access to reactive streams */
  public getRenderer(): Renderer {
    return this.renderer
  }

  /** Create a new WaveSurfer instance */
  constructor(options: WaveSurferOptions) {
    super()

    // Pick the Player implementation (the classification point for the whole
    // instance -- everywhere else the two backends are used polymorphically):
    // - a user-supplied WebAudioPlayer (passed as `media`) IS the player, but
    //   stays user-owned;
    // - backend: 'WebAudio' creates a WebAudioPlayer owned by this instance;
    // - otherwise a MediaElementPlayer, wrapping the user-supplied element or
    //   creating its own <audio>.
    const internalWebAudioPlayer = !options.media && options.backend === 'WebAudio' ? new WebAudioPlayer() : null
    if (options.media instanceof WebAudioPlayer) {
      this.player = options.media
      this.playerIsExternal = true
    } else if (internalWebAudioPlayer) {
      this.player = internalWebAudioPlayer
    } else {
      this.player = new MediaElementPlayer({
        media: options.media,
        mediaControls: options.mediaControls,
        autoplay: options.autoplay,
        playbackRate: options.audioRate,
      })
    }
    this.internalWebAudioPlayer = internalWebAudioPlayer

    // MediaElementPlayer applies these via its constructor options above; a
    // WebAudioPlayer keeps its public constructor signature, so apply them
    // here. mediaControls has no meaning without a media element.
    if (this.player instanceof WebAudioPlayer) {
      if (options.autoplay) this.player.autoplay = true
      if (options.audioRate != null) this.player.playbackRate = options.audioRate
    }

    this.options = Object.assign({}, defaultOptions, options)

    // Initialize reactive state, composing WaveSurfer's stable playback
    // signals (kept in sync with the current player by bindPlayerSignals)
    const { state, actions, dispose } = createWaveSurferState(this.playbackSignals)
    this.wavesurferState = state
    this.wavesurferActions = actions
    // destroy() is terminal, so the state's computed graph is released with
    // everything else owned by this.scope.
    this.scope.add(dispose)

    // When no media was supplied, MediaElementPlayer created its own <audio>
    // element -- hand that raw element to the renderer so it can be mounted
    // in the DOM. (Under the WebAudio backend there is no element: null.)
    const audioElement = options.media ? undefined : (this.player.getMediaElement() ?? undefined)
    this.renderer = new Renderer(this.options, audioElement)

    this.initPlayerEvents()
    this.initRendererEvents()
    this.initPlugins()

    // Read the initial URL before load has been called
    const initialUrl = this.options.url || this.player.getSrc() || ''

    // Init and load async to allow external events to be registered
    Promise.resolve().then(() => {
      // destroy() may have been called synchronously after create() -- the
      // deferred init/load must not resurrect a destroyed instance
      if (this.isDestroyed) return

      this.emit('init')

      // Load audio if URL or an external media with an src is passed,
      // of render w/o audio if pre-decoded peaks and duration are provided
      const { peaks, duration } = this.options
      if (initialUrl || (peaks && duration)) {
        // Swallow async errors because they cannot be caught from a constructor call.
        // Subscribe to the wavesurfer's error event to handle them.
        this.load(initialUrl, peaks, duration).catch(() => {
          // Error already emitted by load()
        })
      }
    })
  }

  private updateProgress(currentTime = this.getCurrentTime()): number {
    this.renderer.renderProgress(currentTime / this.getDuration(), this.isPlaying())
    return currentTime
  }

  // The frame scheduler ticks every animation frame for a smooth progress
  // animation while playing. (A stop scheduled via play(start, end) is
  // enforced inside the player -- see Player.stopAt.)
  private onTick = () => {
    if (!this.isSeeking()) {
      const currentTime = this.updateProgress()
      this.emit('timeupdate', currentTime)
      this.emit('audioprocess', currentTime)
    }
  }

  // Mirror the current player's signals into WaveSurfer's stable playback
  // signals. Registered on mediaEventScope so a setMediaElement() swap
  // re-binds against the new player, and destroy() severs the mirror.
  private bindPlayerSignals() {
    const bind = <T>(source: Signal<T>, target: WritableSignal<T>) => {
      target.set(source.value)
      this.mediaEventScope.add(source.subscribe((value) => target.set(value)))
    }
    bind(this.player.isPlayingSignal, this.playbackSignals.isPlaying)
    bind(this.player.currentTimeSignal, this.playbackSignals.currentTime)
    bind(this.player.durationSignal, this.playbackSignals.duration)
    bind(this.player.volumeSignal, this.playbackSignals.volume)
    bind(this.player.mutedSignal, this.playbackSignals.muted)
    bind(this.player.playbackRateSignal, this.playbackSignals.playbackRate)
    bind(this.player.seekingSignal, this.playbackSignals.isSeeking)
  }

  private initPlayerEvents() {
    this.bindPlayerSignals()

    if (this.isPlaying()) {
      this.emit('play')
      this.frameScheduler.start(this.onTick)
    }

    this.mediaEventScope.add(
      this.player.onMediaEvent('timeupdate', () => {
        const currentTime = this.updateProgress()
        this.emit('timeupdate', currentTime)
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('play', () => {
        this.emit('play')
        this.frameScheduler.start(this.onTick)
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('pause', () => {
        this.emit('pause')
        this.frameScheduler.stop()
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('emptied', () => {
        this.frameScheduler.stop()
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('ended', () => {
        this.emit('timeupdate', this.getDuration())
        this.emit('finish')
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('seeking', () => {
        this.emit('seeking', this.getCurrentTime())
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('error', () => {
        // Each player normalizes its own error to a real Error (an
        // HTMLMediaElement reports a MediaError, which is NOT an Error), so
        // the public 'error' event typing stays honest.
        this.emit('error', this.player.getError() ?? new Error('Media error'))
      }),
    )
  }

  // The ONE bridge from the renderer's internal reactive surface (signals/
  // streams -- Renderer is not an EventEmitter) to the public
  // WaveSurferEvents. Every subscription is registered on this.scope, so
  // destroy() severs the bridge in one dispose.
  private initRendererEvents() {
    // Seek on click
    this.scope.add(
      this.renderer.clickSignal.subscribe((hit) => {
        if (!hit) return
        if (this.options.interact) {
          this.seekTo(hit.relativeX)
          this.emit('interaction', hit.relativeX * this.getDuration())
          this.emit('click', hit.relativeX, hit.relativeY)
        }
      }),
    )

    // Double click
    this.scope.add(
      this.renderer.dblclickSignal.subscribe((hit) => {
        if (!hit) return
        this.emit('dblclick', hit.relativeX, hit.relativeY)
      }),
    )

    // Scroll: react to both the percentages and the bounds signals, the same
    // pairing the renderer's old internal scroll effect used
    {
      const { percentages, bounds } = this.renderer.getScrollSignals()
      this.scope.add(
        effect(() => {
          const { startX, endX } = percentages.value
          const { left: scrollLeft, right: scrollRight } = bounds.value
          const duration = this.getDuration()
          this.wavesurferActions.setScrollPosition(scrollLeft)
          this.emit('scroll', startX * duration, endX * duration, scrollLeft, scrollRight)
        }, [percentages, bounds]),
      )
    }

    // Redraw
    this.scope.add(
      this.renderer.renderEpoch.subscribe(() => {
        this.emit('redraw')
      }),
    )

    // RedrawComplete
    this.scope.add(
      this.renderer.renderedEpoch.subscribe(() => {
        this.emit('redrawcomplete')
      }),
    )

    // Resize
    this.scope.add(
      this.renderer.resizeEpoch.subscribe(() => {
        this.emit('resize')
      }),
    )

    // Drag
    {
      let cancelDebounce: (() => void) | undefined
      const unsubscribeDrag = this.renderer.dragEventsSignal.subscribe((dragEvent) => {
        if (!dragEvent) return
        const { relativeX } = dragEvent

        if (dragEvent.type === 'start') {
          this.emit('dragstart', relativeX)
          return
        }

        if (dragEvent.type === 'end') {
          this.emit('dragend', relativeX)
          return
        }

        // 'move'
        if (!this.options.interact) return

        // Update the visual position
        this.renderer.renderProgress(relativeX)

        // Set the audio position with a debounce
        cancelDebounce?.()
        let debounceTime = 0

        const dragToSeek = this.options.dragToSeek
        if (this.isPlaying()) {
          debounceTime = 0
        } else if (dragToSeek === true) {
          debounceTime = 200
        } else if (dragToSeek && typeof dragToSeek === 'object') {
          debounceTime = (dragToSeek as { debounceTime: number }).debounceTime ?? 200
        }

        cancelDebounce = this.scope.timeout(() => {
          this.seekTo(relativeX)
        }, debounceTime)

        this.emit('interaction', relativeX * this.getDuration())
        this.emit('drag', relativeX)
      })

      // Unsubscribe the drag listener on destroy (the debounce timeout is
      // already torn down by this.scope itself via scope.timeout above).
      this.scope.add(unsubscribeDrag)
    }
  }

  private initPlugins() {
    if (!this.options.plugins?.length) return

    this.options.plugins.forEach((plugin) => {
      this.registerPlugin(plugin)
    })
  }

  private unsubscribePlayerEvents() {
    this.mediaEventScope.dispose()
    this.mediaEventScope = this.scope.child()
  }

  /** Set new wavesurfer options and re-render it */
  public setOptions(options: Partial<WaveSurferOptions>) {
    if (this.isDestroyed) return
    this.options = Object.assign({}, this.options, options)
    if (options.duration && !options.peaks) {
      this.decodedData = Decoder.createBuffer(this.exportPeaks(), options.duration)
      this.wavesurferActions.setAudioBuffer(this.decodedData)
    }
    if (options.peaks && options.duration) {
      // Create new decoded data buffer from peaks and duration
      this.decodedData = Decoder.createBuffer(options.peaks, options.duration)
      this.wavesurferActions.setAudioBuffer(this.decodedData)
    }
    this.renderer.setOptions(this.options)

    if (options.audioRate) {
      this.setPlaybackRate(options.audioRate)
    }
    if (options.mediaControls != null) {
      // No-op under the WebAudio backend, which has no media element
      const mediaElement = this.player.getMediaElement()
      if (mediaElement) {
        mediaElement.controls = options.mediaControls
      }
    }
  }

  /** Register a wavesurfer.js plugin */
  public registerPlugin<T extends GenericPlugin>(plugin: T): T {
    if (this.isDestroyed) {
      throw new Error('Cannot register a plugin: wavesurfer was destroyed. Create a new instance instead.')
    }

    // Check if the plugin is already registered
    if (this.plugins.includes(plugin)) {
      return plugin
    }

    plugin._init(this)
    this.plugins.push(plugin)

    // Unregister plugin on destroy
    const remove = this.scope.add(
      plugin.once('destroy', () => {
        this.plugins = this.plugins.filter((p) => p !== plugin)
        remove()
      }),
    )

    return plugin
  }

  /** Unregister a wavesurfer.js plugin */
  public unregisterPlugin(plugin: GenericPlugin): void {
    this.plugins = this.plugins.filter((p) => p !== plugin)
    plugin.destroy()
  }

  /** For plugins only: get the waveform wrapper div */
  public getWrapper(): HTMLElement {
    return this.renderer.getWrapper()
  }

  /** For plugins only: get the scroll container client width */
  public getWidth(): number {
    return this.renderer.getWidth()
  }

  /** Get the current scroll position in pixels */
  public getScroll(): number {
    return this.renderer.getScroll()
  }

  /** Set the current scroll position in pixels */
  public setScroll(pixels: number) {
    if (this.isDestroyed) return
    return this.renderer.setScroll(pixels)
  }

  /** Move the start of the viewing window to a specific time in the audio (in seconds) */
  public setScrollTime(time: number) {
    const percentage = time / this.getDuration()
    this.renderer.setScrollPercentage(percentage)
  }

  /** Get all registered plugins */
  public getActivePlugins() {
    return this.plugins
  }

  /**
   * Classify a bailed-out (disposed-scope) load: 'superseded' when a newer
   * load()/loadBlob() took over -- the old call's promise must then reject
   * with a canonical AbortError (see load()) -- and undefined for a
   * destroy-triggered disposal, which keeps its existing settle contract.
   */
  private bailedLoadOutcome(loadScope: Scope): 'superseded' | undefined {
    return this.supersededLoadScopes.has(loadScope) ? 'superseded' : undefined
  }

  private async loadAudio(
    url: string,
    blob?: Blob,
    channelData?: WaveSurferOptions['peaks'],
    duration?: number,
  ): Promise<'superseded' | undefined> {
    // destroy() is terminal: a post-destroy load must reject (catchably --
    // this async throw becomes a rejection that load()/loadBlob() classify
    // and re-emit as 'error') rather than resurrect torn-down bridges.
    // Notably the v7 record plugin could reach this from its async
    // MediaRecorder onstop after the app destroyed the instance.
    if (this.isDestroyed) {
      throw new Error('Cannot load audio: wavesurfer was destroyed. Create a new instance instead.')
    }

    // Re-entrancy guard: a fresh child scope for this load call.
    // If a newer load starts (or the instance is destroyed) while this one is
    // in-flight, this scope is disposed and this call bails out at the next
    // checkpoint below.
    // Mark the previous load's scope as superseded right now, synchronously,
    // at the only place supersession can happen -- a newer load() starting.
    // This must be a point-in-time mark, not something re-derived later from
    // scope.disposed state: if load(A), then load(B) (superseding A), then
    // destroy() all land in the same tick, A's catch doesn't run until a
    // later microtask, by which point destroy() has *also* disposed the
    // owning scope -- so "disposed" alone can no longer distinguish "A was
    // superseded before destroy" from "A was destroyed". The mark captured
    // here is unambiguous regardless of what happens afterward.
    if (this.loadScope && !this.loadScope.disposed) {
      this.supersededLoadScopes.add(this.loadScope)
    }
    this.loadScope?.dispose()
    const loadScope = this.scope.child()
    this.loadScope = loadScope

    // The pipeline below -- starting with the 'load' emit -- can throw or
    // reject when this load is superseded by a newer load() (e.g. an aborted
    // fetch rejects with AbortError) or when a user's synchronous listener
    // (e.g. on 'load') throws. Such failures must never escape loadAudio
    // unhandled -- they're either noise from cancelling a stale load, or a
    // genuine failure that must be classified and reported the same way
    // regardless of where in the pipeline it originated. A destroy-triggered
    // abort is different: it must still propagate (see the catch below), so
    // load()/loadBlob()'s catch blocks only ever see "supersession, already
    // filtered" or "a real failure/destroy, handle it." The try opens here,
    // above the emit/setUrl/setPeaks/pause section, so a synchronous throw
    // from any of those is covered by the same catch as the async pipeline --
    // the catch's supersede/destroy classification only consults `loadScope`
    // and the WeakSet, so it's correct regardless of where the throw came from.
    try {
      this.emit('load', url)

      // Only the fetch path goes through 'fetching' -- pre-decoded data
      // (blob/channelData already provided) skips straight to 'decoding' below.
      if (!loadScope.disposed && !blob && !channelData) {
        this.wavesurferActions.setLoadPhase('fetching')
      }

      this.wavesurferActions.setUrl(url || '')
      if (channelData) {
        this.wavesurferActions.setPeaks(channelData)
      } else {
        this.wavesurferActions.setPeaks(null)
      }

      if (!this.options.media && this.isPlaying()) this.pause()

      this.decodedData = null
      this.wavesurferActions.setAudioBuffer(null)
      this.player.clearStopAt()

      // Fetch the entire audio as a blob if pre-decoded data is not provided
      if (!blob && !channelData) {
        // Shallow-copy: this.options.fetchParams is a user-owned object that may be
        // reused across multiple load() calls. Writing our per-load abort signal
        // onto it directly would leak load N's (eventually aborted) signal into
        // load N+1's fetch, since `!fetchParams.signal` would then already be false.
        const fetchParams = { ...this.options.fetchParams }
        if (!fetchParams.signal) {
          fetchParams.signal = loadScope.abortSignal()
        }
        const onProgress = (percentage: number) => this.emit('loading', percentage)
        blob = await Fetcher.fetchBlob(url, onProgress, fetchParams)
        // Guard: bail if a newer load started or the instance was destroyed
        if (loadScope.disposed) return this.bailedLoadOutcome(loadScope)
        const overriddenMimeType = this.options.blobMimeType
        if (overriddenMimeType) {
          blob = new Blob([blob], { type: overriddenMimeType })
        }
      }

      // Guard: bail if a newer load started or the instance was destroyed
      if (loadScope.disposed) return this.bailedLoadOutcome(loadScope)

      // Set the mediaelement source
      this.player.setSrc(url, blob)

      // Wait for the audio duration
      const audioDuration = await new Promise<number>((resolve) => {
        const staticDuration = duration || this.getDuration()
        if (staticDuration) {
          resolve(staticDuration)
        } else {
          this.mediaEventScope.add(
            this.player.onMediaEvent('loadedmetadata', () => resolve(this.getDuration()), { once: true }),
          )
          // Settle if the media-event bridge is torn down before
          // 'loadedmetadata' ever fires: setMediaElement() disposes
          // mediaEventScope (killing the listener above) WITHOUT disposing
          // loadScope, so without this hook the promise -- and thus
          // loadAudio()/load() -- would hang forever; the load then continues
          // against the new media with an unknown (0) duration, and the
          // decode step recovers the real duration where possible.
          const settleOnBridgeTeardown = this.mediaEventScope.add(() => resolve(0))
          // Also settle if this load is superseded or the instance is
          // destroyed before 'loadedmetadata' ever fires (e.g. never emitted
          // by the test/media environment). Running settleOnBridgeTeardown
          // here both resolves the promise and deregisters the bridge hook
          // above, so completed loads don't accumulate stale disposers on
          // mediaEventScope. Late registration on an already-disposed scope
          // runs immediately (see Scope.add), so this is safe even if
          // loadScope somehow disposes synchronously before this line runs.
          // The resolved value is discarded either way: the very next
          // `if (loadScope.disposed) return` bails before audioDuration is
          // used.
          loadScope.add(settleOnBridgeTeardown)
        }
      })

      // Guard: bail if a newer load started or the instance was destroyed
      if (loadScope.disposed) return this.bailedLoadOutcome(loadScope)

      // Back-patch the duration when there was no URL to derive it from
      // (a no-op except on the WebAudio backend -- see Player.setDuration)
      if (!url && !blob) {
        this.player.setDuration(audioDuration)
      }

      if (!loadScope.disposed) {
        this.wavesurferActions.setLoadPhase('decoding')
      }

      // Decode the audio data or use user-provided peaks
      if (channelData) {
        this.decodedData = Decoder.createBuffer(channelData, audioDuration || 0)
      } else if (blob) {
        const arrayBuffer = await blob.arrayBuffer()
        // Guard: bail if a newer load started or the instance was destroyed
        if (loadScope.disposed) return this.bailedLoadOutcome(loadScope)
        // Decode into a local first: assigning `this.decodedData = await ...`
        // directly would repopulate the field AFTER destroy()'s cleanup ran
        // (the continuation resumes past it), retaining the large buffer on a
        // destroyed instance.
        const decoded = await Decoder.decode(arrayBuffer, this.options.sampleRate)
        if (loadScope.disposed) return this.bailedLoadOutcome(loadScope)
        this.decodedData = decoded
      }

      // Guard: bail if a newer load started or the instance was destroyed
      if (loadScope.disposed) return this.bailedLoadOutcome(loadScope)

      if (this.decodedData) {
        this.wavesurferActions.setAudioBuffer(this.decodedData)
        this.emit('decode', this.getDuration())
        this.renderer.render(this.decodedData)
      }

      // The 'ready' emit is deliberately NOT guarded: v7 has always emitted
      // it once execution passes the last checkpoint, even if a listener on
      // 'decode' called destroy()/load() synchronously, and consumers rely
      // on that timing. The phase write IS guarded so a cancelled load can
      // never stamp 'ready' onto state a newer load (or none) now owns. In
      // the narrow cancelled-during-decode window the two therefore
      // disagree: the event fires while loadPhase stays 'decoding'.
      if (!loadScope.disposed) {
        this.wavesurferActions.setLoadPhase('ready')
      }
      this.emit('ready', this.getDuration())
    } catch (err) {
      // Superseded loads were marked in supersededLoadScopes at the moment
      // supersession happened (see the top of this method): swallow the raw
      // pipeline error (e.g. the aborted fetch's AbortError) -- the new load
      // owns the state now -- and report the supersession outcome so load()
      // rejects with the canonical AbortError instead. Everything else --
      // destroy mid-load, or a genuine failure -- must propagate so
      // load()/loadBlob() rejects and emits 'error' (issue #3637 /
      // cypress/e2e/abort.cy.js contract).
      if (!this.supersededLoadScopes.has(loadScope)) {
        // Write the 'error' phase here, not in load()/loadBlob()'s catches,
        // and only when this load is still the current one (this.loadScope
        // === loadScope) or the instance has since been destroyed
        // (this.loadScope === null, set by destroy()) -- a stale load's
        // late rejection must not clobber a newer load's in-flight phase.
        if (this.loadScope === loadScope || this.loadScope === null) {
          this.wavesurferActions.setLoadPhase('error')
        }
        throw err
      }
      return 'superseded'
    }
    return undefined
  }

  /**
   * Classify the settled loadAudio() pipeline for the public promise:
   * a superseded load rejects with a canonical AbortError (v8) but emits NO
   * public 'error' event -- supersession is normal control flow, not a
   * failure; every real rejection (destroy mid-load, fetch/decode failure)
   * keeps emitting 'error' before propagating. A no-op rejection handler is
   * attached to the SAME promise object that is returned, so fire-and-forget
   * callers produce no unhandled-rejection noise while awaiting callers
   * still observe the rejection.
   */
  private classifyLoadResult(loadResult: Promise<'superseded' | undefined>): Promise<void> {
    const promise = loadResult.then(
      (outcome) => {
        if (outcome === 'superseded') {
          throw new DOMException('The load was superseded by a newer load call', 'AbortError')
        }
      },
      (err) => {
        this.emit('error', err as Error)
        throw err
      },
    )
    promise.catch(() => undefined)
    return promise
  }

  /**
   * Load an audio file by URL, with optional pre-decoded audio data.
   * If a newer load()/loadBlob() supersedes this call before it completes,
   * the returned promise rejects with an AbortError DOMException (and no
   * 'error' event is emitted for it).
   */
  public load(url: string, channelData?: WaveSurferOptions['peaks'], duration?: number): Promise<void> {
    return this.classifyLoadResult(this.loadAudio(url, undefined, channelData, duration))
  }

  /**
   * Load an audio blob.
   * If a newer load()/loadBlob() supersedes this call before it completes,
   * the returned promise rejects with an AbortError DOMException (and no
   * 'error' event is emitted for it).
   */
  public loadBlob(blob: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number): Promise<void> {
    return this.classifyLoadResult(this.loadAudio('', blob, channelData, duration))
  }

  /** Zoom the waveform by a given pixels-per-second factor */
  public zoom(minPxPerSec: number) {
    if (!this.decodedData) {
      throw new Error('No audio loaded')
    }
    this.renderer.zoom(minPxPerSec)
    this.wavesurferActions.setZoom(minPxPerSec)
    this.emit('zoom', minPxPerSec)
  }

  /** Get the decoded audio data */
  public getDecodedData(): AudioBuffer | null {
    return this.decodedData
  }

  /** Get decoded peaks */
  public exportPeaks({ channels = 2, maxLength = 8000, precision = 10_000 } = {}): Array<number[]> {
    if (!this.decodedData) {
      throw new Error('The audio has not been decoded yet')
    }
    const maxChannels = Math.min(channels, this.decodedData.numberOfChannels)
    const peaks = []
    for (let i = 0; i < maxChannels; i++) {
      const channel = this.decodedData.getChannelData(i)
      const data = []
      const sampleSize = channel.length / maxLength
      for (let j = 0; j < maxLength; j++) {
        const sample = channel.slice(Math.floor(j * sampleSize), Math.ceil((j + 1) * sampleSize))
        let max = 0
        for (let x = 0; x < sample.length; x++) {
          const n = sample[x]
          if (Math.abs(n) > Math.abs(max)) max = n
        }
        data.push(Math.round(max * precision) / precision)
      }
      peaks.push(data)
    }
    return peaks
  }

  /** Get the duration of the audio in seconds */
  public getDuration(): number {
    let duration = this.player.getDuration() || 0
    // Fall back to the decoded data duration if the media duration is incorrect
    if ((duration === 0 || duration === Infinity) && this.decodedData) {
      duration = this.decodedData.duration
    }
    return duration
  }

  /** Toggle if the waveform should react to clicks */
  public toggleInteraction(isInteractive: boolean) {
    this.options.interact = isInteractive
  }

  /** Jump to a specific time in the audio (in seconds) */
  public setTime(time: number) {
    if (this.isDestroyed) return
    this.player.setTime(time)
    this.updateProgress(time)
    this.emit('timeupdate', time)
  }

  /** Seek to a ratio of audio as [0..1] (0 = beginning, 1 = end) */
  public seekTo(progress: number) {
    const time = this.getDuration() * progress
    this.setTime(time)
  }

  /** Pause the audio */
  public pause(): void {
    if (this.isDestroyed) return
    this.player.pause()
  }

  /** Check if the audio is playing */
  public isPlaying(): boolean {
    return this.player.isPlaying()
  }

  /** Check if the audio is seeking */
  public isSeeking(): boolean {
    return this.player.isSeeking()
  }

  /** Get the current audio position in seconds */
  public getCurrentTime(): number {
    return this.player.getCurrentTime()
  }

  /** Get the audio volume */
  public getVolume(): number {
    return this.player.getVolume()
  }

  /** Set the audio volume */
  public setVolume(volume: number) {
    if (this.isDestroyed) return
    this.player.setVolume(volume)
  }

  /** Get the audio muted state */
  public getMuted(): boolean {
    return this.player.getMuted()
  }

  /** Mute or unmute the audio */
  public setMuted(muted: boolean) {
    if (this.isDestroyed) return
    this.player.setMuted(muted)
  }

  /** Get the playback speed */
  public getPlaybackRate(): number {
    return this.player.getPlaybackRate()
  }

  /** Set the playback speed, pass an optional false to NOT preserve the pitch */
  public setPlaybackRate(rate: number, preservePitch?: boolean) {
    if (this.isDestroyed) return
    this.player.setPlaybackRate(rate, preservePitch)
  }

  /** Set a sink id to change the audio output device */
  public setSinkId(sinkId: string): Promise<void> {
    if (this.isDestroyed) return Promise.resolve()
    return this.player.setSinkId(sinkId)
  }

  /**
   * Get the HTML media element.
   *
   * Returns `null` under the WebAudio backend (i.e. when the current media is
   * a WebAudioPlayer -- either `backend: 'WebAudio'` or a user-supplied
   * WebAudioPlayer), which has no HTML media element. Breaking change in v8:
   * previously the WebAudioPlayer itself was returned, mistyped as an
   * HTMLMediaElement.
   */
  public getMediaElement(): HTMLMediaElement | null {
    return this.player.getMediaElement()
  }

  /** Start playing the audio */
  public async play(start?: number, end?: number): Promise<void> {
    // Terminal destroy: playing a destroyed instance would restart media
    // that Player.destroy() deliberately leaves untouched (user-supplied
    // elements). Resolve as a no-op, consistent with the other mutators.
    if (this.isDestroyed) return
    if (start != null) {
      this.setTime(start)
    }

    const playResult = await this.player.play()
    if (end != null) {
      this.player.stopAt(end)
    }

    return playResult
  }

  /** Play or pause the audio */
  public async playPause(): Promise<void> {
    return this.isPlaying() ? this.pause() : this.play()
  }

  /** Stop the audio and go to the beginning */
  public stop() {
    this.pause()
    this.setTime(0)
  }

  /** Skip N or -N seconds from the current position */
  public skip(seconds: number) {
    this.setTime(this.getCurrentTime() + seconds)
  }

  /** Empty the waveform */
  public empty() {
    // Fire-and-forget by design; failures surface via the 'error' event
    this.load('', [[0]], 0.001).catch(() => undefined)
  }

  /** Set HTML media element */
  public setMediaElement(element: HTMLMediaElement) {
    if (this.isDestroyed) return
    this.unsubscribePlayerEvents()

    // A WebAudioPlayer may also be passed here (cast to HTMLMediaElement),
    // mirroring the `media` option. Swapping between an element and a
    // WebAudioPlayer replaces the player instance; the old one is detached
    // (its wavesurfer-created resources released, the media itself left
    // alive, matching the previous swap semantics). An internally-created
    // WebAudioPlayer swapped out here is still fully torn down on destroy()
    // via internalWebAudioPlayer.
    if (element instanceof WebAudioPlayer) {
      if (this.player !== element) {
        this.player.detach()
        this.player = element
        this.playerIsExternal = element !== this.internalWebAudioPlayer
      }
    } else if (this.player instanceof MediaElementPlayer) {
      this.player.setMediaElement(element)
    } else {
      this.player.detach()
      this.player = new MediaElementPlayer({ media: element })
      this.playerIsExternal = false
    }

    this.initPlayerEvents()
  }

  /**
   * Export the waveform image as a data-URI or a blob.
   *
   * @param format The format of the exported image, can be `image/png`, `image/jpeg`, `image/webp` or any other format supported by the browser.
   * @param quality The quality of the exported image, for `image/jpeg` or `image/webp`. Must be between 0 and 1.
   * @param type The type of the exported image, can be `dataURL` (default) or `blob`.
   * @returns A promise that resolves with an array of data-URLs or blobs, one for each canvas element.
   */
  public async exportImage(format: string, quality: number, type: 'dataURL'): Promise<string[]>
  public async exportImage(format: string, quality: number, type: 'blob'): Promise<Blob[]>
  public async exportImage(
    format = 'image/png',
    quality = 1,
    type: 'dataURL' | 'blob' = 'dataURL',
  ): Promise<string[] | Blob[]> {
    return this.renderer.exportImage(format, quality, type)
  }

  /**
   * Unmount wavesurfer. Terminal: the instance is not usable afterwards --
   * load()/loadBlob() reject, registerPlugin() throws, and everything else
   * is a safe no-op. Create a new instance instead of reusing a destroyed one.
   */
  public destroy() {
    if (this.isDestroyed) return
    this.isDestroyed = true
    this.emit('destroy')
    this.plugins.forEach((plugin) => plugin.destroy())
    // this.scope.dispose() cascades to loadScope (a child), which aborts any
    // in-flight fetch via its abortSignal() -- no separate abort call needed.
    // It also releases the reactive state's computed graph (registered in
    // the constructor).
    this.scope.dispose()
    this.loadScope = null
    // Release the decoded audio -- a destroyed-but-still-referenced instance
    // (common with framework refs) must not pin the full AudioBuffer.
    this.decodedData = null
    this.wavesurferActions.setAudioBuffer(null)
    this.renderer.destroy()
    // A user-owned player (a user-supplied WebAudioPlayer) must survive
    // wavesurfer.destroy(): release only what WaveSurfer created on it.
    // Owned players get the full teardown -- MediaElementPlayer itself knows
    // to leave a user-supplied *element* alone.
    if (this.playerIsExternal) {
      this.player.detach()
    } else {
      this.player.destroy()
    }
    // Clear all event emitter listeners (previously done inside
    // Player.destroy() when WaveSurfer and Player shared one emitter)
    this.unAll()
    // Tear down the internally-created WebAudio backend even if
    // setMediaElement() swapped it out of `player`; destroy() is idempotent,
    // so double-destroying the current player is safe.
    this.internalWebAudioPlayer?.destroy()
  }
}

// Export reactive types for plugin authors
export type { Signal, WritableSignal } from './reactive/store.js'
export type { WaveSurferState, WaveSurferActions, LoadPhase } from './state/wavesurfer-state.js'

// The functional plugin API (`definePlugin`) is exposed as a static on the
// WaveSurfer class (`WaveSurfer.definePlugin`), not as a runtime named
// export here: the main-entry rollup outputs (cjs/umd) use
// `output.exports: 'default'`, which hard-errors if a runtime named export
// exists alongside the default export. Only type-only re-exports are safe
// here since types are erased before rollup sees them.
export type { PluginContext, PluginSetup, DefinedPlugin } from './define-plugin.js'

export default WaveSurfer
