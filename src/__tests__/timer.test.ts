import Timer from '../timer.js'

describe('Timer', () => {
  test('start schedules ticks', () => {
    const timer = new Timer()
    const tick = jest.fn()
    timer.on('tick', tick)
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    }
    timer.start()
    expect(tick).toHaveBeenCalledTimes(2)
  })

  test('stop unsubscribes', () => {
    const timer = new Timer()
    const tick = jest.fn()
    timer.on('tick', tick)
    timer.start()
    timer.stop()
    tick.mockClear()
    ;(timer as any).emit('tick')
    expect(tick).not.toHaveBeenCalled()
  })
})
