/**
 * RenderScheduler batches multiple render requests into a single frame using requestAnimationFrame.
 * This prevents multiple state changes from triggering redundant renders.
 */

export type RenderPriority = 'high' | 'normal' | 'low'

export class RenderScheduler {
  private pendingRender = false
  private rafId: number | null = null

  /**
   * Schedule a render to occur on the next animation frame.
   * If a render is already scheduled, this is a no-op.
   *
   * @param renderFn - The function to call to perform the render
   * @param priority - Render priority (high = immediate, normal/low = batched)
   *
   * @example
   * ```typescript
   * const scheduler = new RenderScheduler()
   *
   * // Multiple calls in same frame = single render
   * scheduler.scheduleRender(() => draw())
   * scheduler.scheduleRender(() => draw()) // no-op
   * scheduler.scheduleRender(() => draw()) // no-op
   * ```
   */
  scheduleRender(renderFn: () => void, priority: RenderPriority = 'normal'): void {
    // High priority renders happen immediately
    if (priority === 'high') {
      this.flushRender(renderFn)
      return
    }

    // If already scheduled, don't schedule again
    if (this.pendingRender) return

    this.pendingRender = true
    this.rafId = requestAnimationFrame(() => {
      try {
        renderFn()
      } finally {
        // Always clean up, even if render throws
        this.pendingRender = false
        this.rafId = null
      }
    })
  }

  /**
   * Cancel any pending render request.
   * Useful when unmounting or destroying components.
   */
  cancelRender(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
      this.pendingRender = false
    }
  }

  /**
   * Force an immediate synchronous render, canceling any pending batched render.
   * Use for high-priority updates like cursor during playback, or for testing.
   *
   * @param renderFn - The function to call to perform the render
   */
  flushRender(renderFn: () => void): void {
    this.cancelRender()
    renderFn()
  }

  /**
   * Check if a render is currently scheduled.
   */
  isPending(): boolean {
    return this.pendingRender
  }
}
