import EventEmitter from '../event-emitter.js'

interface Events {
  foo: [number]
  bar: []
  [key: string]: unknown[]
}

describe('EventEmitter', () => {
  test('on and emit', () => {
    const emitter = new EventEmitter<Events>()
    const handler = jest.fn()
    emitter.on('foo', handler)
    ;(emitter as any).emit('foo', 42)
    expect(handler).toHaveBeenCalledWith(42)
  })

  test('once', () => {
    const emitter = new EventEmitter<Events>()
    const handler = jest.fn()
    emitter.once('bar', handler)
    ;(emitter as any).emit('bar')
    ;(emitter as any).emit('bar')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('unAll', () => {
    const emitter = new EventEmitter<Events>()
    const handler = jest.fn()
    emitter.on('foo', handler)
    emitter.unAll()
    ;(emitter as any).emit('foo', 1)
    expect(handler).not.toHaveBeenCalled()
  })
})
