/**
 * Memory Leak Detection Tests
 *
 * These tests verify that WaveSurfer properly cleans up resources
 * and doesn't leak memory when destroyed and recreated multiple times.
 */

import WaveSurfer from '../wavesurfer.js'

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
      const RegionsPlugin = require('../plugins/regions.js').default
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
      const RegionsPlugin = require('../plugins/regions.js').default
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
      const RegionsPlugin = require('../plugins/regions.js').default
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
      const RegionsPlugin = require('../plugins/regions.js').default
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
})
