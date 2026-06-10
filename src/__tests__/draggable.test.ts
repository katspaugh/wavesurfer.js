import { makeDraggable } from '../draggable.js'

describe('makeDraggable', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    })
    if (typeof window.PointerEvent === 'undefined') {
      class FakePointerEvent extends MouseEvent {
        constructor(type: string, props: any) {
          super(type, props)
        }
      }
      // @ts-expect-error
      window.PointerEvent = FakePointerEvent
      // @ts-expect-error
      global.PointerEvent = FakePointerEvent
    }
  })
  test('drag still works after a two-finger touch', () => {
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
    const pointerEvent = (type: string, props: { clientX: number; clientY: number; pointerId: number }) => {
      const e = new PointerEvent(type, props)
      Object.defineProperty(e, 'pointerId', { value: props.pointerId, configurable: true })
      return e
    }
    const onDrag = jest.fn()
    const unsubscribe = makeDraggable(el, onDrag, undefined, undefined, 0)

    // Two-finger tap: the second finger lifts before the first
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }))
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 10, pointerId: 2 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10, pointerId: 2 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 10, clientY: 10, pointerId: 1 }))

    // A subsequent single-finger drag should work
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 3 }))
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 10, pointerId: 3 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 3 }))

    expect(onDrag).toHaveBeenCalled()

    unsubscribe()
    el.remove()
  })

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
