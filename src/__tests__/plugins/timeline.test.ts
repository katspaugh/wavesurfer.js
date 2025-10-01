import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TimelinePlugin } from '../../plugins/timeline'
import { createStore, createInitialState } from '../../state'
import { ResourcePool } from '../../utils/resources'

describe('TimelinePlugin', () => {
  let context: any
  let store: any
  let resources: ResourcePool

  beforeEach(() => {
    store = createStore(createInitialState())
    resources = new ResourcePool()

    const wrapper = document.createElement('div')
    const parent = document.createElement('div')
    parent.appendChild(wrapper)
    document.body.appendChild(parent)

    context = {
      store,
      resources,
      container: document.createElement('div'),
      getWrapper: () => wrapper,
      getScroll: () => 0,
      setScroll: () => {},
      getWidth: () => 1000,
      getDuration: () => 100,
      getDecodedData: () => null,
      getMediaElement: () => document.createElement('audio'),
    }

    // Set initial state
    store.update((state: any) => ({
      ...state,
      audio: {
        ...state.audio,
        duration: 100,
      },
      view: {
        ...state.view,
        containerWidth: 1000,
        minPxPerSec: 10,
      },
    }))
  })

  it('should create timeline with default options', async () => {
    const plugin = TimelinePlugin()
    const instance = await plugin.initialize(context)

    expect(instance.actions).toBeDefined()
    expect(instance.actions?.render).toBeDefined()
    expect(instance.actions?.setHeight).toBeDefined()
  })

  it('should create timeline container', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    expect(timeline).toBeDefined()
    expect(timeline?.tagName).toBe('DIV')
  })

  it('should use custom height', async () => {
    const plugin = TimelinePlugin({ height: 40 })
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]') as HTMLElement

    expect(timeline?.style.height).toBe('40px')
  })

  it('should use default height if not specified', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]') as HTMLElement

    expect(timeline?.style.height).toBe('20px')
  })

  it('should render time labels', async () => {
    const plugin = TimelinePlugin()
    const instance = await plugin.initialize(context)

    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    // Should have notches and labels
    expect(timeline?.children.length).toBeGreaterThan(0)
  })

  it('should format time with default formatter', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')
    const labels = Array.from(timeline?.querySelectorAll('div') || [])
      .filter((el) => el.textContent)
      .map((el) => el.textContent)

    // Should have formatted times like "0:00", "0:10", etc.
    expect(labels.some((label) => label?.match(/\d+:\d{2}/))).toBe(true)
  })

  it('should use custom time formatter', async () => {
    const plugin = TimelinePlugin({
      formatTimeCallback: (seconds) => `${seconds}s`,
    })
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')
    const labels = Array.from(timeline?.querySelectorAll('div') || [])
      .filter((el) => el.textContent)
      .map((el) => el.textContent)

    // Should have custom format like "0s", "10s", etc.
    expect(labels.some((label) => label?.endsWith('s'))).toBe(true)
  })

  it('should use custom time interval', async () => {
    const plugin = TimelinePlugin({
      timeInterval: 10,
    })
    const instance = await plugin.initialize(context)

    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    // With 100s duration and 10s interval, should have ~10 major intervals
    const labels = Array.from(timeline?.querySelectorAll('div') || []).filter(
      (el) => el.textContent
    )
    expect(labels.length).toBeGreaterThanOrEqual(5)
    expect(labels.length).toBeLessThanOrEqual(15)
  })

  it('should use custom colors', async () => {
    const plugin = TimelinePlugin({
      primaryLabelColor: '#ff0000',
      secondaryLabelColor: '#00ff00',
      notchColor: '#0000ff',
    })
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]') as HTMLElement

    // Check that border-top includes the notch color (converted to rgb by browser)
    expect(timeline?.style.borderTop).toMatch(/rgb\(0,\s*0,\s*255\)/)
  })

  it('should subscribe to state changes', async () => {
    const plugin = TimelinePlugin()
    const instance = await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    const initialChildren = timeline?.children.length || 0

    // Update duration
    store.update((state: any) => ({
      ...state,
      audio: {
        ...state.audio,
        duration: 200,
      },
    }))

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Timeline should still exist after state change
    expect(timeline).toBeDefined()
  })

  it('should update dynamically on state changes', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    // Multiple updates should not throw
    store.update((state: any) => ({
      ...state,
      view: { ...state.view, minPxPerSec: 20 },
    }))
    store.update((state: any) => ({
      ...state,
      view: { ...state.view, minPxPerSec: 25 },
    }))
    store.update((state: any) => ({
      ...state,
      view: { ...state.view, containerWidth: 2000 },
    }))

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Should complete without errors
    expect(true).toBe(true)
  })

  it('should update height dynamically', async () => {
    const plugin = TimelinePlugin({ height: 20 })
    const instance = await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]') as HTMLElement

    expect(timeline?.style.height).toBe('20px')

    instance.actions?.setHeight(50)

    expect(timeline?.style.height).toBe('50px')
  })

  it('should handle zero duration gracefully', async () => {
    context.getDuration = () => 0

    store.update((state: any) => ({
      ...state,
      audio: {
        ...state.audio,
        duration: 0,
      },
    }))

    const plugin = TimelinePlugin()
    const instance = await plugin.initialize(context)

    // Should not throw
    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    // Timeline is created but render function exits early, so children may vary
    expect(timeline).toBeDefined()
  })

  it('should create notches at intervals', async () => {
    const plugin = TimelinePlugin({
      timeInterval: 5,
    })
    const instance = await plugin.initialize(context)

    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')
    const notches = Array.from(timeline?.children || [])

    // Should have notches (more than labels since we have both major and minor notches)
    expect(notches.length).toBeGreaterThan(10)
  })

  it('should differentiate major and minor notches', async () => {
    const plugin = TimelinePlugin({
      timeInterval: 5,
    })
    const instance = await plugin.initialize(context)

    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')
    const notches = Array.from(timeline?.children || []) as HTMLElement[]

    const heights = notches
      .filter((el) => !el.textContent) // Exclude labels
      .map((el) => el.style.height)

    // Should have both 100% (major) and 50% (minor) notches
    expect(heights.some((h) => h === '100%')).toBe(true)
    expect(heights.some((h) => h === '50%')).toBe(true)
  })

  it('should position labels correctly', async () => {
    const plugin = TimelinePlugin()
    const instance = await plugin.initialize(context)

    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')
    const labels = Array.from(timeline?.querySelectorAll('div') || []).filter(
      (el) => el.textContent
    ) as HTMLElement[]

    // All labels should have position: absolute and left percentage
    labels.forEach((label) => {
      expect(label.style.position).toBe('absolute')
      expect(label.style.left).toMatch(/\d+%/)
    })
  })

  it('should increase interval when pixels per second is low', async () => {
    store.update((state: any) => ({
      ...state,
      view: {
        ...state.view,
        minPxPerSec: 5, // Low value
      },
    }))

    const plugin = TimelinePlugin({
      timeInterval: 5,
    })
    const instance = await plugin.initialize(context)

    instance.actions?.render()

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')
    const labels = Array.from(timeline?.querySelectorAll('div') || []).filter(
      (el) => el.textContent
    )

    // With low pixels per second, should use doubled interval (fewer labels)
    expect(labels.length).toBeLessThan(12)
  })

  it('should cleanup on dispose', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    expect(timeline?.parentElement).toBeTruthy()

    await resources.dispose()

    expect(timeline?.parentElement).toBeFalsy()
  })

  it('should insert timeline after wrapper', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    // Timeline should be a sibling of wrapper, not inside it
    expect(timeline?.parentElement).toBe(parent)
    expect(wrapper.contains(timeline as Node)).toBe(false)
  })

  it('should render immediately on initialization', async () => {
    const plugin = TimelinePlugin()
    await plugin.initialize(context)

    const wrapper = context.getWrapper()
    const parent = wrapper.parentElement
    const timeline = parent?.querySelector('[part="timeline"]')

    // Should already have content
    expect(timeline?.children.length).toBeGreaterThan(0)
  })
})
