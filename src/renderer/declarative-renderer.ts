/**
 * Declarative renderer that uses reactive effects for automatic UI updates
 *
 * This renderer automatically updates the UI when state changes, eliminating
 * the need for manual render() calls.
 */

import { effect } from '../reactive/store.js'
import { RenderScheduler } from '../reactive/render-scheduler.js'
import type { WaveSurferState } from '../state/wavesurfer-state.js'
import { createCursorComponent, type CursorProps } from '../components/cursor.js'
import { createProgressComponent, type ProgressProps } from '../components/progress.js'
import type { Component } from '../components/component.js'

export interface DeclarativeRendererOptions {
  container: HTMLElement | string
  height: number | 'auto'
  cursorColor?: string
  cursorWidth?: number
  progressColor?: string
  autoScroll?: boolean
  autoCenter?: boolean
}

/**
 * Declarative renderer that automatically updates UI based on state changes
 *
 * @example
 * ```typescript
 * const { state, actions } = createWaveSurferState()
 * const renderer = new DeclarativeRenderer(container, state, options)
 *
 * // UI updates automatically when state changes
 * actions.setCurrentTime(10) // Cursor and progress move automatically!
 * ```
 */
export class DeclarativeRenderer {
  private container: HTMLElement
  private wrapper: HTMLElement
  private scrollContainer: HTMLElement
  private canvasWrapper: HTMLElement
  private state: WaveSurferState
  private options: DeclarativeRendererOptions
  private cursor: Component<CursorProps> | null = null
  private progress: Component<ProgressProps> | null = null
  private cleanupFunctions: Array<() => void> = []
  private isScrollable = false
  private scheduler = new RenderScheduler()

  constructor(container: HTMLElement | string, state: WaveSurferState, options: DeclarativeRendererOptions) {
    this.state = state
    this.options = options

    // Get or find container
    if (typeof container === 'string') {
      const element = document.querySelector(container)
      if (!element) {
        throw new Error(`Container not found: ${container}`)
      }
      this.container = element as HTMLElement
    } else {
      this.container = container
    }

    // Create DOM structure
    this.scrollContainer = this.createScrollContainer()
    this.wrapper = this.createWrapper()
    this.canvasWrapper = this.createCanvasWrapper()
    this.wrapper.appendChild(this.canvasWrapper)
    this.scrollContainer.appendChild(this.wrapper)
    this.container.appendChild(this.scrollContainer)

    // Setup reactive rendering
    this.setupReactiveRendering()
  }

  /**
   * Create the scroll container
   */
  private createScrollContainer(): HTMLElement {
    const scroll = document.createElement('div')
    scroll.className = 'wavesurfer-scroll'
    scroll.style.position = 'relative'
    scroll.style.width = '100%'
    scroll.style.overflowX = 'auto'
    scroll.style.overflowY = 'hidden'

    if (this.options.height === 'auto') {
      scroll.style.height = 'auto'
    } else {
      scroll.style.height = `${this.options.height}px`
    }

    return scroll
  }

  /**
   * Create the wrapper element that contains all UI components
   */
  private createWrapper(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'wavesurfer-wrapper'
    wrapper.style.position = 'relative'
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'

    return wrapper
  }

  /**
   * Create the canvas wrapper for waveform rendering
   */
  private createCanvasWrapper(): HTMLElement {
    const canvasWrapper = document.createElement('div')
    canvasWrapper.className = 'wavesurfer-canvases'
    canvasWrapper.style.position = 'relative'
    canvasWrapper.style.width = '100%'
    canvasWrapper.style.height = '100%'
    return canvasWrapper
  }

  /**
   * Setup all reactive effects for automatic UI updates
   *
   * This is where the magic happens - state changes trigger UI updates!
   * Multiple state changes in the same frame are batched into a single render.
   */
  private setupReactiveRendering(): void {
    // Create and render cursor component
    this.cursor = createCursorComponent()
    const cursorElement = this.cursor.render({
      position: this.state.progressPercent.value,
      color: this.options.cursorColor || this.options.progressColor || '#333',
      width: this.options.cursorWidth || 2,
      height: '100%',
    })
    this.wrapper.appendChild(cursorElement)

    // Create and render progress component
    this.progress = createProgressComponent()
    const progressElement = this.progress.render({
      progress: this.state.progressPercent.value,
      color: this.options.progressColor || 'rgba(255, 255, 255, 0.5)',
      height: '100%',
    })
    this.wrapper.appendChild(progressElement)

    // Reactive effect: Batch cursor and progress updates
    // Multiple state changes in the same frame result in a single DOM update
    const renderCleanup = effect(() => {
      const position = this.state.progressPercent.value

      // Schedule batched update - multiple rapid state changes = single render
      this.scheduler.scheduleRender(() => {
        this.cursor?.update?.({ position })
        this.progress?.update?.({ progress: position })
      })
    }, [this.state.progressPercent])
    this.cleanupFunctions.push(renderCleanup)

    // For high-priority updates during playback, use immediate rendering
    // This is set up elsewhere when playback state changes
  }

  /**
   * Get the wrapper element
   */
  getWrapper(): HTMLElement {
    return this.wrapper
  }

  /**
   * Get the canvas wrapper element
   */
  getCanvasWrapper(): HTMLElement {
    return this.canvasWrapper
  }

  /**
   * Get current width
   */
  getWidth(): number {
    return this.scrollContainer.clientWidth
  }

  /**
   * Get scroll position
   */
  getScroll(): number {
    return this.scrollContainer.scrollLeft
  }

  /**
   * Set scroll position
   */
  setScroll(pixels: number): void {
    this.scrollContainer.scrollLeft = pixels
  }

  /**
   * Set scroll by percentage
   */
  setScrollPercentage(percent: number): void {
    const { scrollWidth } = this.scrollContainer
    this.setScroll(scrollWidth * percent)
  }

  /**
   * Manually render progress (for compatibility)
   * Note: With reactive rendering, this is not needed - progress updates automatically!
   */
  renderProgress(progress: number): void {
    // Update state, which will trigger reactive updates
    // This method exists for backward compatibility
    this.cursor?.update?.({ position: progress })
    this.progress?.update?.({ progress })
  }

  /**
   * Update cursor styling
   */
  updateCursorStyle(color?: string, width?: number): void {
    const updates: Partial<CursorProps> = {}
    if (color !== undefined) updates.color = color
    if (width !== undefined) updates.width = width

    if (Object.keys(updates).length > 0) {
      this.cursor?.update?.(updates)
    }
  }

  /**
   * Update progress styling
   */
  updateProgressStyle(color?: string): void {
    if (color !== undefined) {
      this.progress?.update?.({ color })
    }
  }

  /**
   * Force immediate synchronous render (for testing)
   * Bypasses the batching mechanism.
   */
  flushRender(): void {
    const position = this.state.progressPercent.value
    this.scheduler.flushRender(() => {
      this.cursor?.update?.({ position })
      this.progress?.update?.({ progress: position })
    })
  }

  /**
   * Cleanup all effects and remove DOM elements
   *
   * This is important - all reactive effects are automatically cleaned up!
   */
  destroy(): void {
    // Cancel any pending renders
    this.scheduler.cancelRender()

    // Clean up all reactive effects
    this.cleanupFunctions.forEach((cleanup) => cleanup())
    this.cleanupFunctions = []

    // Destroy components
    this.cursor?.destroy?.()
    this.progress?.destroy?.()

    // Remove DOM
    this.container.removeChild(this.scrollContainer)

    // Clear references
    this.cursor = null
    this.progress = null
  }
}
