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
    document.dispatchEvent(pointerMove)

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
    document.dispatchEvent(pointerMove)

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
    document.dispatchEvent(pointerMove)

    const pointerUp = new PointerEvent('pointerup', { clientX: 20, clientY: 20 })
    document.dispatchEvent(pointerUp)

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
    document.dispatchEvent(pointerMove)

    // Should not emit events yet
    expect(events.length).toBe(0)

    // Simulate larger drag (above threshold)
    const pointerMove2 = new PointerEvent('pointermove', { clientX: 25, clientY: 25 })
    document.dispatchEvent(pointerMove2)

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
    document.dispatchEvent(pointerMove)

    // Should not emit any events
    expect(events.length).toBe(0)

    cleanup()
  })
})
