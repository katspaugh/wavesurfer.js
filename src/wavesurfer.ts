import BasePlugin, { type GenericPlugin } from './base-plugin.js'
import Decoder from './decoder.js'
import * as dom from './dom.js'
import Fetcher from './fetcher.js'
import Player from './player.js'
import Renderer from './renderer.js'
import Timer from './timer.js'
import WebAudioPlayer from './webaudio.js'

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
  /** The color of the playpack cursor */
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
}

class WaveSurfer extends Player<WaveSurferEvents> {
  public options: WaveSurferOptions & typeof defaultOptions
  private renderer: Renderer
  private timer: Timer
  private plugins: GenericPlugin[] = []
  private decodedData: AudioBuffer | null = null
  protected subscriptions: Array<() => void> = []
  protected mediaSubscriptions: Array<() => void> = []
  protected abortController: AbortController | null = null

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
    this.timer = new Timer()

    const audioElement = media ? undefined : this.getMediaElement()
    this.renderer = new Renderer(this.options, audioElement)

    this.initPlayerEvents()
    this.initRendererEvents()
    this.initTimerEvents()
    this.initPlugins()

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
        this.load(initialUrl, peaks, duration).catch(() => null)
      }
    })
  }

  private updateProgress(currentTime = this.getCurrentTime()): number {
    this.renderer.renderProgress(currentTime / this.getDuration(), this.isPlaying())
    return currentTime
  }

  private initTimerEvents() {
    // The timer fires every 16ms for a smooth progress animation
    this.subscriptions.push(
      this.timer.on('tick', () => {
        if (!this.isSeeking()) {
          const currentTime = this.updateProgress()
          this.emit('timeupdate', currentTime)
          this.emit('audioprocess', currentTime)
        }
      }),
    )
  }

  private initPlayerEvents() {
    if (this.isPlaying()) {
      this.emit('play')
      this.timer.start()
    }

    this.mediaSubscriptions.push(
      this.onMediaEvent('timeupdate', () => {
        const currentTime = this.updateProgress()
        this.emit('timeupdate', currentTime)
      }),

      this.onMediaEvent('play', () => {
        this.emit('play')
        this.timer.start()
      }),

      this.onMediaEvent('pause', () => {
        this.emit('pause')
        this.timer.stop()
      }),

      this.onMediaEvent('emptied', () => {
        this.timer.stop()
      }),

      this.onMediaEvent('ended', () => {
        this.emit('finish')
      }),

      this.onMediaEvent('seeking', () => {
        this.emit('seeking', this.getCurrentTime())
      }),

      this.onMediaEvent('error', (err) => {
        this.emit('error', err.error)
      }),
    )
  }

  private initRendererEvents() {
    this.subscriptions.push(
      // Seek on click
      this.renderer.on('click', (relativeX, relativeY) => {
        if (this.options.interact) {
          this.seekTo(relativeX)
          this.emit('interaction', relativeX * this.getDuration())
          this.emit('click', relativeX, relativeY)
        }
      }),

      // Double click
      this.renderer.on('dblclick', (relativeX, relativeY) => {
        this.emit('dblclick', relativeX, relativeY)
      }),

      // Scroll
      this.renderer.on('scroll', (startX, endX, scrollLeft, scrollRight) => {
        const duration = this.getDuration()
        this.emit('scroll', startX * duration, endX * duration, scrollLeft, scrollRight)
      }),

      // Redraw
      this.renderer.on('render', () => {
        this.emit('redraw')
      }),

      // RedrawComplete
      this.renderer.on('rendered', () => {
        this.emit('redrawcomplete')
      }),

      // DragStart
      this.renderer.on('dragstart', (relativeX) => {
        this.emit('dragstart', relativeX)
      }),

      // DragEnd
      this.renderer.on('dragend', (relativeX) => {
        this.emit('dragend', relativeX)
      }),
    )

    // Drag
    {
      let debounce: ReturnType<typeof setTimeout>
      this.subscriptions.push(
        this.renderer.on('drag', (relativeX) => {
          if (!this.options.interact) return

          // Update the visual position
          this.renderer.renderProgress(relativeX)

          // Set the audio position with a debounce
          clearTimeout(debounce)
          let debounceTime

          if (this.isPlaying()) {
            debounceTime = 0
          } else if (this.options.dragToSeek === true) {
            debounceTime = 200
          } else if (typeof this.options.dragToSeek === 'object' && this.options.dragToSeek !== undefined) {
            debounceTime = this.options.dragToSeek['debounceTime']
          }

          debounce = setTimeout(() => {
            this.seekTo(relativeX)
          }, debounceTime)

          this.emit('interaction', relativeX * this.getDuration())
          this.emit('drag', relativeX)
        }),
      )
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
    plugin._init(this)
    this.plugins.push(plugin)

    // Unregister plugin on destroy
    this.subscriptions.push(
      plugin.once('destroy', () => {
        this.plugins = this.plugins.filter((p) => p !== plugin)
      }),
    )

    return plugin
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
    this.emit('load', url)

    if (!this.options.media && this.isPlaying()) this.pause()

    this.decodedData = null

    // Fetch the entire audio as a blob if pre-decoded data is not provided
    if (!blob && !channelData) {
      const fetchParams = this.options.fetchParams || {}
      if (window.AbortController && !fetchParams.signal) {
        this.abortController = new AbortController()
        fetchParams.signal = this.abortController?.signal
      }
      const onProgress = (percentage: number) => this.emit('loading', percentage)
      blob = await Fetcher.fetchBlob(url, onProgress, fetchParams)
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
      for (let i = 0; i < maxLength; i++) {
        const sample = channel.slice(Math.floor(i * sampleSize), Math.ceil((i + 1) * sampleSize))
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
    super.setTime(time)
    this.updateProgress(time)
    this.emit('timeupdate', time)
  }

  /** Seek to a percentage of audio as [0..1] (0 = beginning, 1 = end) */
  public seekTo(progress: number) {
    const time = this.getDuration() * progress
    this.setTime(time)
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
    this.timer.destroy()
    this.renderer.destroy()
    super.destroy()
  }
}

export default WaveSurfer
