import { Scope } from './scope.js'

/**
 * Owns a single RAF loop; multiple start() calls share one loop. Replaces
 * WaveSurfer's Timer wiring: the loop's stop() is registered on the given
 * Scope so scope disposal always tears it down, and start()'s first tick
 * fires synchronously (matching Timer.start()'s behavior) so the first
 * timeupdate/audioprocess emission stays synchronous with play().
 */
export class FrameScheduler {
  private frameId: number | null = null
  private callback: (() => void) | null = null
  private isRunning = false

  constructor(scope: Scope) {
    scope.add(() => this.stop())
  }

  get running(): boolean {
    return this.isRunning
  }

  start(callback: () => void): void {
    this.callback = callback
    if (this.isRunning) return
    this.isRunning = true
    const tick = () => {
      if (!this.isRunning) return
      // Schedule the next frame BEFORE running the callback: a throwing
      // subscriber must not kill the loop (isRunning would stay true, blocking
      // any restart). The exception still propagates to the caller/RAF task so
      // it stays visible for debugging; a stop() from inside the callback
      // cancels the frame just scheduled here via cancelAnimationFrame.
      this.frameId = requestAnimationFrame(tick)
      this.callback?.()
    }
    // Replicate Timer's synchronous first tick so event timing stays identical.
    tick()
  }

  stop(): void {
    this.isRunning = false
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }
}
