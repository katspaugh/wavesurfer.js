/**
 * Minimap is a tiny copy of the main waveform serving as a navigation tool.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import WaveSurfer, { type WaveSurferOptions } from '../wavesurfer.js'
import createElement from '../dom.js'

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
  ready: []
  interaction: []
}

class MinimapPlugin extends BasePlugin<MinimapPluginEvents, MinimapPluginOptions> {
  protected options: MinimapPluginOptions & typeof defaultOptions
  private minimapWrapper: HTMLElement
  private miniWavesurfer: WaveSurfer | null = null
  private overlay: HTMLElement
  private container: HTMLElement | null = null

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
    if (this.miniWavesurfer) {
      this.miniWavesurfer.destroy()
      this.miniWavesurfer = null
    }

    if (!this.wavesurfer) return

    const data = this.wavesurfer.getDecodedData()
    const media = this.wavesurfer.getMediaElement()
    if (!data || !media) return

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
      this.miniWavesurfer.on('ready', () => {
        this.emit('ready')
      }),

      this.miniWavesurfer.on('interaction', () => {
        this.emit('interaction')
      }),
    )
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
    const duration = this.wavesurfer.getDuration()
    this.overlay.style.left = `${(startTime / duration) * 100}%`
  }

  private initWaveSurferEvents() {
    if (!this.wavesurfer) return

    this.subscriptions.push(
      this.wavesurfer.on('decode', () => {
        this.initMinimap()
      }),

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
    super.destroy()
  }
}

export default MinimapPlugin
