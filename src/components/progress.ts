/**
 * Progress component for visualizing playback progress
 */

import { createComponent } from './component.js'

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
      const wrapper = document.createElement('div')
      wrapper.className = 'progress'
      wrapper.style.position = 'absolute'
      wrapper.style.zIndex = '2'
      wrapper.style.top = '0'
      wrapper.style.left = '0'
      wrapper.style.width = `${props.progress * 100}%`
      wrapper.style.height = props.height
      wrapper.style.overflow = 'hidden'
      wrapper.style.pointerEvents = 'none'

      // Inner div for proper overflow clipping
      const inner = document.createElement('div')
      inner.style.position = 'relative'
      wrapper.appendChild(inner)

      // Set background color on wrapper, not inner
      if (props.color) {
        wrapper.style.backgroundColor = props.color
      }

      return wrapper
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
