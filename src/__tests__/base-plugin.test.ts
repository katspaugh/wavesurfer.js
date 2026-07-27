import { BasePlugin } from '../base-plugin.js'

class TestPlugin extends BasePlugin<{ destroy: [] }, {}> {
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

  describe('BasePlugin hardening', () => {
    class TestPluginHardened extends BasePlugin<{ destroy: [] }, unknown> {
      public initCount = 0
      protected onInit() {
        this.initCount++
      }
      public get isDestroyedPublic() {
        return (this as any).destroyed
      }
    }

    it('destroy is idempotent: second call does not re-emit destroy', () => {
      const plugin = new TestPluginHardened({})
      const onDestroy = jest.fn()
      plugin.on('destroy', onDestroy)
      plugin.destroy()
      plugin.destroy()
      expect(onDestroy).toHaveBeenCalledTimes(1)
    })

    it('clears all own listeners after destroy (unAll)', () => {
      const plugin = new TestPluginHardened({})
      const cb = jest.fn()
      plugin.on('destroy', cb)
      plugin.destroy()
      // re-init + destroy again: old listener must NOT fire a second time
      plugin._init({} as never)
      plugin.destroy()
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('exposes protected destroyed flag to subclasses', () => {
      const plugin = new TestPluginHardened({})
      expect(plugin.isDestroyedPublic).toBe(false)
      plugin.destroy()
      expect(plugin.isDestroyedPublic).toBe(true)
      plugin._init({} as never)
      expect(plugin.isDestroyedPublic).toBe(false)
    })
  })
})
