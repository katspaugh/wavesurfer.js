import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPlugin,
  PluginBuilder,
  createActionPlugin,
  createStreamPlugin,
  combinePlugins,
} from '../../plugins/create-plugin'
import { createStore, createInitialState } from '../../state'
import { ResourcePool } from '../../utils/resources'
import { BehaviorSubject, Subject } from '../../streams'

describe('createPlugin', () => {
  let context: any

  beforeEach(() => {
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

  it('should create a basic plugin', () => {
    const MyPlugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({
        actions: {
          hello: () => 'world',
        },
      })
    )

    const plugin = MyPlugin()

    expect(plugin.manifest.id).toBe('test')
    expect(plugin.manifest.version).toBe('1.0.0')
    expect(plugin.initialize).toBeDefined()
  })

  it('should pass options to initializer', async () => {
    interface TestOptions {
      count: number
    }

    const MyPlugin = createPlugin<TestOptions>(
      { id: 'test', version: '1.0.0' },
      (ctx, options) => ({
        actions: {
          getCount: () => options.count,
        },
      })
    )

    const plugin = MyPlugin({ count: 42 })
    const instance = await plugin.initialize(context)

    expect(instance.actions?.getCount()).toBe(42)
  })

  it('should support async initialization', async () => {
    const MyPlugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return {
          actions: {
            test: () => 'async',
          },
        }
      }
    )

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    expect(instance.actions?.test()).toBe('async')
  })

  it('should provide context to initializer', async () => {
    const MyPlugin = createPlugin(
      { id: 'test', version: '1.0.0' },
      (ctx) => ({
        actions: {
          getDuration: () => ctx.getDuration(),
          getWidth: () => ctx.getWidth(),
        },
      })
    )

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    expect(instance.actions?.getDuration()).toBe(100)
    expect(instance.actions?.getWidth()).toBe(1000)
  })
})

describe('PluginBuilder', () => {
  let context: any

  beforeEach(() => {
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

  it('should build a plugin with streams', async () => {
    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .addStream('count', 0)
      .build()

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    expect(instance.streams?.count).toBeDefined()

    let value: number | undefined
    instance.streams!.count.subscribe((v: any) => (value = v))
    expect(value).toBe(0)
  })

  it('should build a plugin with actions', async () => {
    let count = 0

    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .addAction('increment', () => count++)
      .addAction('decrement', () => count--)
      .build()

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    instance.actions?.increment()
    instance.actions?.increment()
    instance.actions?.decrement()

    expect(count).toBe(1)
  })

  it('should build a plugin with custom properties', async () => {
    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .addProperty('version', '1.0.0')
      .addProperty('author', 'Test Author')
      .build()

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    expect((instance as any).version).toBe('1.0.0')
    expect((instance as any).author).toBe('Test Author')
  })

  it('should support initialization handler', async () => {
    let initialized = false

    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .onInitialize(() => {
        initialized = true
      })
      .build()

    const plugin = MyPlugin()
    await plugin.initialize(context)

    expect(initialized).toBe(true)
  })

  it('should support destroy handler', async () => {
    let destroyed = false

    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .onDestroyHandler(() => {
        destroyed = true
      })
      .build()

    const plugin = MyPlugin()
    await plugin.initialize(context)

    await context.resources.dispose()

    expect(destroyed).toBe(true)
  })

  it('should cleanup streams on dispose', async () => {
    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .addStream('data', 0)
      .build()

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    let value: number | undefined
    instance.streams!.data.subscribe((v: any) => (value = v))
    expect(value).toBe(0)

    await context.resources.dispose()

    // Should dispose without errors
    expect(instance.streams!.data.closed).toBe(true)
  })

  it('should throw if manifest not set', () => {
    const builder = new PluginBuilder()

    expect(() => builder.build()).toThrow('manifest is required')
  })

  it('should support async initialization', async () => {
    let value = 0

    const MyPlugin = new PluginBuilder()
      .setManifest({ id: 'test', version: '1.0.0' })
      .onInitialize(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        value = 42
      })
      .build()

    const plugin = MyPlugin()
    await plugin.initialize(context)

    expect(value).toBe(42)
  })
})

describe('createActionPlugin', () => {
  let context: any

  beforeEach(() => {
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

  it('should create action-only plugin', async () => {
    const MyPlugin = createActionPlugin(
      { id: 'test', version: '1.0.0' },
      (ctx) => ({
        getDuration: () => ctx.getDuration(),
        formatTime: (seconds: number) => {
          const mins = Math.floor(seconds / 60)
          const secs = Math.floor(seconds % 60)
          return `${mins}:${secs.toString().padStart(2, '0')}`
        },
      })
    )

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    expect(instance.actions?.getDuration()).toBe(100)
    expect(instance.actions?.formatTime(125)).toBe('2:05')
    expect(instance.streams).toBeUndefined()
  })

  it('should pass options to actions', async () => {
    interface TestOptions {
      prefix: string
    }

    const MyPlugin = createActionPlugin<TestOptions>(
      { id: 'test', version: '1.0.0' },
      (ctx, options) => ({
        greet: (name: string) => `${options.prefix} ${name}`,
      })
    )

    const plugin = MyPlugin({ prefix: 'Hello' })
    const instance = await plugin.initialize(context)

    expect(instance.actions?.greet('World')).toBe('Hello World')
  })
})

describe('createStreamPlugin', () => {
  let context: any

  beforeEach(() => {
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

  it('should create stream-only plugin', async () => {
    const MyPlugin = createStreamPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({
        count: new BehaviorSubject(0),
        events: new Subject<string>(),
      })
    )

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    expect(instance.streams?.count).toBeDefined()
    expect(instance.streams?.events).toBeDefined()
    expect(instance.actions).toBeUndefined()
  })

  it('should cleanup streams on dispose', async () => {
    const MyPlugin = createStreamPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({
        data: new Subject<number>(),
      })
    )

    const plugin = MyPlugin()
    const instance = await plugin.initialize(context)

    let values: number[] = []
    instance.streams!.data.subscribe((v: any) => values.push(v))

    await context.resources.dispose()

    // Should dispose without errors
    expect(instance.streams!.data.closed).toBe(true)
  })

  it('should not complete already closed streams', async () => {
    const subject = new Subject<number>()
    subject.complete()

    const MyPlugin = createStreamPlugin(
      { id: 'test', version: '1.0.0' },
      () => ({
        data: subject,
      })
    )

    const plugin = MyPlugin()
    await plugin.initialize(context)

    // Should not throw
    await context.resources.dispose()
  })
})

describe('combinePlugins', () => {
  let context: any

  beforeEach(() => {
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

  it('should combine multiple plugins', async () => {
    const plugin1 = createPlugin(
      { id: 'plugin1', version: '1.0.0' },
      () => ({
        actions: {
          action1: () => 'hello',
        },
        streams: {
          stream1: new BehaviorSubject(1),
        },
      })
    )

    const plugin2 = createPlugin(
      { id: 'plugin2', version: '1.0.0' },
      () => ({
        actions: {
          action2: () => 'world',
        },
        streams: {
          stream2: new BehaviorSubject(2),
        },
      })
    )

    const combined = combinePlugins(
      { id: 'combined', version: '1.0.0' },
      [plugin1(), plugin2()]
    )

    const instance = await combined.initialize(context)

    expect(instance.actions?.action1()).toBe('hello')
    expect(instance.actions?.action2()).toBe('world')

    let value1: number | undefined
    let value2: number | undefined

    instance.streams!.stream1.subscribe((v: any) => (value1 = v))
    instance.streams!.stream2.subscribe((v: any) => (value2 = v))

    expect(value1).toBe(1)
    expect(value2).toBe(2)
  })

  it('should merge streams and actions from all plugins', async () => {
    const plugins = Array.from({ length: 3 }, (_, i) =>
      createPlugin(
        { id: `plugin${i}`, version: '1.0.0' },
        () => ({
          actions: {
            [`action${i}`]: () => i,
          },
          streams: {
            [`stream${i}`]: new BehaviorSubject(i * 10),
          },
        })
      )()
    )

    const combined = combinePlugins(
      { id: 'combined', version: '1.0.0' },
      plugins
    )

    const instance = await combined.initialize(context)

    expect(instance.actions?.action0()).toBe(0)
    expect(instance.actions?.action1()).toBe(1)
    expect(instance.actions?.action2()).toBe(2)

    const values: number[] = []
    instance.streams!.stream0.subscribe((v: any) => values.push(v))
    instance.streams!.stream1.subscribe((v: any) => values.push(v))
    instance.streams!.stream2.subscribe((v: any) => values.push(v))

    expect(values).toEqual([0, 10, 20])
  })

  it('should handle plugins without streams or actions', async () => {
    const plugin1 = createPlugin(
      { id: 'plugin1', version: '1.0.0' },
      () => ({})
    )

    const plugin2 = createPlugin(
      { id: 'plugin2', version: '1.0.0' },
      () => ({
        actions: { test: () => 'hello' },
      })
    )

    const combined = combinePlugins(
      { id: 'combined', version: '1.0.0' },
      [plugin1(), plugin2()]
    )

    const instance = await combined.initialize(context)

    expect(instance.actions?.test()).toBe('hello')
  })
})
