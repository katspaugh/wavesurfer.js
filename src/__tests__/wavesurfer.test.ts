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

jest.mock('../timer.js', () => {
  let lastInstance: any
  class Timer {
    on = jest.fn(() => () => undefined)
    start = jest.fn()
    stop = jest.fn()
    destroy = jest.fn()
  }
  const ctor = jest.fn(() => {
    lastInstance = new Timer()
    return lastInstance
  })
  return { __esModule: true, default: ctor, getLastInstance: () => lastInstance }
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
import { BasePlugin } from '../base-plugin.js'
import * as RendererModule from '../renderer.js'
import * as TimerModule from '../timer.js'
const getRenderer = (RendererModule as any).getLastInstance as () => any
const getTimer = (TimerModule as any).getLastInstance as () => any

const createMedia = () => {
  const media = document.createElement('audio') as HTMLMediaElement & { play: jest.Mock; pause: jest.Mock }
  media.play = jest.fn().mockResolvedValue(undefined)
  media.pause = jest.fn()
  Object.defineProperty(media, 'duration', { configurable: true, value: 100, writable: true })
  return media
}

const createWs = (opts: any = {}) => {
  const container = document.createElement('div')
  return WaveSurfer.create({ container, media: createMedia(), ...opts })
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('WaveSurfer public methods', () => {
  test('create returns instance', () => {
    const ws = createWs()
    expect(ws).toBeInstanceOf(WaveSurfer)
  })

  test('setOptions merges options and updates renderer', () => {
    const ws = createWs()
    ws.setOptions({ height: 200, audioRate: 2, mediaControls: true })
    const renderer = getRenderer()
    expect(ws.options.height).toBe(200)
    expect(renderer.setOptions).toHaveBeenCalledWith(ws.options)
    expect(ws.getPlaybackRate()).toBe(2)
    expect(ws.getMediaElement().controls).toBe(true)
  })

  test('registerPlugin adds and removes plugin', () => {
    const ws = createWs()
    class TestPlugin extends BasePlugin<{ destroy: [] }, {}> {}
    const plugin = new TestPlugin({})
    ws.registerPlugin(plugin)
    expect(ws.getActivePlugins()).toContain(plugin)
    plugin.destroy()
    expect(ws.getActivePlugins()).not.toContain(plugin)
  })

  test('wrapper and scroll helpers call renderer', () => {
    const ws = createWs()
    const renderer = getRenderer()
    ws.getWrapper()
    expect(renderer.getWrapper).toHaveBeenCalled()
    ws.getWidth()
    expect(renderer.getWidth).toHaveBeenCalled()
    ws.getScroll()
    expect(renderer.getScroll).toHaveBeenCalled()
    ws.setScroll(42)
    expect(renderer.setScroll).toHaveBeenCalledWith(42)
    jest.spyOn(ws, 'getDuration').mockReturnValue(10)
    ws.setScrollTime(5)
    expect(renderer.setScrollPercentage).toHaveBeenCalledWith(0.5)
  })

  test('load and loadBlob call loadAudio', async () => {
    const ws = createWs()
    const spy = jest.spyOn(ws as any, 'loadAudio').mockResolvedValue(undefined)
    await ws.load('url')
    expect(spy).toHaveBeenCalledWith('url', undefined, undefined, undefined)
    const blob = new Blob([])
    await ws.loadBlob(blob)
    expect(spy).toHaveBeenCalledWith('', blob, undefined, undefined)
  })

  test('zoom requires decoded data', () => {
    const ws = createWs()
    expect(() => ws.zoom(10)).toThrow()
    ;(ws as any).decodedData = { duration: 1 }
    ws.zoom(10)
    expect(getRenderer().zoom).toHaveBeenCalledWith(10)
  })

  test('getDecodedData returns buffer', () => {
    const ws = createWs()
    ;(ws as any).decodedData = 123 as any
    expect(ws.getDecodedData()).toBe(123)
  })

  test('exportPeaks reads data from buffer', () => {
    const ws = createWs()
    ;(ws as any).decodedData = {
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([0, 1, -1]),
      duration: 3,
    }
    const peaks = ws.exportPeaks({ maxLength: 3, precision: 100 })
    expect(peaks[0]).toEqual([0, 1, -1])
  })

  test('getDuration falls back to decoded data', () => {
    const ws = createWs()
    const media = ws.getMediaElement()
    Object.defineProperty(media, 'duration', { configurable: true, value: Infinity })
    ;(ws as any).decodedData = { duration: 2 }
    expect(ws.getDuration()).toBe(2)
  })

  test('toggleInteraction sets option', () => {
    const ws = createWs()
    ws.toggleInteraction(false)
    expect(ws.options.interact).toBe(false)
  })

  test('setTime updates progress and emits event', () => {
    const ws = createWs()
    const spy = jest.fn()
    ws.on('timeupdate', spy)
    ws.setTime(1)
    expect(spy).toHaveBeenCalledWith(1)
    expect(getRenderer().renderProgress).toHaveBeenCalled()
  })

  test('seekTo calculates correct time', () => {
    const ws = createWs()
    jest.spyOn(ws, 'getDuration').mockReturnValue(10)
    const setTimeSpy = jest.spyOn(ws, 'setTime')
    ws.seekTo(0.5)
    expect(setTimeSpy).toHaveBeenCalledWith(5)
  })

  test('play sets start and end', async () => {
    const ws = createWs()
    const spy = jest.spyOn(ws, 'setTime')
    await ws.play(2, 4)
    expect(spy).toHaveBeenCalledWith(2)
    expect((ws as any).stopAtPosition).toBe(4)
  })

  test('pauses and clamps time to the exact stop position when playback overshoots it', async () => {
    const ws = createWs()
    const media = ws.getMediaElement()
    Object.defineProperty(media, 'paused', { configurable: true, value: false })
    await ws.play(1, 2)

    // Simulate the clock overshooting the stop position between timer ticks
    media.currentTime = 2.013
    const timer = getTimer()
    const tick = timer.on.mock.calls.find(([event]: [string]) => event === 'tick')[1]
    tick()

    expect(media.pause).toHaveBeenCalled()
    expect(ws.getCurrentTime()).toBe(2)
  })

  test('playPause toggles play and pause', async () => {
    const ws = createWs()
    const media = ws.getMediaElement()
    await ws.playPause()
    expect(media.play).toHaveBeenCalled()
    Object.defineProperty(media, 'paused', { configurable: true, value: false })
    await ws.playPause()
    expect(media.pause).toHaveBeenCalled()
  })

  test('stop resets time', () => {
    const ws = createWs()
    ws.setTime(5)
    ws.stop()
    expect(ws.getCurrentTime()).toBe(0)
  })

  test('skip and empty', () => {
    const ws = createWs()
    ws.getMediaElement().currentTime = 1
    const spy = jest.spyOn(ws, 'setTime')
    ws.skip(2)
    expect(spy).toHaveBeenCalledWith(3)
    const loadSpy = jest.spyOn(ws, 'load').mockResolvedValue(undefined)
    ws.empty()
    expect(loadSpy).toHaveBeenCalledWith('', [[0]], 0.001)
  })

  test('setMediaElement reinitializes events', () => {
    const ws = createWs()
    const unsub = jest.spyOn(ws as any, 'unsubscribePlayerEvents')
    const init = jest.spyOn(ws as any, 'initPlayerEvents')
    const el = createMedia()
    ws.setMediaElement(el)
    expect(unsub).toHaveBeenCalled()
    expect(init).toHaveBeenCalled()
    expect(ws.getMediaElement()).toBe(el)
  })

  test('exportImage uses renderer', async () => {
    const ws = createWs()
    await ws.exportImage('image/png', 1, 'dataURL')
    expect(getRenderer().exportImage).toHaveBeenCalled()
  })

  test('destroy cleans up renderer and timer', () => {
    const ws = createWs()
    ws.destroy()
    expect(getRenderer().destroy).toHaveBeenCalled()
    expect(getTimer().destroy).toHaveBeenCalled()
  })

  test('does not emit pause or timeupdate during construction', async () => {
    // Record every event emitted (not just pause/timeupdate observed via a listener
    // attached after construction) so a synchronous emit during the constructor -
    // before any test code can call ws.on() - is actually caught.
    const emittedDuringConstruction: string[] = []
    const originalEmit = (WaveSurfer.prototype as any).emit
    ;(WaveSurfer.prototype as any).emit = function (this: WaveSurfer, event: string, ...args: unknown[]) {
      emittedDuringConstruction.push(event)
      return originalEmit.call(this, event, ...args)
    }

    let ws!: WaveSurfer
    try {
      ws = createWs()
      await Promise.resolve() // let the constructor's deferred init run
    } finally {
      ;(WaveSurfer.prototype as any).emit = originalEmit
    }

    expect(emittedDuringConstruction).not.toContain('pause')
    expect(emittedDuringConstruction).not.toContain('timeupdate')
    ws.destroy()
  })

  test('emits play exactly once per media play event', () => {
    const ws = createWs()
    const onPlay = jest.fn()
    ws.on('play', onPlay)
    ws.getMediaElement().dispatchEvent(new Event('play'))
    expect(onPlay).toHaveBeenCalledTimes(1)
    ws.destroy()
  })

  test('emits pause exactly once per media pause event', () => {
    const ws = createWs()
    const onPause = jest.fn()
    ws.on('pause', onPause)
    ws.getMediaElement().dispatchEvent(new Event('pause'))
    expect(onPause).toHaveBeenCalledTimes(1)
    ws.destroy()
  })

  test('emits seeking exactly once per media seeking event', () => {
    const ws = createWs()
    const onSeeking = jest.fn()
    ws.on('seeking', onSeeking)
    ws.getMediaElement().dispatchEvent(new Event('seeking'))
    expect(onSeeking).toHaveBeenCalledTimes(1)
    ws.destroy()
  })

  test('emits finish exactly once per media ended event', () => {
    const ws = createWs()
    const onFinish = jest.fn()
    ws.on('finish', onFinish)
    ws.getMediaElement().dispatchEvent(new Event('ended'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    ws.destroy()
  })

  test('emits timeupdate exactly once per media timeupdate event while paused', () => {
    // audioprocess is only driven by the 16ms timer during playback (see
    // initTimerEvents in wavesurfer.ts) - simulating a timer tick isn't worth it for
    // a doubled-emission regression test, so this only covers the imperative
    // onMediaEvent('timeupdate', ...) -> emit('timeupdate') path exercised here.
    const ws = createWs()
    const onTimeupdate = jest.fn()
    ws.on('timeupdate', onTimeupdate)
    ws.getMediaElement().dispatchEvent(new Event('timeupdate'))
    expect(onTimeupdate).toHaveBeenCalledTimes(1)
    ws.destroy()
  })

  test('reflects zoom and decoded audio in reactive state', async () => {
    const ws = createWs({
      peaks: [[0, 0.5, 1]],
      duration: 1,
    })
    await new Promise((resolve) => ws.once('ready', resolve))
    expect(ws.getState().audioBuffer.value).not.toBeNull()
    ws.zoom(123)
    expect(ws.getState().zoom.value).toBe(123)
    ws.destroy()
  })

  test('walks loadPhase through decoding→ready for a peaks+duration load', async () => {
    const ws = WaveSurfer.create({
      container: document.createElement('div'),
      peaks: [[0, 0.5, 1]],
      duration: 1,
    })
    const phases: string[] = []
    ws.getState().loadPhase.subscribe((p) => phases.push(p))
    await new Promise((resolve) => ws.once('ready', resolve))
    expect(ws.getState().loadPhase.value).toBe('ready')
    expect(phases).toContain('decoding')
    ws.destroy()
  })

  test('resets peaks state at the start of a load that provides no channelData', async () => {
    const ws = createWs({
      peaks: [[0, 0.5, 1]],
      duration: 1,
    })
    await new Promise((resolve) => ws.once('ready', resolve))
    expect(ws.getState().peaks.value).not.toBeNull()

    // The URL-only load can't complete in jsdom (no fetch polyfill/mock), but the
    // peaks reset happens synchronously at the top of loadAudio, before the first
    // await, so it's observable immediately without waiting for the load to settle.
    const loadPromise = ws.load('http://example.com/audio.mp3').catch(() => {})
    expect(ws.getState().peaks.value).toBeNull()

    await loadPromise
    ws.destroy()
  })

  test('getState() computeds keep reacting to signal writes after destroy -> reuse', async () => {
    // Regression test: destroy() used to register the wavesurfer-state `dispose`
    // callback on `this.scope`, so scope.dispose() permanently unsubscribed the
    // derived computeds (isPaused, canPlay, isReady, progress, progressPercent)
    // from their base signals. destroy() then recreates `this.scope` for the
    // (supported) destroy -> load() reuse pattern, but createWaveSurferState()
    // is only ever called once, in the constructor -- so the computeds were
    // never recreated and stayed frozen at their pre-destroy values forever.
    const media = createMedia()
    const container = document.createElement('div')
    const ws = WaveSurfer.create({ container, media, peaks: [[0, 0.5, 1]], duration: 1 })
    await new Promise((resolve) => ws.once('ready', resolve))

    ws.destroy()

    // Reusing an instance after destroy() is supported (see loadAudio's issue
    // #3637 comment / cypress/e2e/abort.cy.js). setMediaElement() re-registers
    // the media event listeners the same way a reused instance needs them
    // re-registered, then a real 'timeupdate' event drives the base
    // `currentTime` signal exactly as the browser would during playback.
    ws.setMediaElement(media)
    Object.defineProperty(media, 'currentTime', { configurable: true, value: 42, writable: true })
    media.dispatchEvent(new Event('timeupdate'))

    // The load-bearing assertion: this base-signal write must still propagate
    // to the derived `progress` computed. Before the fix this stayed frozen at
    // the pre-destroy value (0) because the computed had been disposed.
    expect(ws.getState().progress.value).toBe(42)

    ws.destroy()
  })

  describe('per-load Scope', () => {
    let originalFetch: typeof global.fetch

    beforeEach(() => {
      originalFetch = global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('starting a new load aborts the previous fetch via scope disposal', async () => {
      const ws = WaveSurfer.create({ container: document.createElement('div') })
      const seenSignals: AbortSignal[] = []
      global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => {
        seenSignals.push(init.signal as AbortSignal)
        return new Promise(() => undefined) // never resolves
      })
      ws.load('http://x/a.mp3').catch(() => undefined)
      await Promise.resolve()
      ws.load('http://x/b.mp3').catch(() => undefined)
      await Promise.resolve()
      expect(seenSignals[0].aborted).toBe(true)
      expect(seenSignals[1].aborted).toBe(false)
      ws.destroy()
      expect(seenSignals[1].aborted).toBe(true) // destroy cancels the in-flight load
    })

    it('a superseded load never applies its results', async () => {
      const ws = WaveSurfer.create({ container: document.createElement('div') })
      const onError = jest.fn()
      ws.on('error', onError)
      let resolveFirst: (b: Blob) => void
      const blob = new Blob([new ArrayBuffer(8)], { type: 'audio/wav' })
      global.fetch = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              resolveFirst = () =>
                res({
                  status: 200,
                  blob: () => Promise.resolve(blob),
                  clone: () => ({ body: null, headers: new Headers() }),
                  body: null,
                  headers: new Headers(),
                } as unknown as Response)
            }),
        )
        .mockImplementation(() => new Promise(() => undefined))
      ws.load('http://x/a.mp3').catch(() => undefined)
      await Promise.resolve()
      ws.load('http://x/b.mp3').catch(() => undefined) // supersedes
      resolveFirst!(blob)
      await new Promise((r) => setTimeout(r, 0))
      expect((ws as any).getSrc?.() ?? (ws.getMediaElement().src || '')).not.toContain('a.mp3')
      // A superseded load must never surface as a user-visible error -- its
      // rejection (if any) is filtered inside loadAudio via the loadScope.disposed
      // check, so load()'s catch never runs for it.
      expect(onError).not.toHaveBeenCalled()
      ws.destroy()
    })

    it('sets loadPhase=error when the fetch rejects', async () => {
      const ws = WaveSurfer.create({ container: document.createElement('div') })
      global.fetch = jest.fn().mockRejectedValue(new Error('network'))
      await expect(ws.load('http://x/a.mp3')).rejects.toThrow()
      expect(ws.getState().loadPhase.value).toBe('error')
      ws.destroy()
    })

    it('destroy() before ready rejects load() with AbortError and emits error, unlike a superseded load', async () => {
      // Contract pinned by cypress/e2e/abort.cy.js / issue #3637: destroying
      // mid-load must reject the load() promise and emit 'error' -- this is
      // different from supersession (a newer load() starting), which must be
      // swallowed silently. Both cases dispose loadScope, so the fix must
      // distinguish them by whether the *instance* (not just the load) was
      // torn down.
      global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => {
        const signal = init.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          const onAbort = () => reject(new DOMException('The user aborted a request.', 'AbortError'))
          if (signal.aborted) {
            onAbort()
          } else {
            signal.addEventListener('abort', onAbort, { once: true })
          }
        })
      })

      const ws = WaveSurfer.create({ container: document.createElement('div') })

      const loadPromise = ws.load('http://x/a.mp3')
      await Promise.resolve()
      ws.destroy()

      // destroy() clears all listeners (unAll()), same as the real
      // cypress/e2e/abort.cy.js "destroy before wavesurfer ready should emit
      // AbortError Exception" case -- it (re-)registers the 'error' listener
      // *after* destroy(), since reusing an instance post-destroy is
      // supported (#3637) and the delayed 'error' emit lands on a later tick.
      const onError = jest.fn()
      ws.on('error', onError)

      await expect(loadPromise).rejects.toThrow()
      await expect(loadPromise).rejects.toMatchObject({ name: 'AbortError' })
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0].name).toBe('AbortError')
      expect(ws.getState().loadPhase.value).toBe('error')
    })

    it('loadScope is a child of the current scope, replaced by each load, and cleared by destroy', async () => {
      const ws = WaveSurfer.create({ container: document.createElement('div') })
      global.fetch = jest.fn().mockImplementation(() => new Promise(() => undefined))

      ws.load('http://x/a.mp3').catch(() => undefined)
      await Promise.resolve()
      const firstLoadScope = (ws as any).loadScope
      expect(firstLoadScope).toBeTruthy()
      expect(firstLoadScope.disposed).toBe(false)

      ws.load('http://x/b.mp3').catch(() => undefined)
      await Promise.resolve()
      expect(firstLoadScope.disposed).toBe(true)
      const secondLoadScope = (ws as any).loadScope
      expect(secondLoadScope).not.toBe(firstLoadScope)
      expect(secondLoadScope.disposed).toBe(false)

      ws.destroy()
      expect(secondLoadScope.disposed).toBe(true)
      expect((ws as any).loadScope).toBeNull()

      // #3637: reusing an instance after destroy() is supported. A load()
      // after destroy() must derive its loadScope from the freshly recreated
      // this.scope, not the disposed one. If child() were called on the old
      // (still-disposed) scope, Scope.child() returns a pre-disposed child,
      // so this scope would come back `disposed === true` -- proving the
      // parentage, not just the null-check above.
      ws.load('http://x/c.mp3').catch(() => undefined)
      await Promise.resolve()
      expect((ws as any).loadScope.disposed).toBe(false)
      ws.destroy()
    })

    it('fetchParams option is copied per load so a superseded load does not poison the next fetch with an aborted signal', async () => {
      const userFetchParams: RequestInit = {}
      const ws = WaveSurfer.create({ container: document.createElement('div'), fetchParams: userFetchParams })
      const seenSignals: AbortSignal[] = []
      global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => {
        seenSignals.push(init.signal as AbortSignal)
        return new Promise(() => undefined) // never resolves
      })

      ws.load('http://x/a.mp3').catch(() => undefined)
      await Promise.resolve()
      ws.load('http://x/b.mp3').catch(() => undefined) // supersedes
      await Promise.resolve()

      expect(seenSignals).toHaveLength(2)
      // The user's own fetchParams object must never be mutated by wavesurfer.
      expect(userFetchParams.signal).toBeUndefined()
      // The second fetch must get its own, non-aborted signal -- not load 1's
      // (now-aborted) signal leaking through a shared/aliased fetchParams object.
      expect(seenSignals[1]).not.toBe(seenSignals[0])
      expect(seenSignals[1].aborted).toBe(false)

      ws.destroy()
    })
  })
})
