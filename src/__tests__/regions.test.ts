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
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 14, clientY: 10 }))
    document.dispatchEvent(new MouseEvent('pointerup', { clientX: 14, clientY: 10 }))

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

describe('Region in/out detection on timeupdate', () => {
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

  // #3631 / #3658 / #3781 / #3866: region.play() seeks to region.start, but
  // media elements clamp/round currentTime, so the first 'timeupdate' can tick
  // slightly BEFORE region.start (especially with many decimals). With an
  // exact comparison the active region was considered "left" and a spurious
  // 'region-out' fired within milliseconds of play().
  test('does not fire region-out right after an in-tolerance seek to region.start', () => {
    const wavesurfer = createWaveSurfer(20)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const start = 9.16454684654654
    const region = plugin.addRegion({ start, end: 12 })

    const regionIn = jest.fn()
    const regionOut = jest.fn()
    plugin.on('region-in', regionIn)
    plugin.on('region-out', regionOut)

    // Playback is inside the region, then the media element reports a tick
    // that landed a hair before the high-precision start (clamped seek).
    wavesurfer.emit('timeupdate', 10)
    expect(regionIn).toHaveBeenCalledTimes(1)
    expect(regionIn).toHaveBeenCalledWith(region)

    wavesurfer.emit('timeupdate', 9.164546)

    expect(regionOut).not.toHaveBeenCalled()
    expect(regionIn).toHaveBeenCalledTimes(1) // still active, no re-entry either
  })

  test('fires region-in when currentTime is within tolerance before region.start', () => {
    const wavesurfer = createWaveSurfer(20)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 5, end: 7 })

    const regionIn = jest.fn()
    const regionOut = jest.fn()
    plugin.on('region-in', regionIn)
    plugin.on('region-out', regionOut)

    // A seek to region.start that settled just before it counts as inside
    wavesurfer.emit('timeupdate', 5 - 0.01)
    expect(regionIn).toHaveBeenCalledTimes(1)
    expect(regionIn).toHaveBeenCalledWith(region)

    // Well before the tolerance window it must NOT count as inside
    regionIn.mockClear()
    wavesurfer.emit('timeupdate', 3)
    expect(regionOut).toHaveBeenCalledTimes(1)
    expect(regionOut).toHaveBeenCalledWith(region)
    expect(regionIn).not.toHaveBeenCalled()
  })

  test('region-out still fires promptly past the region end', () => {
    const wavesurfer = createWaveSurfer(20)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 5, end: 7 })
    const regionOut = jest.fn()
    plugin.on('region-out', regionOut)

    wavesurfer.emit('timeupdate', 6)
    wavesurfer.emit('timeupdate', 7.001)

    expect(regionOut).toHaveBeenCalledTimes(1)
    expect(regionOut).toHaveBeenCalledWith(region)
  })

  test('keeps the 0.05s window for zero-length (marker) regions', () => {
    const wavesurfer = createWaveSurfer(20)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const marker = plugin.addRegion({ start: 2 })

    const regionIn = jest.fn()
    const regionOut = jest.fn()
    plugin.on('region-in', regionIn)
    plugin.on('region-out', regionOut)

    wavesurfer.emit('timeupdate', 2.03) // inside the marker's start + 0.05 window
    expect(regionIn).toHaveBeenCalledTimes(1)
    expect(regionIn).toHaveBeenCalledWith(marker)

    wavesurfer.emit('timeupdate', 2.06) // past the window
    expect(regionOut).toHaveBeenCalledTimes(1)
    expect(regionOut).toHaveBeenCalledWith(marker)
  })
})

describe('Region double-tap (touch) double-click', () => {
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

  // #3927: 'dblclick' never fires for touch input on many mobile browsers, so
  // two taps within 300ms must emit 'region-double-clicked' themselves.
  test('double-tap emits region-double-clicked once', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 1, end: 2 })
    const doubleClicked = jest.fn()
    plugin.on('region-double-clicked', doubleClicked)

    const element = region.element!
    element.dispatchEvent(new Event('touchend'))
    jest.advanceTimersByTime(100)
    element.dispatchEvent(new Event('touchend'))

    expect(doubleClicked).toHaveBeenCalledTimes(1)
    const [regionArg, eventArg] = doubleClicked.mock.calls[0]
    expect(regionArg).toBe(region)
    expect(eventArg).toBeInstanceOf(MouseEvent)
    expect(eventArg.type).toBe('dblclick')

    // A native dblclick the browser fires right after the double tap
    // (desktop-emulation) must be deduped, not emitted a second time.
    jest.advanceTimersByTime(50)
    element.dispatchEvent(new MouseEvent('dblclick'))
    expect(doubleClicked).toHaveBeenCalledTimes(1)
  })

  test('two taps outside the 300ms window do not emit region-double-clicked', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 1, end: 2 })
    const doubleClicked = jest.fn()
    plugin.on('region-double-clicked', doubleClicked)

    const element = region.element!
    element.dispatchEvent(new Event('touchend'))
    jest.advanceTimersByTime(400)
    element.dispatchEvent(new Event('touchend'))

    expect(doubleClicked).not.toHaveBeenCalled()
  })

  test('a plain desktop dblclick still emits region-double-clicked', () => {
    const wavesurfer = createWaveSurfer(10)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)

    const region = plugin.addRegion({ start: 1, end: 2 })
    const doubleClicked = jest.fn()
    plugin.on('region-double-clicked', doubleClicked)

    const nativeEvent = new MouseEvent('dblclick')
    region.element!.dispatchEvent(nativeEvent)

    expect(doubleClicked).toHaveBeenCalledTimes(1)
    expect(doubleClicked).toHaveBeenCalledWith(region, nativeEvent)
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
