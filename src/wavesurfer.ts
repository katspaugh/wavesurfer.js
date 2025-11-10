import BasePlugin, { type GenericPlugin } from './base-plugin.js'
import Decoder from './decoder.js'
import * as dom from './dom.js'
import Fetcher from './fetcher.js'
import Player from './player.js'
import Renderer from './renderer.js'
import WebAudioPlayer from './webaudio.js'
import { createWaveSurferState, type WaveSurferState, type WaveSurferActions } from './state/wavesurfer-state.js'
import { bridgeMediaEvents } from './reactive/media-event-bridge.js'
import { setupStateEventEmission } from './reactive/state-event-emitter.js'
import { effect } from './reactive/store.js'

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
  /** Render each audio channel as a separate waveform */
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

class WaveSurfer extends Player<WaveSurferEvents> {
  public options: WaveSurferOptions & typeof defaultOptions
  private renderer: Renderer
  private plugins: GenericPlugin[] = []
  private decodedData: AudioBuffer | null = null
  private stopAtPosition: number | null = null
  protected subscriptions: Array<() => void> = []
  protected mediaSubscriptions: Array<() => void> = []
  protected abortController: AbortController | null = null

  // Reactive state
  private wavesurferState: WaveSurferState
  private wavesurferActions: WaveSurferActions
  private reactiveCleanups: Array<() => void> = []

  public static readonly BasePlugin = BasePlugin
  public static readonly dom = dom

  /** Create a new WaveSurfer instance */
  public static create(options: WaveSurferOptions) {
    return new WaveSurfer(options)
  }

  /** Create a new WaveSurfer instance */
  constructor(options: WaveSurferOptions) {
    const media =
      options.media ||
      (options.backend === 'WebAudio' ? (new WebAudioPlayer() as unknown as HTMLAudioElement) : undefined)

    super({
      media,
      mediaControls: options.mediaControls,
      autoplay: options.autoplay,
      playbackRate: options.audioRate,
    })

    this.options = Object.assign({}, defaultOptions, options)

    // Initialize reactive state
    const { state, actions } = createWaveSurferState()
    this.wavesurferState = state
    this.wavesurferActions = actions

    const audioElement = media ? undefined : this.getMediaElement()
    this.renderer = new Renderer(this.options, audioElement)

    this.initPlayerEvents()
    this.initRendererEvents()
    this.initReactiveAnimation()
    this.initPlugins()

    // Bridge media events to reactive state
    this.reactiveCleanups.push(bridgeMediaEvents(this.getMediaElement(), this.wavesurferActions))

    // Bridge reactive state to legacy event emission
    this.reactiveCleanups.push(
      setupStateEventEmission(this.wavesurferState, {
        emit: this.emit.bind(this),
      }),
    )

    // Read the initial URL before load has been called
    const initialUrl = this.options.url || this.getSrc() || ''

    // Init and load async to allow external events to be registered
    Promise.resolve().then(() => {
      this.emit('init')

      // Load audio if URL or an external media with an src is passed,
      // of render w/o audio if pre-decoded peaks and duration are provided
      const { peaks, duration } = this.options
      if (initialUrl || (peaks && duration)) {
        // Swallow async errors because they cannot be caught from a constructor call.
        // Subscribe to the wavesurfer's error event to handle them.
        this.load(initialUrl, peaks, duration).catch((err) => {
          // Emit error event for proper error handling
          this.emit('error', err instanceof Error ? err : new Error(String(err)))
        })
      }
    })
  }

  private updateProgress(currentTime = this.getCurrentTime()): number {
    this.renderer.renderProgress(currentTime / this.getDuration(), this.isPlaying())
    return currentTime
  }

  private initReactiveAnimation() {
    let rafId: number | null = null

    // Animation loop runs automatically while playing
    const cleanup = effect(() => {
      const isPlaying = this.wavesurferState.isPlaying.value

      // Cleanup previous animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }

      if (isPlaying) {
        // Start animation loop
        const animate = () => {
          if (!this.isSeeking()) {
            const currentTime = this.updateProgress()

            // Pause audio when it reaches the stopAtPosition
            if (this.stopAtPosition != null && currentTime >= this.stopAtPosition) {
              this.pause()
              return
            }
          }

          // Continue loop
          rafId = requestAnimationFrame(animate)
        }

        animate()
      }
    }, [this.wavesurferState.isPlaying])

    // Store cleanup that also cancels any pending animation frame
    this.reactiveCleanups.push(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      cleanup()
    })
  }

  private initPlayerEvents() {
    // Initial play state
    if (this.isPlaying()) {
      this.emit('play')
    }

    // Setup side effects for media events
    // Note: Event emission is handled by setupStateEventEmission() via reactive state
    this.mediaSubscriptions.push(
      // Clear stopAtPosition when playback is interrupted
      this.onMediaEvent('pause', () => {
        this.stopAtPosition = null
      }),

      this.onMediaEvent('emptied', () => {
        this.stopAtPosition = null
      }),

      this.onMediaEvent('ended', () => {
        this.stopAtPosition = null
      }),

      this.onMediaEvent('error', () => {
        this.stopAtPosition = null
      }),
    )
  }

  private initRendererEvents() {
    // Seek on click (reactive)
    this.reactiveCleanups.push(
      effect(() => {
        const click = this.renderer.click$.value
        if (click && this.options.interact) {
          this.seekTo(click.x)
          this.emit('interaction', click.x * this.getDuration())
          this.emit('click', click.x, click.y)
        }
      }, [this.renderer.click$]),
    )

    // Double click (reactive)
    this.reactiveCleanups.push(
      effect(() => {
        const dblclick = this.renderer.dblclick$.value
        if (dblclick) {
          this.emit('dblclick', dblclick.x, dblclick.y)
        }
      }, [this.renderer.dblclick$]),
    )

    // Scroll (reactive)
    if (this.renderer.scrollStream) {
      this.reactiveCleanups.push(
        effect(() => {
          const { startX, endX } = this.renderer.scrollStream!.percentages.value
          const { left, right } = this.renderer.scrollStream!.bounds.value
          const duration = this.getDuration()
          this.emit('scroll', startX * duration, endX * duration, left, right)
        }, [this.renderer.scrollStream.percentages]),
      )
    }

    // Redraw (reactive)
    this.reactiveCleanups.push(
      effect(() => {
        if (this.renderer.render$.value !== null) {
          this.emit('redraw')
        }
      }, [this.renderer.render$]),
    )

    // RedrawComplete (reactive)
    this.reactiveCleanups.push(
      effect(() => {
        if (this.renderer.rendered$.value !== null) {
          this.emit('redrawcomplete')
        }
      }, [this.renderer.rendered$]),
    )

    // Resize (reactive)
    this.reactiveCleanups.push(
      effect(() => {
        if (this.renderer.resize$.value !== null) {
          this.emit('resize')
        }
      }, [this.renderer.resize$]),
    )

    // Drag (reactive)
    {
      let debounce: ReturnType<typeof setTimeout> | undefined
      const cleanup = effect(() => {
        const drag = this.renderer.drag$.value
        if (!drag || !this.options.interact) return

        const { x: relativeX, type } = drag

        // Emit drag events
        if (type === 'start') {
          this.emit('dragstart', relativeX)
        } else if (type === 'end') {
          this.emit('dragend', relativeX)
        } else if (type === 'move') {
          // Update the visual position
          this.renderer.renderProgress(relativeX)

          // Set the audio position with a debounce
          clearTimeout(debounce)
          let debounceTime = 0

          const dragToSeek = this.options.dragToSeek
          if (this.isPlaying()) {
            debounceTime = 0
          } else if (dragToSeek === true) {
            debounceTime = 200
          } else if (dragToSeek && typeof dragToSeek === 'object') {
            debounceTime = (dragToSeek as { debounceTime: number }).debounceTime ?? 200
          }

          debounce = setTimeout(() => {
            this.seekTo(relativeX)
          }, debounceTime)

          this.emit('interaction', relativeX * this.getDuration())
          this.emit('drag', relativeX)
        }
      }, [this.renderer.drag$])

      // Clear debounce timeout on destroy
      this.reactiveCleanups.push(() => {
        clearTimeout(debounce)
        cleanup()
      })
    }
  }

  private initPlugins() {
    if (!this.options.plugins?.length) return

    this.options.plugins.forEach((plugin) => {
      this.registerPlugin(plugin)
    })
  }

  private unsubscribePlayerEvents() {
    this.mediaSubscriptions.forEach((unsubscribe) => unsubscribe())
    this.mediaSubscriptions = []
  }

  /** Set new wavesurfer options and re-render it */
  public setOptions(options: Partial<WaveSurferOptions>) {
    this.options = Object.assign({}, this.options, options)
    if (options.duration && !options.peaks) {
      this.decodedData = Decoder.createBuffer(this.exportPeaks(), options.duration)
    }
    if (options.peaks && options.duration) {
      // Create new decoded data buffer from peaks and duration
      this.decodedData = Decoder.createBuffer(options.peaks, options.duration)
    }
    this.renderer.setOptions(this.options)

    if (options.audioRate) {
      this.setPlaybackRate(options.audioRate)
    }
    if (options.mediaControls != null) {
      this.getMediaElement().controls = options.mediaControls
    }
  }

  /** Register a wavesurfer.js plugin */
  public registerPlugin<T extends GenericPlugin>(plugin: T): T {
    // Check if the plugin is already registered
    if (this.plugins.includes(plugin)) {
      return plugin
    }

    plugin._init(this)
    this.plugins.push(plugin)

    // Unregister plugin on destroy
    const unsubscribe = plugin.once('destroy', () => {
      this.plugins = this.plugins.filter((p) => p !== plugin)
      this.subscriptions = this.subscriptions.filter((fn) => fn !== unsubscribe)
    })
    this.subscriptions.push(unsubscribe)

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

  /** For plugins only: get the renderer instance */
  public getRenderer() {
    return this.renderer
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
    this.emit('load', url)

    if (!this.options.media && this.isPlaying()) this.pause()

    this.decodedData = null
    this.stopAtPosition = null

    // Abort any ongoing fetch before starting a new one
    this.abortController?.abort()
    this.abortController = null

    // Fetch the entire audio as a blob if pre-decoded data is not provided
    if (!blob && !channelData) {
      const fetchParams = this.options.fetchParams || {}
      if (window.AbortController && !fetchParams.signal) {
        this.abortController = new AbortController()
        fetchParams.signal = this.abortController.signal
      }
      const onProgress = (percentage: number) => this.emit('loading', percentage)
      blob = await Fetcher.fetchBlob(url, onProgress, fetchParams)
      const overridenMimeType = this.options.blobMimeType
      if (overridenMimeType) {
        blob = new Blob([blob], { type: overridenMimeType })
      }
    }

    // Set the mediaelement source
    this.setSrc(url, blob)

    // Wait for the audio duration
    const audioDuration = await new Promise<number>((resolve) => {
      const staticDuration = duration || this.getDuration()
      if (staticDuration) {
        resolve(staticDuration)
      } else {
        this.mediaSubscriptions.push(
          this.onMediaEvent('loadedmetadata', () => resolve(this.getDuration()), { once: true }),
        )
      }
    })

    // Set the duration if the player is a WebAudioPlayer without a URL
    if (!url && !blob) {
      const media = this.getMediaElement()
      if (media instanceof WebAudioPlayer) {
        media.duration = audioDuration
      }
    }

    // Decode the audio data or use user-provided peaks
    if (channelData) {
      this.decodedData = Decoder.createBuffer(channelData, audioDuration || 0)
    } else if (blob) {
      const arrayBuffer = await blob.arrayBuffer()
      this.decodedData = await Decoder.decode(arrayBuffer, this.options.sampleRate)
    }

    if (this.decodedData) {
      this.emit('decode', this.getDuration())
      this.renderer.render(this.decodedData)
    }

    this.emit('ready', this.getDuration())
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
    let duration = super.getDuration() || 0
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
    super.setTime(time)
    this.updateProgress(time)
    this.emit('timeupdate', time)
  }

  /** Seek to a ratio of audio as [0..1] (0 = beginning, 1 = end) */
  public seekTo(progress: number) {
    const time = this.getDuration() * progress
    this.setTime(time)
  }

  /** Start playing the audio */
  public async play(start?: number, end?: number): Promise<void> {
    if (start != null) {
      this.setTime(start)
    }

    const playResult = await super.play()
    if (end != null) {
      if (this.media instanceof WebAudioPlayer) {
        this.media.stopAt(end)
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
    this.load('', [[0]], 0.001)
  }

  /** Set HTML media element */
  public setMediaElement(element: HTMLMediaElement) {
    this.unsubscribePlayerEvents()
    super.setMediaElement(element)
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

  /** Unmount wavesurfer */
  public destroy() {
    this.emit('destroy')
    this.abortController?.abort()
    this.plugins.forEach((plugin) => plugin.destroy())
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.unsubscribePlayerEvents()
    this.renderer.destroy()
    this.reactiveCleanups.forEach((cleanup) => cleanup())
    super.destroy()
  }
}

export default WaveSurfer
