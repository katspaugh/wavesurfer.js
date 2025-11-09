/**
 * Progress component for visualizing playback progress
 */

import { createComponent } from './component.js'
import { createElement } from '../dom.js'

export interface ProgressProps {
  /** Progress as percentage (0-1) */
  progress: number
  /** Progress bar color */
  color: string
  /** Progress bar height (CSS value) */
  height: string
}

/**
 * Create a progress bar component that shows playback progress
 *
 * The progress bar is an overlay that fills from left to right.
 * It updates automatically via reactive effects.
 *
 * @example
 * ```typescript
 * const progress = createProgressComponent()
 * const element = progress.render({
 *   progress: 0,
 *   color: 'rgba(255, 255, 255, 0.5)',
 *   height: '100%'
 * })
 *
 * // Later, update progress
 * progress.update?.({ progress: 0.5 })
 * ```
 */
export function createProgressComponent() {
  return createComponent<ProgressProps>(
    (props) => {
      // Inner div for proper overflow clipping
      const inner = createElement('div', {
        style: {
          position: 'relative',
        },
      })

      return createElement('div', {
        class: 'progress',
        style: {
          position: 'absolute',
          zIndex: '2',
          top: '0',
          left: '0',
          width: `${props.progress * 100}%`,
          height: props.height,
          overflow: 'hidden',
          pointerEvents: 'none',
          backgroundColor: props.color || '',
        },
        children: {
          inner,
        },
      })
    },
    (element, props) => {
      if (props.progress !== undefined) {
        element.style.width = `${props.progress * 100}%`
      }
      if (props.color !== undefined) {
        element.style.backgroundColor = props.color
      }
      if (props.height !== undefined) {
        element.style.height = props.height
      }
    },
  )
}
