import EventEmitter from './event-emitter.js'

type ClockEvents = {
  tick: []
}

export class Clock extends EventEmitter<ClockEvents> {
  private unsubscribe: () => void = () => undefined

  private startTime = 0
  private currentTime = 0
  private isPaused = false

  private updateTime(timestamp: number): void {
    if (!this.isPaused) {
      this.currentTime = timestamp - this.startTime
      this.emit('tick')
    }
  }

  start(): void {
    this.startTime = performance.now()
    this.currentTime = 0
    this.isPaused = false

    this.unsubscribe = this.on('tick', () => {
      requestAnimationFrame(this.updateTime.bind(this))
    })
    this.emit('tick')
  }

  pause(): void {
    this.isPaused = true
    this.unsubscribe()
  }

  resume(): void {
    this.isPaused = false
    this.startTime = performance.now() - this.currentTime
    this.unsubscribe = this.on('tick', () => {
      requestAnimationFrame(this.updateTime.bind(this))
    })
    this.emit('tick')
  }

  getCurrentTime(): number {
    return Math.round(this.currentTime)
  }
}
