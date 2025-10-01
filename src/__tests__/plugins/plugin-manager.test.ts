import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager } from '../../plugins/plugin-manager'
import { createPlugin } from '../../plugins/create-plugin'
import { createStore, createInitialState } from '../../state'
import { ResourcePool } from '../../utils/resources'
import { BehaviorSubject } from '../../streams'

describe('PluginManager', () => {
  let manager: PluginManager
  let context: any

  beforeEach(() => {
    manager = new PluginManager()

    const store = createStore(createInitialState())
    const resources = new ResourcePool()

    context = {
      store,
      resources,
      container: document.createElement('div'),
      getWrapper: () => document.createElement('div'),
      getScroll: () => 0,
      setScroll: () => {},
      getWidth: () => 1000,
      getDuration: () => 100,
      getDecodedData: () => null,
      getMediaElement: () => document.createElement('audio'),
    }
  })

  it('should register a plugin', async () => {
    const plugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({ actions: { test: () => 'hello' } })
    )

    const registered = await manager.register(plugin(), context)

    expect(registered.manifest.id).toBe('test')
    expect(manager.has('test')).toBe(true)
  })

  it('should not allow duplicate plugin IDs', async () => {
    const plugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({})
    )

    await manager.register(plugin(), context)

    await expect(
      manager.register(plugin(), context)
    ).rejects.toThrow('already registered')
  })

  it('should unregister a plugin', async () => {
    const plugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({})
    )

    await manager.register(plugin(), context)
    expect(manager.has('test')).toBe(true)

    await manager.unregister('test')
    expect(manager.has('test')).toBe(false)
  })

  it('should invoke plugin actions', async () => {
    const plugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({
        actions: {
          greet: (name: string) => `Hello, ${name}!`,
        },
      })
    )

    await manager.register(plugin(), context)

    const result = manager.invoke('test', 'greet', 'World')
    expect(result).toBe('Hello, World!')
  })

  it('should get plugin streams', async () => {
    const plugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({
        streams: {
          data: new BehaviorSubject(42),
        },
      })
    )

    await manager.register(plugin(), context)

    const stream = manager.getStream('test', 'data')
    expect(stream).toBeDefined()

    let value: number | undefined
    stream.subscribe((v: number) => (value = v))
    expect(value).toBe(42)
  })

  it('should check dependencies', async () => {
    const dependentPlugin = createPlugin(
      {
        id: 'dependent',
        version: '1.0.0',
        dependencies: ['required'],
      },
      () => ({})
    )

    await expect(
      manager.register(dependentPlugin(), context)
    ).rejects.toThrow('depends on')
  })

  it('should allow plugin with satisfied dependencies', async () => {
    const requiredPlugin = createPlugin(
      { id: 'required', version: '1.0.0' },
      () => ({})
    )

    const dependentPlugin = createPlugin(
      {
        id: 'dependent',
        version: '1.0.0',
        dependencies: ['required'],
      },
      () => ({})
    )

    await manager.register(requiredPlugin(), context)
    await manager.register(dependentPlugin(), context)

    expect(manager.has('required')).toBe(true)
    expect(manager.has('dependent')).toBe(true)
  })

  it('should get all plugins', async () => {
    const plugin1 = createPlugin(
      { id: 'plugin1', version: '1.0.0' },
      () => ({})
    )
    const plugin2 = createPlugin(
      { id: 'plugin2', version: '1.0.0' },
      () => ({})
    )

    await manager.register(plugin1(), context)
    await manager.register(plugin2(), context)

    const all = manager.getAll()
    expect(all).toHaveLength(2)
  })

  it('should unregister all plugins', async () => {
    const plugin1 = createPlugin(
      { id: 'plugin1', version: '1.0.0' },
      () => ({})
    )
    const plugin2 = createPlugin(
      { id: 'plugin2', version: '1.0.0' },
      () => ({})
    )

    await manager.register(plugin1(), context)
    await manager.register(plugin2(), context)

    expect(manager.count).toBe(2)

    await manager.unregisterAll()

    expect(manager.count).toBe(0)
  })

  it('should dispose plugin resources on unregister', async () => {
    let disposed = false

    const plugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      (ctx) => {
        ctx.resources.addCleanup(() => {
          disposed = true
        })
        return {}
      }
    )

    await manager.register(plugin(), context)
    await manager.unregister('test')

    expect(disposed).toBe(true)
  })
})
