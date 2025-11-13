/**
 * Canvas-based waveform rendering
 *
 * This module handles all canvas waveform rendering independently of cursor/progress UI.
 * It can be used by both imperative Renderer and DeclarativeRenderer.
 */

import * as utils from '../renderer-utils.js'
import type { WaveSurferOptions } from '../wavesurfer.js'

type ChannelData = utils.ChannelData

// Extract only the rendering-related options from WaveSurferOptions
type RenderingOptions = Pick<
  WaveSurferOptions,
  | 'waveColor'
  | 'progressColor'
  | 'renderFunction'
  | 'barWidth'
  | 'barGap'
  | 'barRadius'
  | 'barHeight'
  | 'barAlign'
  | 'minPxPerSec'
  | 'fillParent'
  | 'normalize'
  | 'maxPeak'
  | 'splitChannels'
  | 'height'
>

export interface CanvasRenderOptions extends RenderingOptions {
  width: number
  pixelRatio: number
}

/**
 * CanvasRenderer - Pure waveform canvas rendering without cursor/progress UI
 */
export class CanvasRenderer {
  private options: CanvasRenderOptions
  private pixelRatio: number

  constructor(options: CanvasRenderOptions) {
    this.options = options
    this.pixelRatio = options.pixelRatio
  }

  /**
   * Update rendering options
   */
  setOptions(options: Partial<CanvasRenderOptions>): void {
    this.options = { ...this.options, ...options }
    if (options.pixelRatio !== undefined) {
      this.pixelRatio = options.pixelRatio
    }
  }

  /**
   * Convert color values from array format to CSS format
   */
  private convertColorValues(color?: string | string[] | CanvasGradient): string | CanvasGradient {
    if (!color) return ''
    if (Array.isArray(color)) return color[0] || ''
    return color
  }

  /**
   * Render bar-style waveform
   */
  private renderBarWaveform(
    channelData: ChannelData,
    options: CanvasRenderOptions,
    ctx: CanvasRenderingContext2D,
    vScale: number,
  ): void {
    const { width, height } = ctx.canvas
    const { halfHeight, barWidth, barRadius, barIndexScale, barSpacing } = utils.calculateBarRenderConfig({
      width,
      height,
      length: (channelData[0] || []).length,
      options: options as unknown as WaveSurferOptions,
      pixelRatio: this.pixelRatio,
    })

    const segments = utils.calculateBarSegments({
      channelData,
      barIndexScale,
      barSpacing,
      barWidth,
      halfHeight,
      vScale,
      canvasHeight: height,
      barAlign: options.barAlign,
    })

    ctx.beginPath()

    for (const segment of segments) {
      if (barRadius && 'roundRect' in ctx) {
        ;(
          ctx as CanvasRenderingContext2D & {
            roundRect: (
              x: number,
              y: number,
              width: number,
              height: number,
              radii?: number | DOMPointInit | DOMPointInit[],
            ) => void
          }
        ).roundRect(segment.x, segment.y, segment.width, segment.height, barRadius)
      } else {
        ctx.rect(segment.x, segment.y, segment.width, segment.height)
      }
    }

    ctx.fill()
    ctx.closePath()
  }

  /**
   * Render line-style waveform
   */
  private renderLineWaveform(
    channelData: ChannelData,
    _options: CanvasRenderOptions,
    ctx: CanvasRenderingContext2D,
    vScale: number,
  ): void {
    const { width, height } = ctx.canvas
    const paths = utils.calculateLinePaths({ channelData, width, height, vScale })

    ctx.beginPath()

    for (const path of paths) {
      if (!path.length) continue
      ctx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) {
        const point = path[i]
        ctx.lineTo(point.x, point.y)
      }
    }

    ctx.fill()
    ctx.closePath()
  }

  /**
   * Render waveform to canvas context
   */
  renderWaveform(channelData: ChannelData, options: CanvasRenderOptions, ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.convertColorValues(options.waveColor)

    if (options.renderFunction) {
      options.renderFunction(channelData, ctx)
      return
    }

    const vScale = utils.calculateVerticalScale({
      channelData,
      barHeight: options.barHeight,
      normalize: options.normalize,
      maxPeak: options.maxPeak,
    })

    if (utils.shouldRenderBars(options as unknown as WaveSurferOptions)) {
      this.renderBarWaveform(channelData, options, ctx, vScale)
      return
    }

    this.renderLineWaveform(channelData, options, ctx, vScale)
  }

  /**
   * Render a single canvas with waveform data
   */
  renderSingleCanvas(
    data: ChannelData,
    options: CanvasRenderOptions,
    width: number,
    height: number,
    offset: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
  ): void {
    const pixelRatio = this.pixelRatio
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.left = `${Math.round(offset)}px`
    canvasContainer.appendChild(canvas)

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    // Render waveform
    if (options.renderFunction) {
      ctx.fillStyle = this.convertColorValues(options.waveColor)
      options.renderFunction(data, ctx)
    } else {
      this.renderWaveform(data, options, ctx)
    }

    // Draw progress canvas
    if (canvas.width > 0 && canvas.height > 0) {
      const progressCanvas = canvas.cloneNode() as HTMLCanvasElement
      const progressCtx = progressCanvas.getContext('2d') as CanvasRenderingContext2D
      progressCtx.drawImage(canvas, 0, 0)
      progressCtx.globalCompositeOperation = 'source-in'
      progressCtx.fillStyle = this.convertColorValues(options.progressColor as CanvasRenderOptions['waveColor'])
      progressCtx.fillRect(0, 0, canvas.width, canvas.height)
      progressContainer.appendChild(progressCanvas)
    }
  }

  /**
   * Render multiple canvases for scrollable waveforms
   */
  renderMultiCanvas(
    channelData: ChannelData,
    options: CanvasRenderOptions,
    width: number,
    height: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
    scrollContainer: HTMLElement,
    isScrollable: boolean,
    onScroll?: (draw: (index: number) => void, clearCanvases: () => void) => void,
  ): void {
    const pixelRatio = this.pixelRatio
    const { clientWidth } = scrollContainer
    const totalWidth = width / pixelRatio

    const singleCanvasWidth = utils.calculateSingleCanvasWidth({
      clientWidth,
      totalWidth,
      options: options as unknown as WaveSurferOptions,
    })
    let drawnIndexes: Record<number, boolean> = {}

    // Nothing to render
    if (singleCanvasWidth === 0) return

    // Draw a single canvas
    const draw = (index: number) => {
      if (index < 0 || index >= numCanvases) return
      if (drawnIndexes[index]) return
      drawnIndexes[index] = true
      const offset = index * singleCanvasWidth
      let clampedWidth = Math.min(totalWidth - offset, singleCanvasWidth)

      // Clamp the width to the bar grid to avoid empty canvases at the end
      clampedWidth = utils.clampWidthToBarGrid(clampedWidth, options as unknown as WaveSurferOptions)

      if (clampedWidth <= 0) return
      const data = utils.sliceChannelData({ channelData, offset, clampedWidth, totalWidth })
      this.renderSingleCanvas(data, options, clampedWidth, height, offset, canvasContainer, progressContainer)
    }

    // Clear canvases to avoid too many DOM nodes
    const clearCanvases = () => {
      if (utils.shouldClearCanvases(Object.keys(drawnIndexes).length)) {
        canvasContainer.innerHTML = ''
        progressContainer.innerHTML = ''
        drawnIndexes = {}
      }
    }

    // Calculate how many canvases to render
    const numCanvases = Math.ceil(totalWidth / singleCanvasWidth)

    // Render all canvases if the waveform doesn't scroll
    if (!isScrollable) {
      for (let i = 0; i < numCanvases; i++) {
        draw(i)
      }
      return
    }

    // Lazy rendering
    const initialRange = utils.getLazyRenderRange({
      scrollLeft: scrollContainer.scrollLeft,
      totalWidth,
      numCanvases,
      singleCanvasWidth,
      clientWidth,
    })
    initialRange.forEach((index) => draw(index))

    // Allow caller to handle scroll-based rendering
    if (onScroll) {
      onScroll(draw, clearCanvases)
    }
  }

  /**
   * Render a single channel of waveform
   */
  renderChannel(
    channelData: ChannelData,
    options: CanvasRenderOptions,
    width: number,
    canvasContainer: HTMLElement,
    progressContainer: HTMLElement,
    scrollContainer: HTMLElement,
    isScrollable: boolean,
    canvasWrapper: HTMLElement,
    channelIndex: number,
    onScroll?: (draw: (index: number) => void, clearCanvases: () => void) => void,
  ): void {
    const overlay = (options as CanvasRenderOptions & { overlay?: boolean }).overlay
    const height = this.getHeight(options.height, options.splitChannels)
    canvasContainer.style.height = `${height}px`
    if (overlay && channelIndex > 0) {
      canvasContainer.style.marginTop = `-${height}px`
    }
    canvasWrapper.style.minHeight = `${height}px`

    this.renderMultiCanvas(
      channelData,
      options,
      width,
      height,
      canvasContainer,
      progressContainer,
      scrollContainer,
      isScrollable,
      onScroll,
    )
  }

  /**
   * Calculate height for a channel
   */
  private getHeight(
    height: number | 'auto' | undefined,
    splitChannels: boolean | WaveSurferOptions['splitChannels'] | undefined,
  ): number {
    const defaultHeight = 128
    if (height == null) return defaultHeight
    if (!splitChannels) return typeof height === 'number' ? height : defaultHeight
    if (typeof height === 'number') return height / 2
    return defaultHeight
  }
}
