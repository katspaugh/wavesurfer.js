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

      const media = ws.getMediaElement()!
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
    it('root scope is disposed on destroy and stays disposed (terminal destroy)', () => {
      const ws = WaveSurfer.create({ container: document.createElement('div') })
      const originalScope = (ws as any).scope

      ws.destroy()

      // The scope is disposed and NOT replaced: destroy() is terminal, so a
      // late registration runs (and is released) immediately -- nothing can
      // leak past destroy.
      expect(originalScope.disposed).toBe(true)
      const late = jest.fn()
      originalScope.add(late)
      expect(late).toHaveBeenCalledTimes(1)
      expect((ws as any).scope).toBe(originalScope)
    })

    it('setMediaElement after destroy is a no-op (no listeners attach to the new element)', () => {
      const ws = WaveSurfer.create({ container })
      const originalMedia = ws.getMediaElement()
      ws.destroy()

      const newMedia = document.createElement('audio')
      ws.setMediaElement(newMedia)

      // Terminal destroy: the element is not swapped in and no bridge revives
      expect(ws.getMediaElement()).toBe(originalMedia)

      const timeupdateHandler = jest.fn()
      ws.on('timeupdate', timeupdateHandler)
      Object.defineProperty(newMedia, 'currentTime', { value: 5, configurable: true })
      newMedia.dispatchEvent(new Event('timeupdate'))

      expect(timeupdateHandler).not.toHaveBeenCalled()
    })
  })

  // destroy() is terminal (v8): the event bridges are torn down once and
  // never revived. Post-destroy load() rejects catchably (the v7 record
  // plugin's async MediaRecorder onstop could reach load() after the app
  // destroyed the instance -- see issue #3637 -- so this must be a rejection,
  // not a synchronous throw), and media/renderer events no longer reach
  // listeners. Reuse means creating a new instance.
  describe('terminal destroy()', () => {
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
    const createDestroyedWs = async () => {
      const ws = WaveSurfer.create({ container })
      await ws.load('', [[0, 0.5, 1]], 1)
      ws.destroy()
      return ws
    }

    it('load() after destroy rejects catchably and emits error', async () => {
      const ws = await createDestroyedWs()
      const onError = jest.fn()
      ws.on('error', onError)

      await expect(ws.load('', [[0, 0.5, 1]], 1)).rejects.toThrow(/destroyed/)
      // 'error' listeners registered post-destroy still receive the failure
      // (destroy's unAll ran before this listener was added)
      expect(onError).toHaveBeenCalled()
    })

    it('media events no longer reach listeners after destroy', async () => {
      const ws = await createDestroyedWs()
      const onTimeupdate = jest.fn()
      const onPlay = jest.fn()
      ws.on('timeupdate', onTimeupdate)
      ws.on('play', onPlay)

      const media = ws.getMediaElement()!
      Object.defineProperty(media, 'currentTime', { configurable: true, value: 7 })
      media.dispatchEvent(new Event('timeupdate'))
      media.dispatchEvent(new Event('play'))

      expect(onTimeupdate).not.toHaveBeenCalled()
      expect(onPlay).not.toHaveBeenCalled()
    })

    it('renderer signals no longer reach the seek bridge after destroy', async () => {
      const ws = await createDestroyedWs()
      const setTimeSpy = jest.spyOn(ws, 'setTime')

      const renderer = ws.getRenderer()
      // Drive the private writable behind the public clickSignal directly --
      // the bridge subscription was severed by destroy(), so nothing fires.
      ;(renderer as any)._clickSignal.set({ relativeX: 0.5, relativeY: 0.5 })

      expect(setTimeSpy).not.toHaveBeenCalled()
    })

    it('destroy() synchronously after create() is not resurrected by the deferred auto-load', async () => {
      const onReady = jest.fn()
      const onInit = jest.fn()
      // peaks + duration would normally trigger the constructor's deferred load
      const ws = WaveSurfer.create({ container, peaks: [[0, 0.5, 1]], duration: 1 })
      ws.on('ready', onReady)
      ws.on('init', onInit)
      ws.destroy()

      // Let the constructor's Promise.resolve().then(...) microtask run
      await Promise.resolve()
      await Promise.resolve()
      await new Promise((r) => setTimeout(r, 0))

      expect(onInit).not.toHaveBeenCalled()
      expect(onReady).not.toHaveBeenCalled()
    })

    it('destroy() is idempotent and emits destroy exactly once', async () => {
      const ws = WaveSurfer.create({ container })
      const onDestroy = jest.fn()
      ws.on('destroy', onDestroy)
      ws.destroy()
      ws.destroy()
      expect(onDestroy).toHaveBeenCalledTimes(1)
    })

    it('destroy() releases the decoded audio buffer', async () => {
      const ws = WaveSurfer.create({ container })
      await ws.load('', [[0, 0.5, 1]], 1)
      expect(ws.getDecodedData()).not.toBeNull()
      ws.destroy()
      expect(ws.getDecodedData()).toBeNull()
    })
  })
})
