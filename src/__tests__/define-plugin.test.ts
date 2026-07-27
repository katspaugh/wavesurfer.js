jest.mock('../renderer.js', () => {
  let lastInstance: any
  class Renderer {
    options: any
    wrapper = document.createElement('div')
    renderProgress = jest.fn()
    on = jest.fn(() => () => undefined)
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
