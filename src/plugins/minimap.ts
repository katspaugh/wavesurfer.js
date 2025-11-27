/**
 * Minimap is a tiny copy of the main waveform serving as a navigation tool.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import WaveSurfer, { type WaveSurferOptions } from '../wavesurfer.js'
import createElement from '../dom.js'
import { effect } from '../reactive/store.js'

export type MinimapPluginOptions = {
  overlayColor?: string
  insertPosition?: InsertPosition
} & Partial<WaveSurferOptions>

const defaultOptions = {
  height: 50,
  overlayColor: 'rgba(100, 100, 100, 0.1)',
  insertPosition: 'afterend',
}

export type MinimapPluginEvents = BasePluginEvents & {
  /** An alias of timeupdate but only when the audio is playing */
  audioprocess: [currentTime: number]
  /** When the user clicks on the waveform */
  click: [relativeX: number, relativeY: number]
  /** When the user double-clicks on the waveform */
  dblclick: [relativeX: number, relativeY: number]
  /** When the audio has been decoded */
  decode: [duration: number]
  /** When the user drags the cursor */
  drag: [relativeX: number]
  /** When the user ends dragging the cursor */
  dragend: [relativeX: number]
  /** When the user starts dragging the cursor */
  dragstart: [relativeX: number]
  /** When the user interacts with the waveform (i.g. clicks or drags on it) */
  interaction: []
  /** After the minimap is created */
  init: []
  /** When the audio is both decoded and can play */
  ready: []
  /** When visible waveform is drawn */
  redraw: []
  /** When all audio channel chunks of the waveform have drawn */
  redrawcomplete: []
  /** When the user seeks to a new position */
  seeking: [currentTime: number]
  /** On audio position change, fires continuously during playback */
  timeupdate: [currentTime: number]
}

class MinimapPlugin extends BasePlugin<MinimapPluginEvents, MinimapPluginOptions> {
  protected options: MinimapPluginOptions & typeof defaultOptions
  private minimapWrapper: HTMLElement
  private miniWavesurfer: WaveSurfer | null = null
  private overlay: HTMLElement
  private container: HTMLElement | null = null
  private isInitializing = false

  constructor(options: MinimapPluginOptions) {
    super(options)
    this.options = Object.assign({}, defaultOptions, options)

    this.minimapWrapper = this.initMinimapWrapper()
    this.overlay = this.initOverlay()
  }

  public static create(options: MinimapPluginOptions) {
    return new MinimapPlugin(options)
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    if (this.options.container) {
      if (typeof this.options.container === 'string') {
        this.container = document.querySelector(this.options.container) as HTMLElement
      } else if (this.options.container instanceof HTMLElement) {
        this.container = this.options.container
      }
      this.container?.appendChild(this.minimapWrapper)
    } else {
      this.container = this.wavesurfer.getWrapper().parentElement
      this.container?.insertAdjacentElement(this.options.insertPosition, this.minimapWrapper)
    }

    this.initWaveSurferEvents()

    Promise.resolve().then(() => {
      this.initMinimap()
    })
  }

  private initMinimapWrapper(): HTMLElement {
    return createElement('div', {
      part: 'minimap',
      style: {
        position: 'relative',
      },
    })
  }

  private initOverlay(): HTMLElement {
    return createElement(
      'div',
      {
        part: 'minimap-overlay',
        style: {
          position: 'absolute',
          zIndex: '2',
          left: '0',
          top: '0',
          bottom: '0',
          transition: 'left 100ms ease-out',
          pointerEvents: 'none',
          backgroundColor: this.options.overlayColor,
        },
      },
      this.minimapWrapper,
    )
  }

  private initMinimap() {
    // Prevent concurrent initialization
    if (this.isInitializing) return
    this.isInitializing = true

    if (this.miniWavesurfer) {
      this.miniWavesurfer.destroy()
      this.miniWavesurfer = null
    }

    if (!this.wavesurfer) {
      this.isInitializing = false
      return
    }

    const data = this.wavesurfer.getDecodedData()
    const media = this.wavesurfer.getMediaElement()
    if (!data || !media) {
      this.isInitializing = false
      return
    }

    const peaks = []
    for (let i = 0; i < data.numberOfChannels; i++) {
      peaks.push(data.getChannelData(i))
    }

    this.miniWavesurfer = WaveSurfer.create({
      ...this.options,
      container: this.minimapWrapper,
      minPxPerSec: 0,
      fillParent: true,
      media,
      peaks,
      duration: data.duration,
    })

    this.subscriptions.push(
      this.miniWavesurfer.on('audioprocess', (currentTime) => {
        this.emit('audioprocess', currentTime)
      }),

      this.miniWavesurfer.on('click', (relativeX, relativeY) => {
        this.emit('click', relativeX, relativeY)
      }),

      this.miniWavesurfer.on('dblclick', (relativeX, relativeY) => {
        this.emit('dblclick', relativeX, relativeY)
      }),

      this.miniWavesurfer.on('decode', (duration) => {
        this.emit('decode', duration)
      }),

      this.miniWavesurfer.on('destroy', () => {
        this.emit('destroy')
      }),

      this.miniWavesurfer.on('drag', (relativeX) => {
        this.emit('drag', relativeX)
      }),

      this.miniWavesurfer.on('dragend', (relativeX) => {
        this.emit('dragend', relativeX)
      }),

      this.miniWavesurfer.on('dragstart', (relativeX) => {
        this.emit('dragstart', relativeX)
      }),

      this.miniWavesurfer.on('interaction', () => {
        this.emit('interaction')
      }),

      this.miniWavesurfer.on('init', () => {
        this.emit('init')
      }),

      this.miniWavesurfer.on('ready', () => {
        this.emit('ready')
      }),

      this.miniWavesurfer.on('redraw', () => {
        this.emit('redraw')
      }),

      this.miniWavesurfer.on('redrawcomplete', () => {
        this.emit('redrawcomplete')
      }),

      this.miniWavesurfer.on('seeking', (currentTime) => {
        this.emit('seeking', currentTime)
      }),

      this.miniWavesurfer.on('timeupdate', (currentTime) => {
        this.emit('timeupdate', currentTime)
      }),
    )

    // Reset flag after initialization completes
    this.isInitializing = false
  }

  private getOverlayWidth(): number {
    const waveformWidth = this.wavesurfer?.getWrapper().clientWidth || 1
    return Math.round((this.minimapWrapper.clientWidth / waveformWidth) * 100)
  }

  private onRedraw() {
    const overlayWidth = this.getOverlayWidth()
    this.overlay.style.width = `${overlayWidth}%`
  }

  private onScroll(startTime: number) {
    if (!this.wavesurfer) return
    const state = this.wavesurfer.getState()
    const duration = state.duration.value
    if (duration > 0) {
      this.overlay.style.left = `${(startTime / duration) * 100}%`
    }
  }

  private initWaveSurferEvents() {
    if (!this.wavesurfer) return

    // Get reactive state for duration
    const state = this.wavesurfer.getState()

    // React to duration changes to initialize minimap (decode event alternative)
    this.subscriptions.push(
      effect(() => {
        const duration = state.duration.value
        if (duration > 0 && this.wavesurfer?.getDecodedData()) {
          this.initMinimap()
        }
      }, [state.duration]),
    )

    // Subscribe to scroll and redraw events
    this.subscriptions.push(
      this.wavesurfer.on('scroll', (startTime: number) => {
        this.onScroll(startTime)
      }),

      this.wavesurfer.on('redraw', () => {
        this.onRedraw()
      }),
    )
  }

  /** Unmount */
  public destroy() {
    this.miniWavesurfer?.destroy()
    this.minimapWrapper.remove()
    this.container = null
    super.destroy()
  }
}

export default MinimapPlugin
