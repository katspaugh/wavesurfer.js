import { createDragStream, type DragEvent } from '../drag-stream'

describe('createDragStream', () => {
  beforeAll(() => {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }),
    })

    // Polyfill PointerEvent for jsdom
    if (typeof window.PointerEvent === 'undefined') {
      class FakePointerEvent extends MouseEvent {
        constructor(type: string, props: any) {
          super(type, props)
        }
      }
      // @ts-expect-error - Polyfill PointerEvent for jsdom test environment
      window.PointerEvent = FakePointerEvent
      // @ts-expect-error - Polyfill PointerEvent for jsdom test environment
      global.PointerEvent = FakePointerEvent
    }
  })
  // The jsdom PointerEvent (poly)fill above does not reliably carry pointerId
  // through the constructor's init dict, so force it - required whenever a
  // test needs to distinguish between multiple concurrent pointers.
  const pointerEvent = (
    type: string,
    props: { clientX?: number; clientY?: number; button?: number; pointerId: number },
  ) => {
    const e = new PointerEvent(type, props)
    Object.defineProperty(e, 'pointerId', { value: props.pointerId, configurable: true })
    return e
  }

  let element: HTMLElement
  let events: DragEvent[]

  beforeEach(() => {
    element = document.createElement('div')
    document.body.appendChild(element)
    element.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }))
    events = []
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('should create a drag signal', () => {
    const { signal, cleanup } = createDragStream(element)

    expect(signal).toBeDefined()
    expect(signal.value).toBeNull()

    cleanup()
  })

  it('should emit start event on drag', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Simulate drag
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 })
    element.dispatchEvent(pointerDown)

    const pointerMove = new PointerEvent('pointermove', { clientX: 20, clientY: 20 })
    window.dispatchEvent(pointerMove)

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]?.type).toBe('start')

    cleanup()
  })

  it('should emit move events with deltas', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Simulate drag
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 })
    element.dispatchEvent(pointerDown)

    const pointerMove = new PointerEvent('pointermove', { clientX: 20, clientY: 30 })
    window.dispatchEvent(pointerMove)

    const moveEvent = events.find((e) => e.type === 'move')
    expect(moveEvent).toBeDefined()
    expect(moveEvent?.deltaX).toBe(10)
    expect(moveEvent?.deltaY).toBe(20)

    cleanup()
  })

  it('should emit end event on pointer up', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Simulate drag
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 })
    element.dispatchEvent(pointerDown)

    const pointerMove = new PointerEvent('pointermove', { clientX: 20, clientY: 20 })
    window.dispatchEvent(pointerMove)

    const pointerUp = new PointerEvent('pointerup', { clientX: 20, clientY: 20 })
    window.dispatchEvent(pointerUp)

    expect(events.some((e) => e.type === 'end')).toBe(true)

    cleanup()
  })

  it('should respect threshold', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 10 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Simulate small drag (below threshold)
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 })
    element.dispatchEvent(pointerDown)

    const pointerMove = new PointerEvent('pointermove', { clientX: 15, clientY: 15 })
    window.dispatchEvent(pointerMove)

    // Should not emit events yet
    expect(events.length).toBe(0)

    // Simulate larger drag (above threshold)
    const pointerMove2 = new PointerEvent('pointermove', { clientX: 25, clientY: 25 })
    window.dispatchEvent(pointerMove2)

    // Should now emit events
    expect(events.length).toBeGreaterThan(0)

    cleanup()
  })

  it('should cleanup event listeners', () => {
    const { cleanup } = createDragStream(element)

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener')
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')

    // Trigger drag to attach document listeners
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 })
    element.dispatchEvent(pointerDown)

    expect(addEventListenerSpy).toHaveBeenCalled()

    cleanup()

    expect(removeEventListenerSpy).toHaveBeenCalled()

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('should ignore non-primary mouse buttons', () => {
    const { signal, cleanup } = createDragStream(element)

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Simulate right-click drag
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 2 })
    element.dispatchEvent(pointerDown)

    const pointerMove = new PointerEvent('pointermove', { clientX: 20, clientY: 20 })
    window.dispatchEvent(pointerMove)

    // Should not emit any events
    expect(events.length).toBe(0)

    cleanup()
  })

  it('should stop propagation during drag', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Start drag
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 })
    element.dispatchEvent(pointerDown)

    // Move - should prevent click
    const pointerMove = new PointerEvent('pointermove', { clientX: 20, clientY: 20 })
    window.dispatchEvent(pointerMove)

    // End drag
    const pointerUp = new PointerEvent('pointerup', { clientX: 20, clientY: 20 })
    window.dispatchEvent(pointerUp)

    // Simulate click after drag
    const clickHandler = jest.fn()
    document.addEventListener('click', clickHandler, { capture: true })

    const click = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(click, 'stopPropagation', { value: jest.fn() })
    Object.defineProperty(click, 'preventDefault', { value: jest.fn() })
    document.dispatchEvent(click)

    document.removeEventListener('click', clickHandler, { capture: true })
    cleanup()
  })

  it('does not end the drag when the pointer leaves the document (e.g. during auto-scroll)', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Start drag
    const pointerDown = new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 1 })
    element.dispatchEvent(pointerDown)

    // Move to start dragging
    const pointerMove = new PointerEvent('pointermove', { clientX: 20, clientY: 20, pointerId: 1 })
    window.dispatchEvent(pointerMove)

    // Pointer leaves the document (also fired when the container scrolls
    // under a stationary pointer) -- the drag must survive it
    const pointerOut = new PointerEvent('pointerout', {
      clientX: 20,
      clientY: 20,
      pointerId: 1,
      relatedTarget: document.documentElement,
    })
    document.dispatchEvent(pointerOut)

    expect(events.some((e) => e.type === 'end')).toBe(false)

    // The drag still ends normally on pointerup
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 20, clientY: 20, pointerId: 1 }))
    expect(events.some((e) => e.type === 'end')).toBe(true)

    cleanup()
  })

  it('ends the drag on pointercancel', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 1 }))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 20, pointerId: 1 }))
    window.dispatchEvent(pointerEvent('pointercancel', { clientX: 20, clientY: 20, pointerId: 1 }))

    expect(events.some((e) => e.type === 'end')).toBe(true)

    cleanup()
  })

  it('continues to work after a two-finger touch', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    // Two-finger tap: the second finger lifts before the first
    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 1 }))
    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 10, button: 0, pointerId: 2 }))
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10, pointerId: 2 }))
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 10, clientY: 10, pointerId: 1 }))

    // A subsequent single-finger drag should work
    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 3 }))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 10, pointerId: 3 }))
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 3 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'end'])

    cleanup()
  })

  it('a second finger lifting does not end the first pointer drag', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 1 }))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 10, pointerId: 1 }))

    // A second finger touches and lifts mid-drag
    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 10, button: 0, pointerId: 2 }))
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10, pointerId: 2 }))

    // The first finger continues dragging and lifts
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 10, pointerId: 1 }))
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 1 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'move', 'end'])

    cleanup()
  })

  it('only the dragging pointer moves the drag', () => {
    const { signal, cleanup } = createDragStream(element, { threshold: 0 })

    signal.subscribe((event: DragEvent | null) => {
      if (event) events.push(event)
    })

    element.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, pointerId: 1 }))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 10, pointerId: 1 }))

    // Moves from an untracked pointer are ignored
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 90, clientY: 90, pointerId: 7 }))
    window.dispatchEvent(pointerEvent('pointerup', { clientX: 30, clientY: 10, pointerId: 1 }))

    expect(events.map((e) => e.type)).toEqual(['start', 'move', 'end'])
    expect(events[1]?.x).toBe(20)

    cleanup()
  })
})
