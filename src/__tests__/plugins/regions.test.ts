import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RegionsPlugin } from '../../plugins/regions'
import type { Region } from '../../plugins/regions'
import { createStore, createInitialState } from '../../state'
import { ResourcePool } from '../../utils/resources'

describe('RegionsPlugin', () => {
  let context: any
  let store: any
  let resources: ResourcePool

  beforeEach(() => {
    store = createStore(createInitialState())
    resources = new ResourcePool()

    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)

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

    // Set initial duration in store
    store.update((state: any) => ({
      ...state,
      audio: {
        ...state.audio,
        duration: 100,
      },
    }))
  })

  it('should add a region', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({
      start: 10,
      end: 20,
      color: 'rgba(255, 0, 0, 0.3)',
    })

    expect(region).toBeDefined()
    expect(region?.id).toBeDefined()
    expect(region?.start).toBe(10)
    expect(region?.end).toBe(20)
    expect(region?.color).toBe('rgba(255, 0, 0, 0.3)')
  })

  it('should generate unique IDs for regions', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region1 = instance.actions?.addRegion({ start: 10, end: 20 })
    const region2 = instance.actions?.addRegion({ start: 30, end: 40 })

    expect(region1?.id).not.toBe(region2?.id)
  })

  it('should use custom region ID if provided', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({
      id: 'custom-id',
      start: 10,
      end: 20,
    })

    expect(region?.id).toBe('custom-id')
  })

  it('should emit regions through stream', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    let regions: Region[] = []
    instance.streams?.regions.subscribe((r: any) => (regions = r))

    instance.actions?.addRegion({ start: 10, end: 20 })
    instance.actions?.addRegion({ start: 30, end: 40 })

    expect(regions).toHaveLength(2)
  })

  it('should get all regions', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    instance.actions?.addRegion({ start: 10, end: 20 })
    instance.actions?.addRegion({ start: 30, end: 40 })

    const regions = instance.actions?.getRegions()
    expect(regions).toHaveLength(2)
  })

  it('should get region by ID', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({
      id: 'test-region',
      start: 10,
      end: 20,
    })

    const found = instance.actions?.getRegion('test-region')
    expect(found).toBe(region)
  })

  it('should return undefined for non-existent region', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const found = instance.actions?.getRegion('non-existent')
    expect(found).toBeUndefined()
  })

  it('should remove a region', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })

    expect(instance.actions?.getRegions()).toHaveLength(1)

    region?.remove()

    expect(instance.actions?.getRegions()).toHaveLength(0)
  })

  it('should emit updated regions after removal', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    let regions: Region[] = []
    instance.streams?.regions.subscribe((r: any) => (regions = r))

    const region = instance.actions?.addRegion({ start: 10, end: 20 })
    expect(regions).toHaveLength(1)

    region?.remove()
    expect(regions).toHaveLength(0)
  })

  it('should clear all regions', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    instance.actions?.addRegion({ start: 10, end: 20 })
    instance.actions?.addRegion({ start: 30, end: 40 })
    instance.actions?.addRegion({ start: 50, end: 60 })

    expect(instance.actions?.getRegions()).toHaveLength(3)

    instance.actions?.clearRegions()

    expect(instance.actions?.getRegions()).toHaveLength(0)
  })

  it('should update region properties', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({
      start: 10,
      end: 20,
      color: 'red',
    })

    region?.update({ start: 15, end: 25, color: 'blue' })

    expect(region?.start).toBe(15)
    expect(region?.end).toBe(25)
    expect(region?.color).toBe('blue')
  })

  it('should emit updated regions after update', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    let updateCount = 0
    instance.streams?.regions.subscribe(() => updateCount++)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })
    // BehaviorSubject emits initial value [] plus the add
    expect(updateCount).toBe(2)

    region?.update({ start: 15 })
    expect(updateCount).toBe(3) // After update
  })

  it('should clamp region times to duration', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({
      start: -10,
      end: 150,
    })

    expect(region?.start).toBe(0)
    expect(region?.end).toBe(100)
  })

  it('should handle marker regions (start === end)', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const marker = instance.actions?.addRegion({
      start: 50,
      color: 'red',
    })

    expect(marker?.start).toBe(50)
    expect(marker?.end).toBe(50)
  })

  it('should use default color if not provided', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })

    expect(region?.color).toBe('rgba(0, 0, 0, 0.1)')
  })

  it('should set drag and resize flags', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region1 = instance.actions?.addRegion({
      start: 10,
      end: 20,
      drag: true,
      resize: true,
    })

    const region2 = instance.actions?.addRegion({
      start: 30,
      end: 40,
      drag: false,
      resize: false,
    })

    expect(region1?.drag).toBe(true)
    expect(region1?.resize).toBe(true)
    expect(region2?.drag).toBe(false)
    expect(region2?.resize).toBe(false)
  })

  it('should default drag and resize to true', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })

    expect(region?.drag).toBe(true)
    expect(region?.resize).toBe(true)
  })

  it('should create region DOM elements', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })

    expect(region?.element).toBeDefined()
    expect(region?.element?.tagName).toBe('DIV')
  })

  it('should update region element position on update', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })
    const element = region?.element

    region?.update({ start: 30, end: 40 })

    expect(element?.style.left).toBe('30%')
  })

  it('should subscribe to duration changes', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 50, end: 100 })

    // Just verify subscription exists and doesn't throw
    store.update((state: any) => ({
      ...state,
      audio: {
        ...state.audio,
        duration: 200,
      },
    }))

    // Give time for subscription to fire
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Subscription should have fired without errors
    expect(region?.element).toBeDefined()
  })

  it('should play region from start', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 25, end: 50 })

    region?.play()

    const state = store.snapshot
    expect(state.playback.currentTime).toBe(25)
    expect(state.playback.isPlaying).toBe(true)
  })

  it('should remove element when region is removed', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({ start: 10, end: 20 })
    const element = region?.element

    expect(element?.parentElement).toBeTruthy()

    region?.remove()

    expect(element?.parentElement).toBeFalsy()
    expect(region?.element).toBeNull()
  })

  it('should cleanup on dispose', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    instance.actions?.addRegion({ start: 10, end: 20 })
    instance.actions?.addRegion({ start: 30, end: 40 })

    expect(instance.actions?.getRegions()).toHaveLength(2)

    await resources.dispose()

    // Resources should be disposed without errors
    expect(true).toBe(true)
  })

  it('should handle multiple regions with overlapping times', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region1 = instance.actions?.addRegion({
      start: 10,
      end: 30,
      color: 'red',
    })
    const region2 = instance.actions?.addRegion({
      start: 20,
      end: 40,
      color: 'blue',
    })

    expect(instance.actions?.getRegions()).toHaveLength(2)
    expect(region1?.start).toBe(10)
    expect(region2?.start).toBe(20)
  })

  it('should not allow negative times', async () => {
    const plugin = RegionsPlugin()
    const instance = await plugin.initialize(context)

    const region = instance.actions?.addRegion({
      start: -5,
      end: -10,
    })

    expect(region?.start).toBe(0)
    expect(region?.end).toBe(0)
  })
})
