import { BasePlugin } from '../base-plugin.js'

class TestPlugin extends BasePlugin<{destroy: []}, {}> {
  initCalled = false
  protected onInit() {
    this.initCalled = true
  }
}

describe('BasePlugin', () => {
  test('_init calls onInit and sets wavesurfer', () => {
    const plugin = new TestPlugin({})
    const ws = {} as any
    plugin._init(ws)
    expect((plugin as any).wavesurfer).toBe(ws)
    expect(plugin.initCalled).toBe(true)
  })

  test('destroy emits destroy and unsubscribes', () => {
    const plugin = new TestPlugin({})
    const unsub = jest.fn()
    ;(plugin as any).subscriptions = [unsub]
    const spy = jest.fn()
    plugin.on('destroy', spy)
    plugin.destroy()
    expect(spy).toHaveBeenCalled()
    expect(unsub).toHaveBeenCalled()
  })
})
