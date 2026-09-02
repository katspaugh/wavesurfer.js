jest.mock('../renderer.js', () => {
  // Real signals from the reactive store so initRendererEvents() can wire the
  // bridge against this mock.
  const { signal } = jest.requireActual('../reactive/store.js')
  let lastInstance: any
  class Renderer {
    options: any
    wrapper = document.createElement('div')
    renderProgress = jest.fn()
    clickSignal = signal(null)
    dblclickSignal = signal(null)
    dragEventsSignal = signal(null)
    renderEpoch = signal(0)
    renderedEpoch = signal(0)
    resizeEpoch = signal(0)
    scrollSignals = { percentages: signal({ startX: 0, endX: 0 }), bounds: signal({ left: 0, right: 0 }) }
    getScrollSignals = jest.fn(() => this.scrollSignals)
    setOptions = jest.fn()
    getWrapper = jest.fn(() => this.wrapper)
    getWidth = jest.fn(() => 100)
    getScroll = jest.fn(() => 0)
    setScroll = jest.fn()
    setScrollPercentage = jest.fn()
    render = jest.fn()
    zoom = jest.fn()
    exportImage = jest.fn(() => [])
    destroy = jest.fn()
    constructor(options: any) {
      this.options = options
      lastInstance = this
    }
  }
  return { __esModule: true, default: Renderer, getLastInstance: () => lastInstance }
})

jest.mock('../frame-scheduler.js', () => {
  class FrameScheduler {
    start = jest.fn()
    stop = jest.fn()
    constructor(scope: any) {
      scope.add(() => this.stop())
    }
  }
  return { __esModule: true, FrameScheduler }
})

jest.mock('../decoder.js', () => {
  const createBuffer = jest.fn((data: any[], duration: number) => ({
    duration,
    numberOfChannels: data.length,
    getChannelData: (i: number) => Float32Array.from(data[i] as number[]),
  }))
  return { __esModule: true, default: { decode: jest.fn(), createBuffer } }
})

import WaveSurfer from '../wavesurfer.js'
import { definePlugin } from '../define-plugin.js'

const makePlugin = () =>
  definePlugin<
    { label?: string },
    { destroy: []; ping: [n: number] },
    { ping: (n: number) => void; label: () => string }
  >('test-plugin', (ctx, options) => {
    const el = document.createElement('div')
    ctx.wavesurfer.getWrapper().appendChild(el)
    ctx.scope.add(() => el.remove())
    return {
      ping: (n) => ctx.emit('ping', n),
      label: () => options.label ?? 'none',
    }
  })

const wsStub = () => {
  const wrapper = document.createElement('div')
  return {
    getWrapper: () => wrapper,
    getState: () => ({}) as never,
    _wrapper: wrapper,
  } as never
}

describe('definePlugin', () => {
  it('exposes api methods after init and emits typed events', () => {
    const Plugin = makePlugin()
    const plugin = Plugin.create({ label: 'x' })
    plugin._init(wsStub())
    const spy = jest.fn()
    plugin.on('ping', spy)
    plugin.ping(7)
    expect(spy).toHaveBeenCalledWith(7)
    expect(plugin.label()).toBe('x')
  })

  it('supports new Plugin(options) as well as create()', () => {
    const Plugin = makePlugin()
    expect(() => new Plugin({})).not.toThrow()
  })

  it('disposes the scope on destroy (resources released) and delivers the destroy event', () => {
    const Plugin = makePlugin()
    const plugin = Plugin.create({})
    const ws = wsStub()
    plugin._init(ws)
    const wrapper = (ws as any)._wrapper as HTMLElement
    expect(wrapper.children.length).toBe(1)
    const onDestroy = jest.fn()
    plugin.on('destroy', onDestroy)
    plugin.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
    expect(wrapper.children.length).toBe(0)
  })

  it('re-init after destroy runs setup again on a fresh scope', () => {
    const Plugin = makePlugin()
    const plugin = Plugin.create({})
    const ws = wsStub()
    plugin._init(ws)
    plugin.destroy()
    plugin._init(ws)
    expect(((ws as any)._wrapper as HTMLElement).children.length).toBe(1)
    plugin.destroy()
  })

  it('is accepted by wavesurfer.registerPlugin', () => {
    const Plugin = makePlugin()
    const ws = WaveSurfer.create({ container: document.createElement('div') })
    const plugin = ws.registerPlugin(Plugin.create({}))
    expect(ws.getActivePlugins()).toContain(plugin)
    ws.destroy()
  })

  it('throws when the setup api collides with a chassis key, naming the plugin', () => {
    const Plugin = definePlugin<{}, { destroy: [] }, { destroy: () => void }>('collide-plugin', () => ({
      destroy: () => undefined,
    }))
    const plugin = Plugin.create({})
    expect(() => plugin._init(wsStub())).toThrow(/collide-plugin/)
  })

  it('throws when the setup api collides with a runtime-private chassis field (isDestroyed / listeners)', () => {
    // `Api = any` here: TS itself catches `isDestroyed`/`listeners` colliding
    // with BasePlugin/EventEmitter's private fields at the type level
    // (intersection collapses to `never`) when Api is precisely typed. The
    // runtime guard exists for exactly the case type-checking can't cover —
    // an untyped/`any`-typed setup(), a plain-JS consumer, or a type escape
    // hatch — so this test deliberately opts out of that type-level safety
    // net to exercise the runtime check.
    const PluginA = definePlugin<{}, { destroy: [] }, any>('collide-isDestroyed', () => ({
      isDestroyed: true,
    }))
    expect(() => PluginA.create({})._init(wsStub())).toThrow(/collide-isDestroyed/)

    const PluginB = definePlugin<{}, { destroy: [] }, any>('collide-listeners', () => ({
      listeners: {},
    }))
    expect(() => PluginB.create({})._init(wsStub())).toThrow(/collide-listeners/)
  })

  it('throws when the setup api collides with the onInit chassis method', () => {
    // An api key named `onInit` would shadow `Defined.prototype.onInit` on
    // the instance via `Object.assign(this, api)`, silently breaking a
    // subsequent destroy() -> _init() re-init cycle (see RESERVED_CHASSIS_KEYS
    // comment in define-plugin.ts). Must be caught, same as `destroy`.
    const Plugin = definePlugin<{}, { destroy: [] }, any>('collide-onInit', () => ({
      onInit: () => undefined,
    }))
    expect(() => Plugin.create({})._init(wsStub())).toThrow(/collide-onInit/)
  })

  it('makes the constructor/create() arg optional when Options has no required fields, required otherwise', () => {
    // All-optional Options: `create()`/`new Plugin()` need no argument.
    const OptionalPlugin = definePlugin<{ label?: string }, { destroy: [] }, {}>('optional-opts', () => ({}))
    expect(() => OptionalPlugin.create()).not.toThrow()
    expect(() => new OptionalPlugin()).not.toThrow()

    // Options with a required field: the argument stays required — a
    // no-arg call is a compile error (checked below), not just a runtime
    // possibility.
    const RequiredPlugin = definePlugin<{ req: number }, { destroy: [] }, {}>('required-opts', () => ({}))
    // @ts-expect-error - `req` is required on this plugin's Options, so create() must be called with an argument
    RequiredPlugin.create()
    expect(() => RequiredPlugin.create({ req: 1 })).not.toThrow()
  })

  it('does not eagerly read wavesurfer/state at setup time, only lazily via ctx getters', () => {
    const Plugin = definePlugin<{}, { destroy: [] }, { read: () => unknown }>('lazy-plugin', (ctx) => ({
      read: () => ctx.state,
    }))
    const plugin = Plugin.create({})
    // A stub missing getState() must not throw during _init — only when the
    // api actually reads ctx.state.
    const wsWithoutState = { getWrapper: () => document.createElement('div') } as never
    expect(() => plugin._init(wsWithoutState)).not.toThrow()
  })
})
