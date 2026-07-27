import RecordPlugin from '../plugins/record.js'

describe('RecordPlugin teardown', () => {
  it('emits record-end BEFORE listeners are cleared on destroy', () => {
    const plugin = RecordPlugin.create()
    const onEnd = jest.fn()
    plugin.on('record-end', onEnd)

    // Simulate an active recorder whose stop() triggers the browser's
    // onstop handler synchronously, which in real code emits 'record-end'.
    const anyPlugin = plugin as any
    anyPlugin.mediaRecorder = {
      state: 'recording',
      stop: () => anyPlugin.emit('record-end', new Blob()),
      stream: { getTracks: () => [] },
    }

    plugin.destroy()

    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('record-progress works after destroy + re-init', () => {
    const plugin = RecordPlugin.create()
    plugin.destroy()
    plugin._init({} as never)

    const anyPlugin = plugin as any
    const onProgress = jest.fn()
    plugin.on('record-progress', onProgress)

    anyPlugin.timer.emit('tick')

    expect(onProgress).toHaveBeenCalled()
  })

  it('destroys the timer on plugin destroy', () => {
    const plugin = RecordPlugin.create()
    const anyPlugin = plugin as any
    const timerDestroySpy = jest.spyOn(anyPlugin.timer, 'destroy')

    plugin.destroy()

    expect(timerDestroySpy).toHaveBeenCalledTimes(1)
  })

  it('destroy is idempotent', () => {
    const plugin = RecordPlugin.create()
    expect(() => {
      plugin.destroy()
      plugin.destroy()
    }).not.toThrow()
  })
})
