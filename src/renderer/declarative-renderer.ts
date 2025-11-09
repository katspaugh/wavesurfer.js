/**
 * Declarative renderer that uses reactive effects for automatic UI updates
 *
 * This renderer automatically updates the UI when state changes, eliminating
 * the need for manual render() calls.
 */

import { effect } from '../reactive/store.js'
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
  private canvasWrapper: HTMLElement
  private state: WaveSurferState
  private options: DeclarativeRendererOptions
  private cursor: Component<CursorProps> | null = null
  private progress: Component<ProgressProps> | null = null
  private cleanupFunctions: Array<() => void> = []

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
    this.wrapper = this.createWrapper()
    this.canvasWrapper = this.createCanvasWrapper()
    this.wrapper.appendChild(this.canvasWrapper)
    this.container.appendChild(this.wrapper)

    // Setup reactive rendering
    this.setupReactiveRendering()
  }

  /**
   * Create the wrapper element that contains all UI components
   */
  private createWrapper(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'wavesurfer-wrapper'
    wrapper.style.position = 'relative'
    wrapper.style.width = '100%'

    if (this.options.height === 'auto') {
      wrapper.style.height = 'auto'
    } else {
      wrapper.style.height = `${this.options.height}px`
    }

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

    // Reactive effect: Update cursor position when progress changes
    const cursorCleanup = effect(() => {
      const position = this.state.progressPercent.value
      this.cursor?.update?.({ position })
    }, [this.state.progressPercent])
    this.cleanupFunctions.push(cursorCleanup)

    // Reactive effect: Update progress bar when progress changes
    const progressCleanup = effect(() => {
      const progress = this.state.progressPercent.value
      this.progress?.update?.({ progress })
    }, [this.state.progressPercent])
    this.cleanupFunctions.push(progressCleanup)

    // Reactive effect: Update cursor color when options change
    // (In a full implementation, options would also be reactive)
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
    return this.wrapper.clientWidth
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
   * Cleanup all effects and remove DOM elements
   *
   * This is important - all reactive effects are automatically cleaned up!
   */
  destroy(): void {
    // Clean up all reactive effects
    this.cleanupFunctions.forEach((cleanup) => cleanup())
    this.cleanupFunctions = []

    // Destroy components
    this.cursor?.destroy?.()
    this.progress?.destroy?.()

    // Remove DOM
    this.container.removeChild(this.wrapper)

    // Clear references
    this.cursor = null
    this.progress = null
  }
}
