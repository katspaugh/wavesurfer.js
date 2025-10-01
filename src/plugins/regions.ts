/**
 * Regions Plugin
 * Visual overlays and markers for regions of audio
 */

import { createPlugin } from './create-plugin.js'
import { BehaviorSubject } from '../streams/index.js'
import { createElement } from '../dom.js'
import { makeDraggable } from '../draggable.js'
import type { PluginContext } from './plugin.types.js'

export interface RegionParams {
  id?: string
  start: number
  end?: number
  color?: string
  drag?: boolean
  resize?: boolean
  content?: string | HTMLElement
}

export interface Region {
  id: string
  start: number
  end: number
  color: string
  drag: boolean
  resize: boolean
  element: HTMLElement | null
  remove(): void
  update(params: Partial<RegionParams>): void
  play(): void
}

interface RegionsPluginOptions {
  dragSelection?: boolean
}

export const RegionsPlugin = createPlugin<RegionsPluginOptions>(
  {
    id: 'regions',
    version: '1.0.0',
    description: 'Visual overlays and markers for regions of audio',
  },
  (context, options) => {
    const { store, resources, getWrapper, getDuration } = context

    // State
    const regionsSubject = new BehaviorSubject<Region[]>([])
    const regionsContainer = initRegionsContainer(getWrapper())

    // Track regions
    let regions: Region[] = []

    /**
     * Create regions container
     */
    function initRegionsContainer(wrapper: HTMLElement): HTMLElement {
      const container = createElement('div', {
        part: 'regions-container',
        style: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          zIndex: '5',
          pointerEvents: 'none',
        },
      })

      wrapper.appendChild(container)
      resources.addCleanup(() => container.remove())

      return container
    }

    /**
     * Create a region element
     */
    function createRegionElement(region: Region): HTMLElement {
      const isMarker = region.start === region.end
      const element = createElement('div', {
        part: `region ${region.id}`,
        style: {
          position: 'absolute',
          top: '0',
          height: '100%',
          backgroundColor: isMarker ? 'none' : region.color,
          borderLeft: isMarker ? `2px solid ${region.color}` : 'none',
          borderRadius: '2px',
          boxSizing: 'border-box',
          cursor: region.drag ? 'grab' : 'default',
          pointerEvents: 'all',
        },
      })

      updateRegionPosition(element, region)

      // Add to container
      regionsContainer.appendChild(element)

      return element
    }

    /**
     * Update region position
     */
    function updateRegionPosition(element: HTMLElement, region: Region): void {
      const duration = getDuration()
      if (duration === 0) return

      const start = (region.start / duration) * 100
      const end = ((duration - region.end) / duration) * 100

      element.style.left = `${start}%`
      element.style.right = `${end}%`
    }

    /**
     * Add a region
     */
    function addRegion(params: RegionParams): Region {
      const duration = getDuration()

      const region: Region = {
        id: params.id || `region-${Math.random().toString(32).slice(2)}`,
        start: Math.max(0, Math.min(params.start, duration)),
        end: Math.max(0, Math.min(params.end ?? params.start, duration)),
        color: params.color || 'rgba(0, 0, 0, 0.1)',
        drag: params.drag ?? true,
        resize: params.resize ?? true,
        element: null,

        remove() {
          const index = regions.indexOf(region)
          if (index > -1) {
            regions.splice(index, 1)
            if (region.element) {
              region.element.remove()
              region.element = null
            }
            regionsSubject.next([...regions])
          }
        },

        update(params: Partial<RegionParams>) {
          if (params.start !== undefined) {
            region.start = Math.max(0, Math.min(params.start, duration))
          }
          if (params.end !== undefined) {
            region.end = Math.max(0, Math.min(params.end, duration))
          }
          if (params.color !== undefined) {
            region.color = params.color
            if (region.element) {
              region.element.style.backgroundColor = params.color
            }
          }
          if (region.element) {
            updateRegionPosition(region.element, region)
          }
          regionsSubject.next([...regions])
        },

        play() {
          // Emit event to play from region start
          store.update((state) => ({
            ...state,
            playback: {
              ...state.playback,
              currentTime: region.start,
              isPlaying: true,
            },
          }))
        },
      }

      // Create element
      region.element = createRegionElement(region)

      // Add to list
      regions.push(region)
      regionsSubject.next([...regions])

      return region
    }

    /**
     * Get all regions
     */
    function getRegions(): Region[] {
      return [...regions]
    }

    /**
     * Clear all regions
     */
    function clearRegions(): void {
      regions.forEach((region) => region.remove())
      regions = []
      regionsSubject.next([])
    }

    /**
     * Get region by ID
     */
    function getRegion(id: string): Region | undefined {
      return regions.find((r) => r.id === id)
    }

    // Subscribe to duration changes to update region positions
    const durationSub = store
      .select((state) => state.audio.duration)
      .subscribe((duration) => {
        if (duration > 0) {
          regions.forEach((region) => {
            if (region.element) {
              updateRegionPosition(region.element, region)
            }
          })
        }
      })

    resources.add({ dispose: () => durationSub.unsubscribe() })

    return {
      streams: {
        regions: regionsSubject,
      },
      actions: {
        addRegion,
        getRegions,
        clearRegions,
        getRegion,
      },
    }
  }
)

export default RegionsPlugin
