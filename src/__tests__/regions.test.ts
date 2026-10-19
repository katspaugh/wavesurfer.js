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

  describe('virtualization', () => {
    // 10 s over a 1000 px container = 100 px per second, seen through a 100 px
    // viewport.
    const setupVirtual = (scroll = 0) => {
      const wavesurfer = createWaveSurfer(10, 100, scroll)
      const plugin = RegionsPlugin.create()
      plugin._init(wavesurfer as any)
      const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')!
      const containerWidth = jest.fn(() => 1000)
      Object.defineProperty(regionsContainer, 'clientWidth', { configurable: true, get: containerWidth })
      return { wavesurfer, plugin, regionsContainer, containerWidth }
    }

    test('registers one scroll, zoom and resize listener however many regions there are', () => {
      const { wavesurfer, plugin } = setupVirtual()
      const listeners = (event: string) => wavesurfer.on.mock.calls.filter(([type]) => type === event).length

      for (let i = 0; i < 20; i++) plugin.addRegion({ start: i * 0.4, end: i * 0.4 + 0.2 })
      jest.runOnlyPendingTimers()

      // Exactly one each, registered by the plugin's setup: the regions add none
      expect(listeners('scroll')).toBe(1)
      expect(listeners('zoom')).toBe(1)
      expect(listeners('resize')).toBe(1)
    })

    test('measures the viewport once per event, not once per region', () => {
      const { wavesurfer, plugin, containerWidth } = setupVirtual()
      for (let i = 0; i < 20; i++) plugin.addRegion({ start: i * 0.4, end: i * 0.4 + 0.2 })
      jest.runOnlyPendingTimers()

      for (const event of ['scroll', 'zoom', 'resize']) {
        wavesurfer.getScroll.mockClear()
        wavesurfer.getWidth.mockClear()
        containerWidth.mockClear()

        wavesurfer.emit(event)

        expect(wavesurfer.getScroll).toHaveBeenCalledTimes(1)
        expect(wavesurfer.getWidth).toHaveBeenCalledTimes(1)
        expect(containerWidth).toHaveBeenCalledTimes(1)
      }
    })

    test('unmounts and mounts regions in the same scroll event', () => {
      const { wavesurfer, plugin, regionsContainer } = setupVirtual()
      const left = plugin.addRegion({ start: 0, end: 1 })
      const right = plugin.addRegion({ start: 8, end: 9 })
      jest.runOnlyPendingTimers()
      expect(left.element?.parentElement).toBe(regionsContainer)
      expect(right.element?.parentElement).toBeNull()

      wavesurfer.getScroll.mockReturnValue(800)
      wavesurfer.emit('scroll', 8, 9, 800, 900)

      expect(left.element?.parentElement).toBeNull()
      expect(right.element?.parentElement).toBe(regionsContainer)
    })

    test('mounts regions that become visible together in creation order', () => {
      const { wavesurfer, plugin, regionsContainer } = setupVirtual(500)
      const regions = [
        plugin.addRegion({ start: 0, end: 1 }),
        plugin.addRegion({ start: 1, end: 2 }),
        plugin.addRegion({ start: 2, end: 3 }),
      ]
      jest.runOnlyPendingTimers()
      expect(regionsContainer.children).toHaveLength(0)

      wavesurfer.getScroll.mockReturnValue(0)
      wavesurfer.getWidth.mockReturnValue(1000)
      wavesurfer.emit('resize')

      expect(Array.from(regionsContainer.children)).toEqual(regions.map((region) => region.element))
    })

    test('re-evaluates visibility when the zoom changes the container width', () => {
      const { wavesurfer, plugin, regionsContainer, containerWidth } = setupVirtual()
      const region = plugin.addRegion({ start: 8, end: 9 })
      jest.runOnlyPendingTimers()
      expect(region.element?.parentElement).toBeNull()

      // Zoomed out to 10 px per second: 8-9 s now sits at 80-90 px
      containerWidth.mockReturnValue(100)
      wavesurfer.emit('zoom', 10)

      expect(region.element?.parentElement).toBe(regionsContainer)
    })

    test('stops tracking a removed region', () => {
      const { wavesurfer, plugin, regionsContainer } = setupVirtual(800)
      const region = plugin.addRegion({ start: 8, end: 9 })
      jest.runOnlyPendingTimers()
      expect(region.element?.parentElement).toBe(regionsContainer)

      region.remove()
      wavesurfer.getScroll.mockClear()
      wavesurfer.emit('scroll', 0, 0, 0, 100)

      expect(regionsContainer.children).toHaveLength(0)
      // With nothing left to place, a scroll does not even measure the viewport
      expect(wavesurfer.getScroll).not.toHaveBeenCalled()
    })
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

  test('skips label placement for a region that opts out and ignores it as an obstacle', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second', avoidOverlapping: false })
    const thirdRegion = plugin.addRegion({ start: 2, end: 3, content: 'Third' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 20, top: 0, width: 40, height: 10 })
    mockRect(thirdRegion.content!, { left: 50, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()
    expect(firstRegion.content?.style.marginTop).toBe('0px')
    expect(secondRegion.content?.style.marginTop).toBe('')
    expect(thirdRegion.content?.style.marginTop).toBe('0px')

    // A drag or resize ends in one pass for all the labels, however many ask for it,
    // and the opted-out region is not measured in it
    const timerCount = jest.getTimerCount()
    firstRegion.onContentBlur()
    firstRegion.onContentBlur()
    expect(jest.getTimerCount()).toBe(timerCount + 1)

    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('')
    expect(thirdRegion.content?.style.marginTop).toBe('0px')
    expect(secondRegion.content!.getBoundingClientRect).not.toHaveBeenCalled()
  })

  test('avoidOverlapping can be changed with setOptions', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 20, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('12px')

    secondRegion.setOptions({ avoidOverlapping: false })
    expect(secondRegion.content?.style.marginTop).toBe('')

    firstRegion.onContentBlur()
    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('')

    secondRegion.setOptions({ avoidOverlapping: true })
    firstRegion.onContentBlur()
    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('12px')

    // A placement already scheduled when the region opts out does nothing
    const thirdRegion = plugin.addRegion({ start: 2, end: 3, content: 'Third' })
    mockRect(thirdRegion.content!, { left: 10, top: 0, width: 40, height: 10 })
    thirdRegion.setOptions({ avoidOverlapping: false })

    jest.runOnlyPendingTimers()
    expect(thirdRegion.content?.style.marginTop).toBe('')
    expect(thirdRegion.content!.getBoundingClientRect).not.toHaveBeenCalled()
  })

  test('opting out together with new content keeps the margin of the new content', () => {
    const wavesurfer = createWaveSurfer()
    const plugin = RegionsPlugin.create()

    plugin._init(wavesurfer as any)

    const firstRegion = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const secondRegion = plugin.addRegion({ start: 1, end: 2, content: 'Second' })

    mockRect(firstRegion.content!, { left: 0, top: 0, width: 40, height: 10 })
    mockRect(secondRegion.content!, { left: 20, top: 0, width: 40, height: 10 })

    jest.runOnlyPendingTimers()
    expect(secondRegion.content?.style.marginTop).toBe('12px')

    const overlay = document.createElement('div')
    overlay.style.marginTop = '24px'
    mockRect(overlay, { left: 20, top: 0, width: 40, height: 10 })

    secondRegion.setOptions({ content: overlay, avoidOverlapping: false })
    expect(secondRegion.content).toBe(overlay)
    expect(overlay.style.marginTop).toBe('24px')

    secondRegion.setOptions({ avoidOverlapping: false })
    firstRegion.onContentBlur()
    jest.runOnlyPendingTimers()
    expect(overlay.style.marginTop).toBe('24px')
    expect(overlay.getBoundingClientRect).not.toHaveBeenCalled()
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

describe('Label stacking and the regions in the DOM', () => {
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

  // 10 s over a 1000 px container = 100 px per second, seen through a 100 px viewport.
  const setup = (scroll = 0) => {
    const wavesurfer = createWaveSurfer(10, 100, scroll)
    const plugin = RegionsPlugin.create()
    plugin._init(wavesurfer as any)
    const regionsContainer = wavesurfer.getWrapper().querySelector<HTMLElement>('[part="regions-container"]')!
    Object.defineProperty(regionsContainer, 'clientWidth', { configurable: true, value: 1000 })
    return { wavesurfer, plugin, regionsContainer }
  }

  // Like a browser, a label that is not in the document has no box: it is all zeros
  const mockLabelRect = (label: HTMLElement, rect: { left: number; top: number; width: number; height: number }) => {
    const measured = jest.fn(() =>
      label.isConnected
        ? {
            ...rect,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            x: rect.left,
            y: rect.top,
            toJSON: () => rect,
          }
        : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) },
    )
    Object.defineProperty(label, 'getBoundingClientRect', { configurable: true, value: measured })
    return measured
  }

  test('stacks the labels of regions that were off screen when they were created, once they scroll into view', () => {
    const { wavesurfer, plugin } = setup(0)
    // Two labels in the way of each other, both at 8-9 s: not in view at scroll 0
    const first = plugin.addRegion({ start: 8, end: 9, content: 'First' })
    const second = plugin.addRegion({ start: 8.2, end: 9.2, content: 'Second' })
    mockLabelRect(first.content!, { left: 800, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 820, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()

    // Nothing in the DOM could be measured, so nothing was stacked
    expect(first.element?.parentElement).toBeNull()
    expect(second.content?.style.marginTop).toBe('')

    wavesurfer.getScroll.mockReturnValue(750)
    wavesurfer.emit('scroll', 7.5, 8.5, 750, 850)

    expect(first.element?.parentElement).not.toBeNull()
    expect(first.content?.style.marginTop).toBe('0px')
    expect(second.content?.style.marginTop).toBe('12px')
  })

  test('only measures the labels of regions that are in the DOM', () => {
    const { plugin } = setup(0)
    const measured = []
    for (let i = 0; i < 40; i++) {
      const region = plugin.addRegion({ start: i * 0.25, end: i * 0.25 + 0.5, content: `r${i}` })
      measured.push(mockLabelRect(region.content!, { left: i * 25, top: 0, width: 50, height: 10 }))
    }
    jest.runOnlyPendingTimers()

    // The viewport shows 0-1 s: regions 0 to 3 overlap it
    const inDom = measured.filter((_, i) => plugin.getRegions()[i].element?.parentElement)
    expect(inDom).toHaveLength(4)
    for (const [i, rect] of measured.entries()) {
      expect(rect).toHaveBeenCalledTimes(plugin.getRegions()[i].element?.parentElement ? 1 : 0)
    }
  })

  test('stacks every label in one pass, however many regions asked for it', () => {
    const { plugin } = setup(0)
    for (let i = 0; i < 20; i++) plugin.addRegion({ start: 0, end: 1, content: `r${i}` })
    jest.runOnlyPendingTimers()

    const timerCount = jest.getTimerCount()
    for (const region of plugin.getRegions()) region.onContentBlur()
    expect(jest.getTimerCount()).toBe(timerCount + 1)
  })

  test('restacks the labels in view when a region comes into view or goes out of view', () => {
    const { wavesurfer, plugin } = setup(0)
    const near = plugin.addRegion({ start: 0.2, end: 1.2, content: 'Near' })
    const far = plugin.addRegion({ start: 1.5, end: 2.5, content: 'Far' })
    const nearRect = mockLabelRect(near.content!, { left: 20, top: 0, width: 60, height: 10 })
    mockLabelRect(far.content!, { left: 50, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    // Only the near region is in view, so the far one has not been stacked
    expect(near.content?.style.marginTop).toBe('0px')
    expect(far.content?.style.marginTop).toBe('')

    // Scrolling brings the far region into view as well: it is moved below the near one
    wavesurfer.getWidth.mockReturnValue(200)
    wavesurfer.emit('scroll', 0, 2, 0, 200)
    expect(far.content?.style.marginTop).toBe('12px')

    // And back out of view: the near label is stacked on its own again
    nearRect.mockClear()
    wavesurfer.getWidth.mockReturnValue(100)
    wavesurfer.emit('scroll', 0, 1, 0, 100)
    expect(nearRect).toHaveBeenCalledTimes(1)
    expect(near.content?.style.marginTop).toBe('0px')
  })

  test('does not restack on a scroll that leaves the regions in the DOM as they were', () => {
    const { wavesurfer, plugin } = setup(0)
    const region = plugin.addRegion({ start: 0, end: 1, content: 'Label' })
    const measured = mockLabelRect(region.content!, { left: 0, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    measured.mockClear()

    wavesurfer.getScroll.mockReturnValue(10)
    wavesurfer.emit('scroll', 0.1, 1.1, 10, 110)

    expect(measured).not.toHaveBeenCalled()
  })

  test('restacks on a zoom or resize, which change how wide the labels are', () => {
    const { wavesurfer, plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
    const firstRect = mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 70, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('0px')

    // The labels are wider after a zoom, and now overlap
    mockLabelRect(second.content!, { left: 50, top: 0, width: 60, height: 10 })
    firstRect.mockClear()
    wavesurfer.emit('zoom', 200)
    expect(firstRect).toHaveBeenCalledTimes(1)
    expect(second.content?.style.marginTop).toBe('12px')

    mockLabelRect(second.content!, { left: 70, top: 0, width: 60, height: 10 })
    wavesurfer.emit('resize')
    expect(second.content?.style.marginTop).toBe('0px')
  })

  test('removing a region lets the labels it kept down move back up', () => {
    const { plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 30, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('12px')

    first.remove()
    jest.runOnlyPendingTimers()

    expect(second.content?.style.marginTop).toBe('0px')
  })

  describe('a label that an earlier label pushed down', () => {
    // 100 px a second, a viewport of 100 px: `near` is at 20-120 px and `second` at 50-150 px, with labels of 60
    // px that overlap. At scroll 130 only `second` is in the DOM.
    const arrange = () => {
      const { wavesurfer, plugin } = setup(0)
      const near = plugin.addRegion({ start: 0.2, end: 1.2, content: 'Near' })
      const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
      mockLabelRect(near.content!, { left: 20, top: 0, width: 60, height: 10 })
      mockLabelRect(second.content!, { left: 50, top: 0, width: 60, height: 10 })
      jest.runOnlyPendingTimers()
      expect(second.content?.style.marginTop).toBe('12px')

      const scrollTo = (left: number) => {
        wavesurfer.getScroll.mockReturnValue(left)
        wavesurfer.emit('scroll', left / 100, (left + 100) / 100, left, left + 100)
      }
      return { wavesurfer, plugin, near, second, scrollTo }
    }

    test('stays down when the label that pushed it leaves the DOM, and when that comes back', () => {
      const { near, second, scrollTo } = arrange()

      scrollTo(130)
      expect(near.element?.parentElement).toBeNull()
      expect(second.element?.parentElement).not.toBeNull()
      expect(second.content?.style.marginTop).toBe('12px')

      scrollTo(0)
      expect(near.element?.parentElement).not.toBeNull()
      expect(second.content?.style.marginTop).toBe('12px')
      expect(near.content?.style.marginTop).toBe('0px')
    })

    test('does not move on every scroll back and forth', () => {
      const { second, scrollTo } = arrange()
      const margins = new Set<string>()
      for (const left of [130, 0, 130, 0, 130, 20, 130, 0]) {
        scrollTo(left)
        margins.add(second.content!.style.marginTop)
      }
      expect([...margins]).toEqual(['12px'])
    })

    test('is stacked from scratch by a zoom, which can change which labels overlap', () => {
      const { wavesurfer, second, scrollTo } = arrange()
      scrollTo(130)
      expect(second.content?.style.marginTop).toBe('12px')

      wavesurfer.emit('zoom', 200)
      expect(second.content?.style.marginTop).toBe('0px')
    })

    test('is not kept down by how it was stacked before a zoom, if it was out of the DOM for the zoom', () => {
      const { wavesurfer, near, second, scrollTo } = arrange()
      // Both are out of the DOM when the zoom stacks from scratch
      scrollTo(200)
      expect(second.element?.parentElement).toBeNull()
      wavesurfer.emit('zoom', 200)

      // After the zoom the labels no longer overlap
      mockLabelRect(second.content!, { left: 150, top: 0, width: 60, height: 10 })
      scrollTo(0)
      expect(near.element?.parentElement).not.toBeNull()
      expect(second.content?.style.marginTop).toBe('0px')
    })

    test('moves back up when the region that pushed it is removed, or moved away', () => {
      const { near, second, scrollTo } = arrange()
      scrollTo(130)
      expect(second.content?.style.marginTop).toBe('12px')

      near.remove()
      jest.runOnlyPendingTimers()
      expect(second.content?.style.marginTop).toBe('0px')
    })

    test('goes down, once, when an earlier label that overlaps it first comes into the DOM', () => {
      // The viewport starts at 110 px, so the first region (0-100 px) is out of the DOM and the second (20-300 px)
      // is in it, with its label 20-80 px: off to the left of the view, but under the first label
      const { wavesurfer, plugin } = setup(110)
      const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
      const second = plugin.addRegion({ start: 0.2, end: 3, content: 'Second' })
      mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
      mockLabelRect(second.content!, { left: 20, top: 0, width: 60, height: 10 })
      jest.runOnlyPendingTimers()
      expect(first.element?.parentElement).toBeNull()
      expect(second.content?.style.marginTop).toBe('0px')

      const scrollTo = (left: number) => {
        wavesurfer.getScroll.mockReturnValue(left)
        wavesurfer.emit('scroll', left / 100, (left + 100) / 100, left, left + 100)
      }
      scrollTo(0)
      expect(first.element?.parentElement).not.toBeNull()
      expect(second.content?.style.marginTop).toBe('12px')

      scrollTo(110)
      expect(first.element?.parentElement).toBeNull()
      expect(second.content?.style.marginTop).toBe('12px')
      scrollTo(0)
      expect(second.content?.style.marginTop).toBe('12px')
    })
  })

  test('moving a region restacks the labels', () => {
    const { plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 30, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('12px')

    // Moved (still in view) clear of the first: its label is measured further along
    mockLabelRect(second.content!, { left: 300, top: 0, width: 60, height: 10 })
    second.setOptions({ start: 0.8, end: 0.95 })
    jest.runOnlyPendingTimers()

    expect(second.content?.style.marginTop).toBe('0px')
  })

  test('stacks around a label that opted back in', () => {
    const { plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second', avoidOverlapping: false })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 30, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('')

    second.setOptions({ avoidOverlapping: true })
    jest.runOnlyPendingTimers()

    expect(second.content?.style.marginTop).toBe('12px')
  })

  test("removing a region's content lets the labels it kept down move back up", () => {
    const { plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 30, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('12px')

    first.setContent(undefined)
    jest.runOnlyPendingTimers()

    expect(first.content).toBeUndefined()
    expect(second.content?.style.marginTop).toBe('0px')
  })

  test('removing content restacks through render, and does not announce a content change', () => {
    const { plugin } = setup(0)
    const labelled = plugin.addRegion({ start: 0, end: 1, content: 'Label' })
    const bare = plugin.addRegion({ start: 2, end: 3 })
    const rendered = jest.fn()
    const changed = jest.fn()
    const bareRendered = jest.fn()
    labelled.on('render', rendered)
    labelled.on('content-changed', changed)
    bare.on('render', bareRendered)

    labelled.setContent(undefined)
    bare.setContent(undefined)

    // `region-content-changed` is public and has never been emitted for a removal
    expect(rendered).toHaveBeenCalledTimes(1)
    expect(changed).not.toHaveBeenCalled()
    // and a region with nothing to remove has nothing to restack
    expect(bareRendered).not.toHaveBeenCalled()
  })

  test('keeps the margins of the labels while the whole waveform is detached from the document', () => {
    const { wavesurfer, plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 30, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('12px')

    // The regions are still in their container, but the container is not in the page:
    // nothing can be measured, and a zoom or resize must not take the margins away
    const wrapper = wavesurfer.getWrapper()
    wrapper.remove()
    wavesurfer.emit('zoom', 200)
    wavesurfer.emit('resize')
    expect(first.content?.style.marginTop).toBe('0px')
    expect(second.content?.style.marginTop).toBe('12px')

    // Back in the page, the labels are stacked from what is measured then
    mockLabelRect(second.content!, { left: 300, top: 0, width: 60, height: 10 })
    document.body.appendChild(wrapper)
    wavesurfer.emit('resize')
    expect(second.content?.style.marginTop).toBe('0px')
  })

  test('keeps the margins of the labels while nothing is laid out, as under a display: none', () => {
    const { wavesurfer, plugin } = setup(0)
    const first = plugin.addRegion({ start: 0, end: 1, content: 'First' })
    const second = plugin.addRegion({ start: 0.5, end: 1.5, content: 'Second' })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 30, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(second.content?.style.marginTop).toBe('12px')

    // Still in the document, but with no box: every label measures as nothing
    const nothing = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }
    for (const region of [first, second]) {
      Object.defineProperty(region.content, 'getBoundingClientRect', { configurable: true, value: () => nothing })
    }
    wavesurfer.emit('resize')
    expect(first.content?.style.marginTop).toBe('0px')
    expect(second.content?.style.marginTop).toBe('12px')

    // Shown again, measured again
    mockLabelRect(second.content!, { left: 300, top: 0, width: 60, height: 10 })
    mockLabelRect(first.content!, { left: 0, top: 0, width: 60, height: 10 })
    wavesurfer.emit('resize')
    expect(second.content?.style.marginTop).toBe('0px')
  })

  test('mounts and restacks the regions once new audio has moved them', () => {
    const { wavesurfer, plugin, regionsContainer } = setup(0)
    // 8-9 s is off screen at 100 px per second
    const first = plugin.addRegion({ start: 8, end: 9, content: 'First' })
    const second = plugin.addRegion({ start: 8.2, end: 9.2, content: 'Second' })
    mockLabelRect(first.content!, { left: 80, top: 0, width: 60, height: 10 })
    mockLabelRect(second.content!, { left: 90, top: 0, width: 60, height: 10 })
    jest.runOnlyPendingTimers()
    expect(first.element?.parentElement).toBeNull()

    // New audio ten times as long: the same seconds are now at 10 px per second, in view
    wavesurfer.getDuration.mockReturnValue(100)
    wavesurfer.emit('ready', 100)

    expect(first.element?.parentElement).toBe(regionsContainer)
    expect(second.element?.parentElement).toBe(regionsContainer)
    expect(first.content?.style.marginTop).toBe('0px')
    expect(second.content?.style.marginTop).toBe('12px')
  })
})
