import type { GenericPlugin } from './base-plugin.js'
import Decoder from './decoder.js'
import Fetcher from './fetcher.js'
import Player from './player.js'
import Renderer from './renderer.js'
import Timer from './timer.js'

export type WaveSurferOptions = {
  /** Required: an HTML element or selector where the waveform will be rendered. */
  container: HTMLElement | string
  /** The height of the waveform in pixels, or "auto" to fill the container height */
  height?: number | 'auto'
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
  /** Allow to drag the cursor to seek to a new position */
  dragToSeek?: boolean
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
  splitChannels?: WaveSurferOptions[]
  /** Stretch the waveform to the full height */
  normalize?: boolean
  /** The list of plugins to initialize on start */
  plugins?: GenericPlugin[]
  /** Custom render function */
  renderFunction?: (peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D) => void
  /** Options to pass to the fetch method */
  fetchParams?: RequestInit
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
  /** When audio starts loading */
  load: [url: string]
  /** During audio loading */
  loading: [percent: number]
  /** When the audio has been decoded */
  decode: [duration: number]
  /** When the audio is both decoded and can play */
  ready: [duration: number]
  /** When a waveform is drawn */
  redraw: []
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
  /** When the waveform is scrolled (panned) */
  scroll: [visibleStartTime: number, visibleEndTime: number]
  /** When the zoom level changes */
  zoom: [minPxPerSec: number]
  /** Just before the waveform is destroyed so you can clean up your events */
  destroy: []
}

class WaveSurfer extends Player<WaveSurferEvents> {
  public options: WaveSurferOptions & typeof defaultOptions
  private renderer: Renderer
  private timer: Timer
  private plugins: GenericPlugin[] = []
  private decodedData: AudioBuffer | null = null
  protected subscriptions: Array<() => void> = []

  /** Create a new WaveSurfer instance */
  public static create(options: WaveSurferOptions) {
    return new WaveSurfer(options)
  }

  /** Create a new WaveSurfer instance */
  constructor(options: WaveSurferOptions) {
    super({
      media: options.media,
      mediaControls: options.mediaControls,
      autoplay: options.autoplay,
      playbackRate: options.audioRate,
    })

    this.options = Object.assign({}, defaultOptions, options)
    this.timer = new Timer()

    const audioElement = !options.media ? this.getMediaElement() : undefined
    this.renderer = new Renderer(this.options, audioElement)

    this.initPlayerEvents()
    this.initRendererEvents()
    this.initTimerEvents()
    this.initPlugins()

    // Load audio if URL is passed or an external media with an src
    const url = this.options.url || this.options.media?.currentSrc || this.options.media?.src
    if (url) {
      this.load(url, this.options.peaks, this.options.duration)
    }
  }

  private initTimerEvents() {
    // The timer fires every 16ms for a smooth progress animation
    this.subscriptions.push(
      this.timer.on('tick', () => {
        const currentTime = this.getCurrentTime()
        this.renderer.renderProgress(currentTime / this.getDuration(), true)
        this.emit('timeupdate', currentTime)
        this.emit('audioprocess', currentTime)
      }),
    )
  }

  private initPlayerEvents() {
    this.subscriptions.push(
      this.onMediaEvent('timeupdate', () => {
        const currentTime = this.getCurrentTime()
        this.renderer.renderProgress(currentTime / this.getDuration(), this.isPlaying())
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
      this.renderer.on('scroll', (startX, endX) => {
        const duration = this.getDuration()
        this.emit('scroll', startX * duration, endX * duration)
      }),

      // Redraw
      this.renderer.on('render', () => {
        this.emit('redraw')
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
          debounce = setTimeout(
            () => {
              this.seekTo(relativeX)
            },
            this.isPlaying() ? 0 : 200,
          )

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
    plugin.init(this)
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

  /** Get the current scroll position in pixels */
  public getScroll(): number {
    return this.renderer.getScroll()
  }

  /** Get all registered plugins */
  public getActivePlugins() {
    return this.plugins
  }

  private async loadAudio(url: string, blob?: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number) {
    this.emit('load', url)

    if (this.isPlaying()) this.pause()

    this.decodedData = null

    // Fetch the entire audio as a blob if pre-decoded data is not provided
    if (!blob && !channelData) {
      const onProgress = (percentage: number) => this.emit('loading', percentage)
      blob = await Fetcher.fetchBlob(url, onProgress, this.options.fetchParams)
    }

    // Set the mediaelement source
    this.setSrc(url, blob)

    // Decode the audio data or use user-provided peaks
    if (channelData) {
      // Wait for the audio duration
      // It should be a promise to allow event listeners to subscribe to the ready and decode events
      duration =
        (await Promise.resolve(duration || this.getDuration())) ||
        (await new Promise((resolve) => {
          this.onceMediaEvent('loadedmetadata', () => resolve(this.getDuration()))
        })) ||
        (await Promise.resolve(0))

      this.decodedData = Decoder.createBuffer(channelData, duration)
    } else if (blob) {
      const arrayBuffer = await blob.arrayBuffer()
      this.decodedData = await Decoder.decode(arrayBuffer, this.options.sampleRate)
    }

    this.emit('decode', this.getDuration())

    // Render the waveform
    if (this.decodedData) {
      this.renderer.render(this.decodedData)
    }

    this.emit('ready', this.getDuration())
  }

  /** Load an audio file by URL, with optional pre-decoded audio data */
  public async load(url: string, channelData?: WaveSurferOptions['peaks'], duration?: number) {
    await this.loadAudio(url, undefined, channelData, duration)
  }

  /** Load an audio blob */
  public async loadBlob(blob: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number) {
    await this.loadAudio('blob', blob, channelData, duration)
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
  public exportPeaks({ channels = 1, maxLength = 8000, precision = 10_000 } = {}): Array<number[]> {
    if (!this.decodedData) {
      throw new Error('The audio has not been decoded yet')
    }
    const channelsLen = Math.min(channels, this.decodedData.numberOfChannels)
    const peaks = []
    for (let i = 0; i < channelsLen; i++) {
      const data = this.decodedData.getChannelData(i)
      const length = Math.min(data.length, maxLength)
      const scale = data.length / length
      const sampledData = []
      for (let j = 0; j < length; j++) {
        const n = Math.round(j * scale)
        const val = data[n]
        sampledData.push(Math.round(val * precision) / precision)
      }
      peaks.push(sampledData)
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

  /** Empty the waveform by loading a tiny silent audio */
  public empty() {
    this.load('', [[0]], 0.001)
  }

  /** Unmount wavesurfer */
  public destroy() {
    this.emit('destroy')
    this.plugins.forEach((plugin) => plugin.destroy())
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.timer.destroy()
    this.renderer.destroy()
    super.destroy()
  }
}

export default WaveSurfer
