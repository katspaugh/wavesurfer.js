import RegionsPlugin from '../plugins/regions.js'
import { createEmitter } from './helpers/create-emitter.js'
import { installMatchMediaStub } from './helpers/match-media.js'

const createWaveSurfer = (duration = 10, width = 100, scroll = 0) => {
  const emitter = createEmitter()
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  return {
    ...emitter,
    getDecodedData: jest.fn(() => ({ numberOfChannels: 1 })),
    getDuration: jest.fn(() => duration),
    getScroll: jest.fn(() => scroll),
    getWidth: jest.fn(() => width),
    getWrapper: jest.fn(() => wrapper),
  }
}

const mockRect = (element: HTMLElement, rect: { left: number; top: number; width: number; height: number }) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: jest.fn(() => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    })),
  })
}

describe('RegionsPlugin', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installMatchMediaStub()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('re-renders a lazily detached region when setOptions moves it into view', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')
    expect(regionsContainer).toBeTruthy()
    Object.defineProperty(regionsContainer, 'clientWidth', { configurable: true, value: 1000 })

    const region = plugin.addRegion({ start: 8, end: 9 })

    jest.runOnlyPendingTimers()

    expect(region.element?.parentElement).toBeNull()

    region.setOptions({ start: 0.5, end: 1.5 })

    expect(region.element?.parentElement).toBe(regionsContainer)
    expect(region.element?.style.left).toBe('5%')
    expect(region.element?.style.right).toBe('85%')

    region.setOptions({ start: 8, end: 9 })

    expect(region.element?.parentElement).toBeNull()
  })

  test('cleans up drag selection on plugin destroy', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const wrapper = wavesurfer.getWrapper()
    const addSpy = jest.spyOn(wrapper, 'addEventListener')
    const removeSpy = jest.spyOn(wrapper, 'removeEventListener')

    plugin.enableDragSelection({})
    plugin.destroy()

    const addCount = addSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
    const removeCount = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
    expect(addCount).toBeGreaterThan(0)
    expect(addCount).toBe(removeCount)
  })

  test('attaches only one click listener to region content', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 0, end: 1, content: 'label', contentEditable: true })
    const clicked = jest.fn()
    plugin.on('region-clicked', clicked)

    region.content!.dispatchEvent(new MouseEvent('click'))

    expect(clicked).toHaveBeenCalledTimes(1)
  })

  // ADAPTED: the pre-port test read `region.subscriptions.length` directly.
  // SingleRegion's hand-rolled `subscriptions` array is gone -- its listener
  // bookkeeping (including resize-handle cleanup) now lives on a private
  // child Scope with no length/size introspection (by design, see
  // envelope-leaks.test.ts for the established precedent). Pin the same
  // "does not grow" contract one level down: each `resize: true` toggle
  // creates fresh left/right resize-handle elements and attaches one
  // 'pointerdown' listener to each (via createDragStream). The spy is
  // installed AFTER the region is constructed (so it doesn't see the
  // construction-time attach, or the unrelated single pointerdown listener
  // initMouseEvents attaches to the region element itself for its own drag
  // handling -- that one is never toggled and would otherwise permanently
  // skew the count). Two full off/on cycles land back on the same
  // `resize: true` state the spy started at, so the total 'pointerdown'
  // adds and removes it captured must match exactly -- mirroring the
  // add/remove-count-equality pattern already used above in 'cleans up drag
  // selection on plugin destroy'. A leaked per-cycle cleanup would show up
  // here as adds outpacing removes.
  test('toggling resize option repeatedly does not grow region subscriptions', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 0, end: 1, resize: true })

    const addSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener')
    const removeSpy = jest.spyOn(HTMLElement.prototype, 'removeEventListener')

    try {
      region.setOptions({ resize: false })
      region.setOptions({ resize: true })
      region.setOptions({ resize: false })
      region.setOptions({ resize: true })

      const pointerdownAdds = addSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
      const pointerdownRemoves = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown').length

      expect(pointerdownAdds).toBeGreaterThan(0)
      expect(pointerdownAdds).toBe(pointerdownRemoves)
    } finally {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  test('places a region in the first free row instead of summing all prior overlaps', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second' })
    const thirdRegion = plugin.addRegion({ start: 2, end: 3, content: 'Third' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 50, top: 0, width: 40, height: 10 })
    mockRect(thirdRegion.content!, { left: 30, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()

    expect(firstRegion.content?.style.marginTop).toBe('0px')
    expect(secondRegion.content?.style.marginTop).toBe('0px')
    expect(thirdRegion.content?.style.marginTop).toBe('12px')
  })

  test('reflows shifted labels when another region moves away', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 20, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('12px')

    mockRect(firstRegion.content!, { left: 80, top: 0, width: 40, height: 10 })
    firstRegion.onContentBlur()

    jest.runOnlyPendingTimers()
    expect(firstRegion.content?.style.marginTop).toBe('0px')
    expect(secondRegion.content?.style.marginTop).toBe('0px')
  })
})

describe('Region length constraints during drag-creation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installMatchMediaStub()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('enforces maxLength while a region is being drag-created', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')!
    mockRect(regionsContainer, { left: 0, top: 0, width: 100, height: 100 })

    const region = plugin.addRegion({ start: 1, end: 1.2, maxLength: 2 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    // Simulate a creation-drag update (+40px = +4s at width 100 / duration 10).
    // The creation flow passes a startTime, which used to bypass min/maxLength
    // entirely and let the region grow to 4.2s despite maxLength: 2.
    region._onUpdate(40, 'end', 1)

    expect(region.end - region.start).toBeLessThanOrEqual(2)
  })

  test('enforces minLength when a drag-created region is finalized', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const wrapper = wavesurfer.getWrapper()
    mockRect(wrapper, { left: 0, top: 0, width: 100, height: 100 })
    const regionsContainer = wrapper.querySelector<HTMLElement>('[part="regions-container"]')!
    mockRect(regionsContainer, { left: 0, top: 0, width: 100, height: 100 })

    const created: Array<{ start: number; end: number }> = []
    plugin.on('region-created', (region) => created.push(region))

    plugin.enableDragSelection({ minLength: 2 })

    // Drag from x=10 to x=14 (0.4s worth of drag at width 100 / duration 10):
    // far below minLength: 2.
    wrapper.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 14, clientY: 10 }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 14, clientY: 10 }))

    expect(created).toHaveLength(1)
    const region = created[0]
    expect(region.end - region.start).toBeGreaterThanOrEqual(2 - 1e-9)
  })
})

describe('Region setOptions shape changes', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installMatchMediaStub()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('re-renders marker/region styling when setOptions changes the shape', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const color = 'rgba(0, 128, 0, 0.5)'
    const region = plugin.addRegion({ start: 2, end: 2, color }) // marker
    const element = region.element!

    expect(element.style.borderLeft).toContain('2px solid')
    expect(element.querySelectorAll('[part*="region-handle"]').length).toBe(0)

    // Marker -> range: must pick up the region background, drop the marker
    // border, and gain resize handles.
    region.setOptions({ start: 2, end: 4 })
    expect(element.style.backgroundColor).toBe(color)
    expect(element.style.borderLeft === 'none' || element.style.borderLeft === '').toBe(true)
    expect(element.querySelectorAll('[part*="region-handle"]').length).toBe(2)

    // Range -> marker: back to marker styling, resize handles removed.
    region.setOptions({ start: 3, end: 3 })
    expect(element.style.borderLeft).toContain('2px solid')
    expect(element.style.backgroundColor).toBe('')
    expect(element.querySelectorAll('[part*="region-handle"]').length).toBe(0)
  })
})

describe('RegionsPlugin post-destroy API', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installMatchMediaStub()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  // Post-destroy contract (matches core WaveSurfer): public mutators silently
  // no-op after destroy — addRegion used to throw.
  test('addRegion after destroy is a silent no-op instead of throwing', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)
    plugin.destroy()

    let region: ReturnType<typeof plugin.addRegion> | undefined
    expect(() => {
      region = plugin.addRegion({ start: 1, end: 2 })
    }).not.toThrow()

    expect(region?.element).toBeNull()
    expect(plugin.getRegions()).toHaveLength(0)
    expect(document.querySelector('[part~="region"]')).toBeNull()

    // The rest of the public api already conformed — pin it.
    expect(() => {
      const disable = plugin.enableDragSelection({})
      disable()
      plugin.clearRegions()
    }).not.toThrow()
    expect(plugin.getRegions()).toHaveLength(0)
  })
})

describe('Region drag against the waveform edges', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installMatchMediaStub()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  test('dragging past the left edge preserves the region length instead of compressing it', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')!
    mockRect(regionsContainer, { left: 0, top: 0, width: 100, height: 100 })

    const region = plugin.addRegion({ start: 1, end: 3, drag: true })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    // Each -20px step is -2s at width 100 / duration 10. The first step pins
    // start at 0; before the fix, further leftward steps kept shrinking the
    // region by moving only the end.
    region._onUpdate(-20)
    region._onUpdate(-20)
    region._onUpdate(-20)

    expect(region.start).toBe(0)
    expect(region.end).toBeCloseTo(2) // length preserved

    // And dragging back to the right restores the original position
    region._onUpdate(10)
    expect(region.start).toBeCloseTo(1)
    expect(region.end).toBeCloseTo(3)
  })

  test('dragging past the right edge preserves the region length', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')!
    mockRect(regionsContainer, { left: 0, top: 0, width: 100, height: 100 })

    const region = plugin.addRegion({ start: 7, end: 9, drag: true })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    region._onUpdate(20)
    region._onUpdate(20)

    expect(region.end).toBe(10)
    expect(region.start).toBeCloseTo(8) // length preserved
  })
})

describe('Auto-scroll while dragging, resizing, or creating a region', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    installMatchMediaStub()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  // Wrap the wavesurfer wrapper in a scrollable container (clientWidth 100,
  // scrollWidth 1000) so adjustScroll sees a horizontal scrollbar.
  const setup = () => {
    const wavesurfer = createWaveSurfer(10)
    const wrapper = wavesurfer.getWrapper()
    const scrollContainer = document.createElement('div')
    document.body.appendChild(scrollContainer)
    scrollContainer.appendChild(wrapper)
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 100 })
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 1000 })
    mockRect(scrollContainer, { left: 0, top: 0, width: 100, height: 100 })
    mockRect(wrapper, { left: 0, top: 0, width: 100, height: 100 })

    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const regionsContainer = wrapper.querySelector<HTMLElement>('[part="regions-container"]')!
    mockRect(regionsContainer, { left: 0, top: 0, width: 100, height: 100 })
    Object.defineProperty(regionsContainer, 'clientWidth', { configurable: true, value: 1000 })

    return { wavesurfer, plugin, wrapper, scrollContainer, regionsContainer }
  }

  const startDrag = (target: HTMLElement, fromX = 50, toX = 60) => {
    target.dispatchEvent(new MouseEvent('pointerdown', { clientX: fromX, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: toX, clientY: 10 }))
  }

  const endDrag = (x = 60) => {
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: 10 }))
  }

  test('dragging a region past the right edge scrolls the container to keep it in view', () => {
    const { plugin, scrollContainer, regionsContainer } = setup()
    const region = plugin.addRegion({ start: 0.3, end: 0.8 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    // Fully visible at drag start, so auto-scroll is allowed in both directions
    mockRect(region.element!, { left: 20, top: 0, width: 40, height: 100 })
    startDrag(region.element!)

    // The drag pushed the region 20px past the right edge of the container
    mockRect(region.element!, { left: 80, top: 0, width: 40, height: 100 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, clientY: 10 }))

    expect(scrollContainer.scrollLeft).toBe(20)
    endDrag(70)
  })

  test('a region already overflowing a side at drag start does not scroll further toward it', () => {
    const { plugin, scrollContainer, regionsContainer } = setup()
    const region = plugin.addRegion({ start: 0.3, end: 0.8 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    // Already sticking out 20px past the right edge when the drag starts
    mockRect(region.element!, { left: 80, top: 0, width: 40, height: 100 })
    startDrag(region.element!)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, clientY: 10 }))

    expect(scrollContainer.scrollLeft).toBe(0)
    endDrag(70)
  })

  test('resizing scrolls only toward the dragged handle', () => {
    const { plugin, scrollContainer, regionsContainer } = setup()
    const region = plugin.addRegion({ start: 0.3, end: 0.8 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    scrollContainer.scrollLeft = 50

    // The region overflows the left edge by 10px; dragging the left handle
    // (side 'start' -> direction 'left') scrolls the container left by that much
    mockRect(region.element!, { left: -10, top: 0, width: 40, height: 100 })
    const leftHandle = region.element!.querySelector<HTMLElement>('[part*="region-handle-left"]')!
    startDrag(leftHandle, 50, 45)

    expect(scrollContainer.scrollLeft).toBe(40)
    endDrag(45)

    // Dragging the right handle (direction 'right') must NOT scroll left,
    // even though the region still overflows on the left
    const rightHandle = region.element!.querySelector<HTMLElement>('[part*="region-handle-right"]')!
    startDrag(rightHandle, 30, 35)

    expect(scrollContainer.scrollLeft).toBe(40)
    endDrag(35)
  })

  test('container scroll during a drag keeps moving the region', () => {
    const { wavesurfer, plugin, regionsContainer } = setup()
    const region = plugin.addRegion({ start: 0.3, end: 0.8 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    mockRect(region.element!, { left: 20, top: 0, width: 20, height: 100 })
    startDrag(region.element!, 30, 40)
    const startAfterPointerMove = region.start
    const length = region.end - region.start

    // The container scrolls 10px to the right mid-drag (e.g. from
    // auto-scrolling); the region must follow (+10px = +1s at width 100)
    wavesurfer.emit('scroll', 0, 0, 10, 110)
    expect(region.start).toBeCloseTo(startAfterPointerMove + 1)
    expect(region.end).toBeCloseTo(startAfterPointerMove + 1 + length)

    endDrag(40)

    // After the drag ends, scrolling no longer moves the region
    const startAfterDrag = region.start
    wavesurfer.emit('scroll', 0, 0, 20, 120)
    expect(region.start).toBeCloseTo(startAfterDrag)
  })

  test('virtualization does not detach a region mid-drag', () => {
    const { wavesurfer, plugin, regionsContainer } = setup()
    const region = plugin.addRegion({ start: 0.5, end: 1.5 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    mockRect(region.element!, { left: 50, top: 0, width: 10, height: 100 })
    startDrag(region.element!)
    const element = region.element!

    // Scroll the viewport far away from the region: normally it would be
    // detached by virtualization, but not while it is being dragged
    wavesurfer.getScroll.mockReturnValue(800)
    wavesurfer.emit('scroll', 8, 9, 800, 900)
    expect(element.parentElement).toBe(regionsContainer)

    endDrag()

    // Once the drag is over, virtualization applies again
    wavesurfer.emit('scroll', 8, 9, 800, 900)
    expect(element.parentElement).toBeNull()
  })

  test('holding a region at the edge sustains the auto-scroll feedback loop', () => {
    const { wavesurfer, plugin, scrollContainer, regionsContainer } = setup()
    const region = plugin.addRegion({ start: 0.3, end: 0.8 })
    jest.runOnlyPendingTimers()
    expect(region.element?.parentElement).toBe(regionsContainer)

    // Fully visible at drag start
    mockRect(region.element!, { left: 20, top: 0, width: 40, height: 100 })
    startDrag(region.element!)

    // The pointer parks the region 20px past the right edge and stays there:
    // the element rect keeps reporting the same overflow (the region tracks
    // the stationary pointer), so every scroll step must trigger another one
    mockRect(region.element!, { left: 80, top: 0, width: 40, height: 100 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, clientY: 10 }))
    expect(scrollContainer.scrollLeft).toBe(20)

    // The renderer reports each scroll back as a wavesurfer 'scroll' event;
    // the replay moves the region AND re-triggers adjustScroll — round two
    const startAfterFirstScroll = region.start
    wavesurfer.emit('scroll', 0, 0, 20, 120)
    expect(region.start).toBeCloseTo(startAfterFirstScroll + 2) // +20px = +2s
    expect(scrollContainer.scrollLeft).toBe(40)

    // ... and round three, without any pointer movement
    wavesurfer.emit('scroll', 0, 0, 40, 140)
    expect(region.start).toBeCloseTo(startAfterFirstScroll + 4)
    expect(scrollContainer.scrollLeft).toBe(60)

    // Once the region no longer overflows, the loop stops
    mockRect(region.element!, { left: 40, top: 0, width: 40, height: 100 })
    wavesurfer.emit('scroll', 0, 0, 60, 160)
    expect(scrollContainer.scrollLeft).toBe(60)

    endDrag(70)
  })

  test('drag-creation keeps auto-scrolling once the region is wider than the viewport', () => {
    const { wavesurfer, plugin, wrapper, scrollContainer } = setup()
    const initialized: Array<{ element: HTMLElement | null }> = []
    plugin.on('region-initialized', (region) => initialized.push(region))

    plugin.enableDragSelection({})

    wrapper.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 10 }))
    expect(initialized).toHaveLength(1)

    // The created region has grown wider than the viewport: it overflows both
    // sides (50px each). A rightward scroll step must still scroll right,
    // by the right-side overflow
    mockRect(initialized[0].element!, { left: -50, top: 0, width: 200, height: 100 })
    wavesurfer.emit('scroll', 0, 0, 10, 110)

    expect(scrollContainer.scrollLeft).toBe(50)

    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 10 }))
  })

  test('disabling drag selection mid-gesture stops the scroll replay', () => {
    const { wavesurfer, plugin, wrapper } = setup()
    const initialized: Array<{ start: number; end: number }> = []
    plugin.on('region-initialized', (region) => initialized.push(region))

    const disable = plugin.enableDragSelection({})

    wrapper.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 10 }))
    expect(initialized).toHaveLength(1)

    disable()

    // Scrolling after disabling must not keep mutating the abandoned region
    const { start, end } = initialized[0]
    wavesurfer.emit('scroll', 0, 0, 10, 110)
    expect(initialized[0].start).toBeCloseTo(start)
    expect(initialized[0].end).toBeCloseTo(end)
  })

  test('container scroll during drag-creation keeps growing the region', () => {
    const { wavesurfer, plugin, wrapper } = setup()
    const created: Array<{ start: number; end: number }> = []
    plugin.on('region-created', (region) => created.push(region))

    plugin.enableDragSelection({})

    // Drag from x=10 to x=20: creates a region from 1s, end dragged to ~2.5s
    wrapper.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 10 }))

    expect(created).toHaveLength(0) // not saved until the drag ends
    // The container auto-scrolls 10px to the right; the region's end must
    // keep growing by the equivalent 1s
    wavesurfer.emit('scroll', 0, 0, 10, 110)

    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 10 }))

    expect(created).toHaveLength(1)
    expect(created[0].start).toBeCloseTo(1)
    expect(created[0].end).toBeCloseTo(3.5)

    // After creation, scrolling no longer updates the region
    const end = created[0].end
    wavesurfer.emit('scroll', 0, 0, 30, 130)
    expect(created[0].end).toBeCloseTo(end)
  })
})
