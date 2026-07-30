/**
 * Memory Leak Detection Tests
 *
 * These tests verify that WaveSurfer properly cleans up resources
 * and doesn't leak memory when destroyed and recreated multiple times.
 */

import WaveSurfer from '../wavesurfer.js'
import RegionsPlugin from '../plugins/regions.js'
import { installMatchMediaStub } from './helpers/match-media.js'
import { ensureGlobalAudioBufferStub } from './helpers/audio-buffer.js'

// Mock audio context and matchMedia
beforeAll(() => {
  global.AudioContext = jest.fn().mockImplementation(() => ({
    createMediaElementSource: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createGain: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      gain: { value: 1, setValueAtTime: jest.fn() },
    })),
    destination: {},
    close: jest.fn(),
  }))

  // Mock matchMedia for drag-stream
  installMatchMediaStub()
})

describe('Memory Leak Detection', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'waveform'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('WaveSurfer lifecycle', () => {
    // REPLACES a "should cleanup subscriptions on destroy" case that monkey-patched ws.destroy
    // with a spy, called the patched version, and then asserted the spy it had just installed on
    // itself was called - true regardless of what destroy() actually does. The "Scope ownership
    // tree" describe block below already covers the real invariant (root scope disposed on
    // destroy) with an observable that would actually fail if destroy() broke.

    it('disposes every instance across repeated create/destroy cycles, not just the last one', () => {
      // REPLACES a version of this case that asserted `expect(ws).toBeDefined()` per instance -
      // always true, since `ws` is a local reference that stays a WaveSurfer object regardless of
      // whether destroy() did anything. Scope.disposed is the real, observable contract of
      // destroy(): each of the 10 create/destroy cycles below must actually dispose its own scope.
      const scopes: { disposed: boolean }[] = []

      for (let i = 0; i < 10; i++) {
        const ws = WaveSurfer.create({ container })
        scopes.push((ws as any).scope)
        ws.destroy()
      }

      scopes.forEach((scope) => expect(scope.disposed).toBe(true))
    })

    it('removes all event listeners on destroy', () => {
      // REPLACES a version of this case that registered handlers but never emitted the events
      // they listened for even before destroy() ran - "not called" held trivially regardless of
      // whether destroy() cleans anything up. This drives the real teardown path instead:
      // Player.destroy() -> EventEmitter.unAll() replaces `this.listeners` wholesale, so a
      // listener actually registered beforehand must be gone afterward.
      const ws = WaveSurfer.create({ container })

      ws.on('click', jest.fn())
      ws.on('timeupdate', jest.fn())

      expect((ws as any).listeners.click.size).toBe(1)
      expect((ws as any).listeners.timeupdate.size).toBe(1)

      ws.destroy()

      expect((ws as any).listeners.click).toBeUndefined()
      expect((ws as any).listeners.timeupdate).toBeUndefined()
    })

    it('should cleanup DOM elements on destroy', () => {
      const ws = WaveSurfer.create({ container })

      const childCountBefore = container.children.length
      expect(childCountBefore).toBeGreaterThan(0)

      ws.destroy()

      const childCountAfter = container.children.length
      expect(childCountAfter).toBe(0)
    })

    it('stops tracking media events in reactive state after destroy', () => {
      // REPLACES a version of this case that only asserted state/state.isPlaying/state.currentTime
      // were `toBeDefined()` before AND after destroy() - true unconditionally, since getState()
      // always returns the same signal objects regardless of whether their underlying reactive
      // bridge is still wired up. This drives an actual media event through both before and after
      // destroy() and checks whether `currentTime` really does (and then really doesn't) track it.
      const ws = WaveSurfer.create({ container })
      const state = ws.getState()

      const media = ws.getMediaElement()
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 3 })
      media.dispatchEvent(new Event('timeupdate'))
      expect(state.currentTime.value).toBe(3)

      ws.destroy()

      // Player.destroy() disposes mediaScope, tearing down the reactive bridge - a timeupdate
      // dispatched afterward must not still be wired up to state.
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 9 })
      media.dispatchEvent(new Event('timeupdate'))
      expect(state.currentTime.value).toBe(3)
    })
  })

  describe('Plugin lifecycle', () => {
    it('should remove plugin elements from DOM on destroy', () => {
      WaveSurfer.create({ container })

      // Mock a plugin that adds DOM elements
      const pluginElement = document.createElement('div')
      pluginElement.className = 'test-plugin'
      container.appendChild(pluginElement)

      const elementCountBefore = container.querySelectorAll('.test-plugin').length
      expect(elementCountBefore).toBe(1)

      // Plugin should cleanup its elements
      pluginElement.remove()

      const elementCountAfter = container.querySelectorAll('.test-plugin').length
      expect(elementCountAfter).toBe(0)
    })
  })

  describe('Regions plugin memory leak (#4243)', () => {
    it('should cleanup region event listeners when removed', () => {
      const ws = WaveSurfer.create({ container })
      const regions = ws.registerPlugin(RegionsPlugin.create())

      // Mock duration so regions are saved immediately
      jest.spyOn(ws, 'getDuration').mockReturnValue(10)
      jest.spyOn(ws, 'getDecodedData').mockReturnValue({ numberOfChannels: 1 } as any)

      // Create a region
      const region = regions.addRegion({ start: 0, end: 1 })

      // Track if cleanup is happening
      const clickHandler = jest.fn()
      region.on('click', clickHandler)

      // Remove the region
      region.remove()

      // After removal, the region element should be null
      expect(region.element).toBeNull()

      // Cleanup
      ws.destroy()
    })

    it('should not retain regions in memory after removal', () => {
      const ws = WaveSurfer.create({ container })
      const regions = ws.registerPlugin(RegionsPlugin.create())

      // Mock duration so regions are saved immediately
      jest.spyOn(ws, 'getDuration').mockReturnValue(10)
      jest.spyOn(ws, 'getDecodedData').mockReturnValue({ numberOfChannels: 1 } as any)

      // Create multiple regions
      const region1 = regions.addRegion({ start: 0, end: 1 })
      const region2 = regions.addRegion({ start: 2, end: 3 })
      const region3 = regions.addRegion({ start: 4, end: 5 })

      expect(regions.getRegions().length).toBe(3)

      // Remove regions
      region1.remove()
      region2.remove()

      // Only one region should remain
      expect(regions.getRegions().length).toBe(1)
      expect(regions.getRegions()[0]).toBe(region3)

      // Remove last region
      region3.remove()
      expect(regions.getRegions().length).toBe(0)

      // Cleanup
      ws.destroy()
    })

    it('should cleanup content event listeners when region is removed', () => {
      const ws = WaveSurfer.create({ container })
      const regions = ws.registerPlugin(RegionsPlugin.create())

      // Mock duration so regions are saved immediately
      jest.spyOn(ws, 'getDuration').mockReturnValue(10)
      jest.spyOn(ws, 'getDecodedData').mockReturnValue({ numberOfChannels: 1 } as any)

      // Create a region with editable content
      const region = regions.addRegion({
        start: 0,
        end: 1,
        content: 'Test content',
        contentEditable: true,
      })

      // Remove the region
      region.remove()

      // Content should be cleaned up
      expect(region.element).toBeNull()

      // Cleanup
      ws.destroy()
    })

    it('should cleanup DOM event streams on region removal', () => {
      const ws = WaveSurfer.create({ container })
      const regions = ws.registerPlugin(RegionsPlugin.create())

      // Mock duration so regions are saved immediately
      jest.spyOn(ws, 'getDuration').mockReturnValue(10)
      jest.spyOn(ws, 'getDecodedData').mockReturnValue({ numberOfChannels: 1 } as any)

      // Create regions
      const createdRegions = []
      for (let i = 0; i < 10; i++) {
        createdRegions.push(regions.addRegion({ start: i, end: i + 1 }))
      }

      expect(regions.getRegions().length).toBe(10)

      // Remove all regions
      createdRegions.forEach((r) => r.remove())

      // All regions should be removed
      expect(regions.getRegions().length).toBe(0)

      // Cleanup
      ws.destroy()
    })
  })

  describe('Event listener cleanup', () => {
    it('should properly cleanup on destroy', () => {
      const ws = WaveSurfer.create({ container })

      // Get renderer to ensure it's initialized
      const renderer = ws.getRenderer()
      expect(renderer).toBeDefined()

      // Should not throw during destroy
      expect(() => {
        ws.destroy()
      }).not.toThrow()
    })
  })

  describe('Reactive system cleanup', () => {
    // REPLACES a "should have reactive state available" case that only asserted
    // `toBeDefined()` on state.isPlaying/currentTime/duration/volume/progressPercent before AND
    // after destroy() - getState() always returns the same signal objects regardless of destroy,
    // so this held unconditionally. Superseded by the "destroy -> load() reuse" describe block
    // below, which drives real media events through state both before AND after a destroy/reuse
    // cycle and asserts on the actual VALUE tracked (see "reactive state signals track again
    // after destroy -> load" and "stops tracking media events in reactive state after destroy"
    // above), rather than merely that the signal reference exists.

    it('keeps instances independent: destroying one does not dispose another', () => {
      // REPLACES a version of this case that asserted `instances.every((ws) => ws !== null)` -
      // always true, since none of the array elements were ever null; it didn't touch
      // "accumulate subscriptions" at all. Scope.disposed is the real, per-instance observable:
      // destroying a subset must not affect the others' scopes.
      const instances = Array.from({ length: 5 }, () => WaveSurfer.create({ container }))
      // Capture each instance's scope BEFORE destroying any of them: destroy() disposes the
      // CURRENT scope and then replaces it with a fresh, non-disposed one (to support post-destroy
      // reuse - see the "Scope ownership tree" describe block above), so `(ws as any).scope` read
      // AFTER destroy() would be the new scope, not the one destroy() actually disposed.
      const scopes = instances.map((ws) => (ws as any).scope)

      instances[0].destroy()
      instances[2].destroy()

      expect(scopes[0].disposed).toBe(true)
      expect(scopes[2].disposed).toBe(true)
      expect(scopes[1].disposed).toBe(false)
      expect(scopes[3].disposed).toBe(false)
      expect(scopes[4].disposed).toBe(false)

      instances.forEach((ws) => ws.destroy())
      scopes.forEach((scope) => expect(scope.disposed).toBe(true))
    })
  })

  describe('Edge cases', () => {
    it('should handle destroy called multiple times', () => {
      const ws = WaveSurfer.create({ container })

      // Should not throw when destroyed multiple times
      expect(() => {
        ws.destroy()
        ws.destroy()
        ws.destroy()
      }).not.toThrow()
    })

    it('should handle destroy without initialization', () => {
      const ws = WaveSurfer.create({ container })

      // Destroy immediately without loading audio
      expect(() => {
        ws.destroy()
      }).not.toThrow()
    })

    it('should cleanup even if events are subscribed during destroy', () => {
      const ws = WaveSurfer.create({ container })

      // Subscribe to destroy event
      const destroyHandler = jest.fn()
      ws.on('destroy', destroyHandler)

      ws.destroy()

      // Destroy handler should have been called
      expect(destroyHandler).toHaveBeenCalled()
    })
  })

  describe('Scope ownership tree', () => {
    it('root scope is disposed on destroy and a fresh scope replaces it for reuse', () => {
      const ws = WaveSurfer.create({ container: document.createElement('div') })
      // Capture the scope reference BEFORE destroy: destroy() must recreate
      // `this.scope` afterwards so a subsequent load() can still register
      // cleanups (a disposed Scope runs late registrations immediately, see
      // issue #3637 / the loadAudio re-entrancy comment).
      const originalScope = (ws as any).scope

      ws.destroy()

      expect(originalScope.disposed).toBe(true)
      const late = jest.fn()
      originalScope.add(late)
      expect(late).toHaveBeenCalledTimes(1)

      // A fresh, non-disposed scope must be in place for reuse.
      const freshScope = (ws as any).scope
      expect(freshScope).not.toBe(originalScope)
      expect(freshScope.disposed).toBe(false)
    })

    it('media event listeners registered after destroy still fire (issue #3637 reuse)', () => {
      const ws = WaveSurfer.create({ container })
      ws.destroy()

      // Reuse the instance: attach a new media element after destroy, as
      // load() after destroy() is a supported flow.
      const newMedia = document.createElement('audio')
      ws.setMediaElement(newMedia)

      const timeupdateHandler = jest.fn()
      ws.on('timeupdate', timeupdateHandler)

      Object.defineProperty(newMedia, 'currentTime', { value: 5, configurable: true })
      newMedia.dispatchEvent(new Event('timeupdate'))

      expect(timeupdateHandler).toHaveBeenCalledWith(5)
    })
  })

  // destroy() disposes this.scope/mediaEventScope and Player's mediaScope,
  // but historically only the constructor ever re-registered the listeners
  // living on them (initPlayerEvents/initRendererEvents/
  // Player.setupReactiveMediaEvents) -- so a plain destroy() -> load() reuse
  // (no explicit setMediaElement() call, unlike the #3637 test above) left
  // every WaveSurfer/Player event bridge permanently dead: no timeupdate
  // forwarding, no renderer click-to-seek, no play forwarding, no reactive
  // state tracking, and no scrollPosition tracking.
  // ensureCoreEvents() (wavesurfer.ts) + Player.ensureMediaEvents()
  // (player.ts) fix this by reviving those bridges at the top of
  // loadAudio(), mirroring Renderer's own ensureInputEvents().
  describe('destroy -> load() reuse: event bridges revive', () => {
    const originalGetContext = window.HTMLCanvasElement.prototype.getContext

    // jsdom ships no Web Audio API at all (`typeof AudioBuffer === 'undefined'`), but
    // decoder.ts's real (unmocked) Decoder.createBuffer() reads
    // AudioBuffer.prototype.copyFromChannel/copyToChannel to populate its returned object. A
    // minimal stub is enough: nothing in these tests calls those two methods, they just need to
    // exist as functions at the point createBuffer reads them off the prototype. Same pattern as
    // gc-leaks.test.ts.
    ensureGlobalAudioBufferStub()

    beforeAll(() => {
      // Renderer.render() is real here (unlike wavesurfer.test.ts, which
      // mocks Renderer entirely) -- jsdom has no canvas backend, so its
      // 2D context calls need a minimal stub to avoid throwing.
      window.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
        beginPath: jest.fn(),
        rect: jest.fn(),
        roundRect: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        fill: jest.fn(),
        drawImage: jest.fn(),
        fillRect: jest.fn(),
        createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
        globalCompositeOperation: '',
        canvas: { width: 100, height: 100 },
      })) as any
    })

    afterAll(() => {
      window.HTMLCanvasElement.prototype.getContext = originalGetContext
    })

    // No peaks/duration in the create() options -- the constructor's
    // deferred auto-load only fires when initialUrl || (peaks && duration)
    // is truthy, so passing neither here means the only loads that happen
    // are the explicit ones below, avoiding a race with that internal
    // Promise.resolve().then(...).
    const createReusedWs = async () => {
      const ws = WaveSurfer.create({ container })
      await ws.load('', [[0, 0.5, 1]], 1)
      ws.destroy()
      await ws.load('', [[0, 0.5, 1]], 1)
      return ws
    }

    it('timeupdate flows on media event after destroy -> load', async () => {
      const ws = await createReusedWs()
      const onTimeupdate = jest.fn()
      ws.on('timeupdate', onTimeupdate)

      const media = ws.getMediaElement()
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 7 })
      media.dispatchEvent(new Event('timeupdate'))

      expect(onTimeupdate).toHaveBeenCalledWith(7)
      ws.destroy()
    })

    it('renderer click seeks after destroy -> load', async () => {
      const ws = await createReusedWs()
      const setTimeSpy = jest.spyOn(ws, 'setTime')

      // Drive the bridge directly via the Renderer's own event emitter
      // (real, unmocked, in this file) rather than a raw DOM click -- this
      // isolates WaveSurfer's own click -> seekTo bridge (initRendererEvents,
      // registered on this.scope) from Renderer's separate internal
      // DOM-listener revival (ensureInputEvents, already covered elsewhere).
      const renderer = ws.getRenderer()
      ;(renderer as any).emit('click', 0.5, 0.5)

      expect(setTimeSpy).toHaveBeenCalled()
      ws.destroy()
    })

    it('play event forwards after destroy -> load', async () => {
      const ws = await createReusedWs()
      const onPlay = jest.fn()
      ws.on('play', onPlay)

      ws.getMediaElement().dispatchEvent(new Event('play'))

      expect(onPlay).toHaveBeenCalledTimes(1)
      ws.destroy()
    })

    it('reactive state signals track again after destroy -> load', async () => {
      const ws = await createReusedWs()

      const media = ws.getMediaElement()
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 9 })
      media.dispatchEvent(new Event('timeupdate'))

      expect(ws.getState().currentTime.value).toBe(9)
      ws.destroy()
    })

    it('state.scrollPosition tracks again after destroy -> load', async () => {
      const ws = await createReusedWs()
      jest.spyOn(ws, 'getDuration').mockReturnValue(100)

      expect(ws.getState().scrollPosition.value).toBe(0)

      const renderer = ws.getRenderer()
      ;(renderer as any).emit('scroll', 0.2, 0.4, 200, 400)

      expect(ws.getState().scrollPosition.value).toBe(200)
      ws.destroy()
    })
  })
})
