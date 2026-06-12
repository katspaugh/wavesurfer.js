import { createDragStream, type DragEvent } from '../reactive/drag-stream.js'
import { effect } from '../reactive/store.js'

describe('createDragStream', () => {
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

  const pointerEvent = (type: string, props: { clientX?: number; clientY?: number; pointerId?: number }) => {
    const e = new PointerEvent(type, props)
    Object.defineProperty(e, 'pointerId', { value: props.pointerId ?? 0, configurable: true })
    return e
  }

  const setup = () => {
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
    const stream = createDragStream(el, { threshold: 0 })
    const events: DragEvent[] = []
    const unsubscribe = effect(() => {
      const drag = stream.signal.value
      if (drag) events.push(drag)
    }, [stream.signal])
    return {
      el,
      events,
      cleanup: () => {
        unsubscribe()
        stream.cleanup()
        el.remove()
      },
    }
  }

  test('emits start, move and end on a simple drag', () => {
    const { el, events, cleanup } = setup()

    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }))
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 20, pointerId: 1 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 20, clientY: 20, pointerId: 1 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'end'])

    cleanup()
  })

  test('drag still works after a two-finger touch', () => {
    const { el, events, cleanup } = setup()

    // Two-finger tap: the second finger lifts before the first
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }))
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 10, pointerId: 2 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10, pointerId: 2 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 10, clientY: 10, pointerId: 1 }))

    // A subsequent single-finger drag should work
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 3 }))
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 10, pointerId: 3 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 3 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'end'])

    cleanup()
  })

  test('a second finger lifting does not end the first pointer drag', () => {
    const { el, events, cleanup } = setup()

    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }))
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 10, pointerId: 1 }))

    // A second finger touches and lifts mid-drag
    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 10, pointerId: 2 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10, pointerId: 2 }))

    // The first finger continues dragging and lifts
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 10, pointerId: 1 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 1 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'move', 'end'])

    cleanup()
  })

  test('only the dragging pointer moves the drag', () => {
    const { el, events, cleanup } = setup()

    el.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, pointerId: 1 }))
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 10, pointerId: 1 }))

    // Moves from an untracked pointer are ignored
    document.dispatchEvent(pointerEvent('pointermove', { clientX: 90, clientY: 90, pointerId: 7 }))
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 1 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'end'])
    expect(events[1].x).toBe(20)

    cleanup()
  })
})
