/**
 * Timeline Plugin
 * Displays time labels below the waveform
 */

import { createPlugin } from './create-plugin.js'
import { createElement } from '../dom.js'
import type { PluginContext } from './plugin.types.js'
import * as waveform from '../core/waveform.js'

export interface TimelinePluginOptions {
  /** Height of timeline in pixels */
  height?: number
  /** Format time labels */
  formatTimeCallback?: (seconds: number) => string
  /** Time interval between labels in seconds */
  timeInterval?: number
  /** Primary label color */
  primaryLabelColor?: string
  /** Secondary label color */
  secondaryLabelColor?: string
  /** Notch color */
  notchColor?: string
}

export const TimelinePlugin = createPlugin<TimelinePluginOptions>(
  {
    id: 'timeline',
    version: '1.0.0',
    description: 'Displays time labels and notches below the waveform',
  },
  (context, options = {}) => {
    const { store, resources, getWrapper, getDuration, getWidth } = context

    const height = options.height ?? 20
    const timeInterval = options.timeInterval ?? 5
    const primaryLabelColor = options.primaryLabelColor ?? '#000'
    const secondaryLabelColor = options.secondaryLabelColor ?? '#666'
    const notchColor = options.notchColor ?? '#ccc'

    // Default time formatter
    const formatTime =
      options.formatTimeCallback ||
      ((seconds: number): string => {
        const minutes = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${minutes}:${secs.toString().padStart(2, '0')}`
      })

    // Create timeline container
    const container = createContainer()

    /**
     * Create timeline container element
     */
    function createContainer(): HTMLElement {
      const wrapper = getWrapper()
      const timeline = createElement('div', {
        part: 'timeline',
        style: {
          position: 'relative',
          height: `${height}px`,
          width: '100%',
          overflow: 'hidden',
          borderTop: `1px solid ${notchColor}`,
        },
      })

      // Insert after wrapper
      wrapper.parentElement?.insertBefore(timeline, wrapper.nextSibling)

      resources.addCleanup(() => timeline.remove())

      return timeline
    }

    /**
     * Render timeline labels
     */
    function render(): void {
      const duration = getDuration()
      if (duration === 0) return

      // Clear existing content
      container.innerHTML = ''

      const width = getWidth()
      const pixelsPerSecond = width / duration

      // Calculate label interval
      let interval = timeInterval
      if (pixelsPerSecond < 10) {
        interval = timeInterval * 2
      }

      // Create labels
      let time = 0
      while (time <= duration) {
        const position = (time / duration) * 100

        // Create notch
        const notch = createElement('div', {
          style: {
            position: 'absolute',
            left: `${position}%`,
            top: '0',
            width: '1px',
            height: time % (interval * 2) === 0 ? '100%' : '50%',
            backgroundColor: notchColor,
          },
        })

        container.appendChild(notch)

        // Create label for major intervals
        if (time % (interval * 2) === 0) {
          const label = createElement(
            'div',
            {
              style: {
                position: 'absolute',
                left: `${position}%`,
                transform: 'translateX(-50%)',
                top: '2px',
                fontSize: '10px',
                color: time === 0 ? primaryLabelColor : secondaryLabelColor,
                whiteSpace: 'nowrap',
              },
            },
            container
          )
          label.textContent = formatTime(time)
        }

        time += interval
      }
    }

    // Subscribe to state changes that require re-render
    const sub = store
      .selectMany(
        (state) => state.audio.duration,
        (state) => state.view.minPxPerSec,
        (state) => state.view.containerWidth
      )
      .debounce(100)
      .subscribe(() => render())

    resources.add({ dispose: () => sub.unsubscribe() })

    // Initial render
    render()

    return {
      actions: {
        /** Force re-render timeline */
        render,
        /** Update timeline height */
        setHeight(newHeight: number) {
          container.style.height = `${newHeight}px`
        },
      },
    }
  }
)

export default TimelinePlugin
