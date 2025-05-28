import { makeDraggable } from '../draggable.js'

describe('makeDraggable', () => {
  test('invokes callbacks on drag', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    jest.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    const onDrag = jest.fn()
    const onStart = jest.fn()
    const onEnd = jest.fn()
    const unsubscribe = makeDraggable(el, onDrag, onStart, onEnd, 0)

    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 20 }))
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 20 }))

    expect(onStart).toHaveBeenCalled()
    expect(onDrag).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalled()

    unsubscribe()
  })
})
