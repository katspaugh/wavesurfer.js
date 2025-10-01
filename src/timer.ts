import EventEmitter from './event-emitter.js'

type TimerEvents = {
  tick: []
}

class Timer extends EventEmitter<TimerEvents> {
  private animationFrameId: number | null = null
  private isRunning = false

  start() {
    // Prevent multiple simultaneous loops
    if (this.isRunning) return

    this.isRunning = true

    const tick = () => {
      // Only continue if timer is still running
      if (!this.isRunning) return

      this.emit('tick')

      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(tick)
    }

    // Start the loop
    tick()
  }

  stop() {
    this.isRunning = false

    // Cancel any pending animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  destroy() {
    this.stop()
  }
}

export default Timer
