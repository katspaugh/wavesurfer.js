import BasePlugin, { type GenericPlugin } from './base-plugin.js'
import Decoder from './decoder.js'
import { definePlugin } from './define-plugin.js'
import * as dom from './dom.js'
import EventEmitter from './event-emitter.js'
import Fetcher from './fetcher.js'
import { FrameScheduler } from './frame-scheduler.js'
import Player from './player.js'
import Renderer from './renderer.js'
import { effect } from './reactive/store.js'
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
  // The playback engine. WaveSurfer owns it by composition (not inheritance)
  // and delegates the public playback API to it below.
  private player: Player
  private renderer: Renderer
  private plugins: GenericPlugin[] = []
  private decodedData: AudioBuffer | null = null
  private stopAtPosition: number | null = null
  // The WebAudioPlayer this instance created for backend: 'WebAudio', if any.
  // Owned here (not by Player, which sees it as external media) so destroy()
  // can tear it down -- stopping playback and closing its AudioContext.
  private internalWebAudioPlayer: WebAudioPlayer | null = null
  // The WebAudioPlayer currently acting as the media, if any -- the internal
  // one, or a user-supplied one. Classified once at construction and updated
  // in setMediaElement() (the only two instanceof checks); everywhere else
  // this field replaces what used to be scattered instanceof branches.
  // Invariant: non-null iff the player's current media IS a WebAudioPlayer.
  private webAudioPlayer: WebAudioPlayer | null = null
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

    // A WebAudioPlayer created here (backend: 'WebAudio' with no user-supplied
    // media) is owned by this instance. It is handed to Player as `media`, so
    // Player classifies it as *external* and skips its teardown in destroy()
    // -- WaveSurfer must therefore destroy it itself (see destroy() below).
    const internalWebAudioPlayer = !options.media && options.backend === 'WebAudio' ? new WebAudioPlayer() : null
    const media = options.media ?? internalWebAudioPlayer ?? undefined

    this.player = new Player({
      media,
      mediaControls: options.mediaControls,
      autoplay: options.autoplay,
      playbackRate: options.audioRate,
    })

    this.internalWebAudioPlayer = internalWebAudioPlayer
    // The single classification point (with setMediaElement) for the media
    // being a WebAudioPlayer -- a user may pass their own via options.media.
    this.webAudioPlayer = internalWebAudioPlayer ?? (options.media instanceof WebAudioPlayer ? options.media : null)

    this.options = Object.assign({}, defaultOptions, options)

    // Initialize reactive state
    // Pass Player signals to compose them into WaveSurferState
    const { state, actions, dispose } = createWaveSurferState({
      isPlaying: this.player.isPlayingSignal,
      currentTime: this.player.currentTimeSignal,
      duration: this.player.durationSignal,
      volume: this.player.volumeSignal,
      muted: this.player.mutedSignal,
      playbackRate: this.player.playbackRateSignal,
      isSeeking: this.player.seekingSignal,
    })
    this.wavesurferState = state
    this.wavesurferActions = actions
    // destroy() is terminal, so the state's computed graph is released with
    // everything else owned by this.scope.
    this.scope.add(dispose)

    // When no media was supplied, Player created its own <audio> element --
    // hand that raw element to the renderer so it can be mounted in the DOM.
    const audioElement = media ? undefined : this.player.getMediaElement()
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
  // animation while playing.
  private onTick = () => {
    if (!this.isSeeking()) {
      const currentTime = this.updateProgress()
      this.emit('timeupdate', currentTime)
      this.emit('audioprocess', currentTime)

      // Pause audio when it reaches the stopAtPosition
      if (this.stopAtPosition != null && this.isPlaying() && currentTime >= this.stopAtPosition) {
        // The scheduler may overshoot the stop position, so clamp the time back to it
        const stopAt = this.stopAtPosition
        this.pause()
        this.setTime(stopAt)
      }
    }
  }

  private initPlayerEvents() {
    if (this.isPlaying()) {
      this.emit('play')
      this.frameScheduler.start(this.onTick)
    }

    this.mediaEventScope.add(
      this.player.onMediaEvent('timeupdate', () => {
        const currentTime = this.updateProgress()
        this.emit('timeupdate', currentTime)
        // onTick (rAF-driven) normally enforces stopAtPosition, but rAF is
        // suspended in hidden tabs while media 'timeupdate' keeps firing --
        // without this check, play(start, end) overshoots arbitrarily in a
        // background tab.
        if (this.stopAtPosition != null && this.isPlaying() && currentTime >= this.stopAtPosition) {
          const stopAt = this.stopAtPosition
          this.pause()
          this.setTime(stopAt)
        }
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
        this.stopAtPosition = null
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('emptied', () => {
        this.frameScheduler.stop()
        this.stopAtPosition = null
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('ended', () => {
        this.emit('timeupdate', this.getDuration())
        this.emit('finish')
        this.stopAtPosition = null
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('seeking', () => {
        this.emit('seeking', this.getCurrentTime())
      }),
    )

    this.mediaEventScope.add(
      this.player.onMediaEvent('error', () => {
        // Deliberately the raw media (never null): under the WebAudio backend
        // the error lives on the WebAudioPlayer's media surface.
        this.emit('error', (this.player.getMediaElement().error ?? new Error('Media error')) as Error)
        this.stopAtPosition = null
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
      // Deliberately the raw media (never null): writing `controls` on a
      // WebAudioPlayer is a harmless no-op, exactly as before.
      this.player.getMediaElement().controls = options.mediaControls
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

  private async loadAudio(url: string, blob?: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number) {
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
      this.stopAtPosition = null

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
        if (loadScope.disposed) return
        const overriddenMimeType = this.options.blobMimeType
        if (overriddenMimeType) {
          blob = new Blob([blob], { type: overriddenMimeType })
        }
      }

      // Guard: bail if a newer load started or the instance was destroyed
      if (loadScope.disposed) return

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
          // Settle if this load is superseded or the instance is destroyed
          // before 'loadedmetadata' ever fires (e.g. never emitted by the
          // test/media environment) -- otherwise this promise, and thus
          // loadAudio()/load(), would hang forever. Registered on loadScope
          // (not mediaEventScope, which the 'loadedmetadata' listener above
          // must stay on -- moving it there would remove it, and thus resolve
          // this promise, on every load's disposal, not just this one's).
          // Late registration on an already-disposed scope runs immediately
          // (see Scope.add), so this is safe even if loadScope somehow
          // disposes synchronously before this line runs. The resolved value
          // is discarded either way: the very next `if (loadScope.disposed)
          // return` bails before audioDuration is used.
          loadScope.add(() => resolve(0))
        }
      })

      // Guard: bail if a newer load started or the instance was destroyed
      if (loadScope.disposed) return

      // Set the duration if the player is a WebAudioPlayer without a URL
      if (!url && !blob && this.webAudioPlayer) {
        this.webAudioPlayer.duration = audioDuration
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
        if (loadScope.disposed) return
        this.decodedData = await Decoder.decode(arrayBuffer, this.options.sampleRate)
      }

      // Guard: bail if a newer load started or the instance was destroyed
      if (loadScope.disposed) return

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
      // supersession happened (see the top of this method): swallow those,
      // the new load owns the state now. Everything else -- destroy
      // mid-load, or a genuine failure -- must propagate so load()/loadBlob()
      // rejects and emits 'error' (issue #3637 / cypress/e2e/abort.cy.js
      // contract).
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
    }
  }

  /** Load an audio file by URL, with optional pre-decoded audio data */
  public async load(url: string, channelData?: WaveSurferOptions['peaks'], duration?: number) {
    try {
      return await this.loadAudio(url, undefined, channelData, duration)
    } catch (err) {
      this.emit('error', err as Error)
      throw err
    }
  }

  /** Load an audio blob */
  public async loadBlob(blob: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number) {
    try {
      return await this.loadAudio('', blob, channelData, duration)
    } catch (err) {
      this.emit('error', err as Error)
      throw err
    }
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
    this.stopAtPosition = null
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
    this.player.setVolume(volume)
  }

  /** Get the audio muted state */
  public getMuted(): boolean {
    return this.player.getMuted()
  }

  /** Mute or unmute the audio */
  public setMuted(muted: boolean) {
    this.player.setMuted(muted)
  }

  /** Get the playback speed */
  public getPlaybackRate(): number {
    return this.player.getPlaybackRate()
  }

  /** Set the playback speed, pass an optional false to NOT preserve the pitch */
  public setPlaybackRate(rate: number, preservePitch?: boolean) {
    this.player.setPlaybackRate(rate, preservePitch)
  }

  /** Set a sink id to change the audio output device */
  public setSinkId(sinkId: string): Promise<void> {
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
    // Invariant (see the webAudioPlayer field): non-null iff it IS the
    // player's current media.
    return this.webAudioPlayer ? null : this.player.getMediaElement()
  }

  /** Start playing the audio */
  public async play(start?: number, end?: number): Promise<void> {
    if (start != null) {
      this.setTime(start)
    }

    const playResult = await this.player.play()
    if (end != null) {
      if (this.webAudioPlayer) {
        this.webAudioPlayer.stopAt(end)
      } else {
        this.stopAtPosition = end
      }
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
    this.player.setMediaElement(element)
    // Re-classify: the new media may be (or replace) a WebAudioPlayer
    this.webAudioPlayer = element instanceof WebAudioPlayer ? element : null
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
    this.player.destroy()
    // Clear all event emitter listeners (previously done inside
    // Player.destroy() when WaveSurfer and Player shared one emitter)
    this.unAll()
    // Player.destroy() skips media teardown for external media -- which
    // includes the WebAudioPlayer this instance created itself for
    // backend: 'WebAudio' (it was passed in via the media option). Without
    // this, destroy() leaves WebAudio playback running and the AudioContext
    // open forever. WebAudioPlayer.destroy() is idempotent.
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
