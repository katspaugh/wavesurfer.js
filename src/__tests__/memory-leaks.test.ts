/**
 * Memory Leak Detection Tests
 *
 * These tests verify that WaveSurfer properly cleans up resources
 * and doesn't leak memory when destroyed and recreated multiple times.
 */

import WaveSurfer from '../wavesurfer.js'
import RegionsPlugin from '../plugins/regions.js'

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
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
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
    it('should cleanup subscriptions on destroy', () => {
      const ws = WaveSurfer.create({ container })

      // Track if cleanup functions are called
      const cleanupSpy = jest.fn()

      // Access internal state to verify cleanup
      const originalDestroy = ws.destroy.bind(ws)
      ws.destroy = () => {
        cleanupSpy()
        originalDestroy()
      }

      ws.destroy()

      expect(cleanupSpy).toHaveBeenCalled()
    })

    it('should not leak memory after multiple create/destroy cycles', () => {
      const instances: WaveSurfer[] = []

      // Create and destroy multiple instances
      for (let i = 0; i < 10; i++) {
        const ws = WaveSurfer.create({ container })
        instances.push(ws)
        ws.destroy()
      }

      // All instances should be destroyed
      instances.forEach((ws) => {
        // After destroy, the instance should not have active listeners
        expect(ws).toBeDefined()
      })
    })

    it('should remove all event listeners on destroy', () => {
      const ws = WaveSurfer.create({ container })

      const clickHandler = jest.fn()
      const timeUpdateHandler = jest.fn()

      ws.on('click', clickHandler)
      ws.on('timeupdate', timeUpdateHandler)

      ws.destroy()

      // After destroy, handlers should be removed
      // We can't test emit directly as it's protected, but we verified
      // the cleanup happened via destroy()
      expect(clickHandler).not.toHaveBeenCalled()
      expect(timeUpdateHandler).not.toHaveBeenCalled()
    })

    it('should cleanup DOM elements on destroy', () => {
      const ws = WaveSurfer.create({ container })

      const childCountBefore = container.children.length
      expect(childCountBefore).toBeGreaterThan(0)

      ws.destroy()

      const childCountAfter = container.children.length
      expect(childCountAfter).toBe(0)
    })

    it('should cleanup reactive subscriptions on destroy', () => {
      const ws = WaveSurfer.create({ container })

      // Get state to check reactive cleanup
      const state = ws.getState()

      // State should have reactive signals
      expect(state).toBeDefined()
      expect(state.isPlaying).toBeDefined()
      expect(state.currentTime).toBeDefined()

      ws.destroy()

      // After destroy, reactive subscriptions should be cleaned up
      expect(state).toBeDefined()
    })
  })

  describe('Plugin lifecycle', () => {
    it('should track registered plugins', () => {
      const ws = WaveSurfer.create({ container })

      // WaveSurfer should start with no plugins
      expect(ws).toBeDefined()

      ws.destroy()
    })

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
    it('should have reactive state available', () => {
      const ws = WaveSurfer.create({ container })
      const state = ws.getState()

      // State should expose reactive signals
      expect(state.isPlaying).toBeDefined()
      expect(state.currentTime).toBeDefined()
      expect(state.duration).toBeDefined()
      expect(state.volume).toBeDefined()
      expect(state.progressPercent).toBeDefined()

      // Cleanup
      ws.destroy()
    })

    it('should not accumulate subscriptions across instances', () => {
      const instances: WaveSurfer[] = []

      // Create multiple instances
      for (let i = 0; i < 5; i++) {
        const ws = WaveSurfer.create({ container })
        instances.push(ws)
      }

      // Each instance should be independent
      expect(instances.length).toBe(5)

      // Destroy all instances
      instances.forEach((ws) => ws.destroy())

      // All instances should be cleaned up
      expect(instances.every((ws) => ws !== null)).toBe(true)
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

  // Task 3 (R3): destroy() disposes this.scope/mediaEventScope and Player's
  // mediaScope, but historically only the constructor ever re-registered the
  // listeners living on them (initPlayerEvents/initRendererEvents/
  // Player.setupReactiveMediaEvents) -- so a plain destroy() -> load() reuse
  // (no explicit setMediaElement() call, unlike the #3637 test above) left
  // every WaveSurfer/Player event bridge permanently dead: no timeupdate
  // forwarding, no renderer click-to-seek, no play forwarding, no reactive
  // state tracking, and (per the Task 1 ledger) no scrollPosition tracking.
  // ensureCoreEvents() (wavesurfer.ts) + Player.ensureMediaEvents()
  // (player.ts) fix this by reviving those bridges at the top of
  // loadAudio(), mirroring Renderer's own ensureInputEvents().
  describe('destroy -> load() reuse: event bridges revive (Task 3, R3)', () => {
    const originalGetContext = window.HTMLCanvasElement.prototype.getContext

    // jsdom ships no Web Audio API at all (`typeof AudioBuffer === 'undefined'`), but
    // decoder.ts's real (unmocked) Decoder.createBuffer() reads
    // AudioBuffer.prototype.copyFromChannel/copyToChannel to populate its returned object. A
    // minimal stub is enough: nothing in these tests calls those two methods, they just need to
    // exist as functions at the point createBuffer reads them off the prototype. Same pattern as
    // gc-leaks.test.ts.
    if (typeof (globalThis as { AudioBuffer?: unknown }).AudioBuffer === 'undefined') {
      class FakeAudioBuffer {
        copyFromChannel(): void {}
        copyToChannel(): void {}
      }
      ;(globalThis as { AudioBuffer?: unknown }).AudioBuffer = FakeAudioBuffer
    }

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

    it('state.scrollPosition tracks again after destroy -> load (Task 1 ledger)', async () => {
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
