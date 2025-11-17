/**
 * Cursor component for visualizing playback position
 */

import { createComponent } from './component.js'
import { createElement } from '../dom.js'

export interface CursorProps {
  /** Position as percentage (0-1) */
  position: number
  /** Cursor color */
  color: string
  /** Cursor width in pixels */
  width: number
  /** Cursor height (CSS value) */
  height: string
}

/**
 * Create a cursor component that shows playback position
 *
 * The cursor is a vertical line that moves across the waveform.
 * It updates automatically via reactive effects.
 *
 * @example
 * ```typescript
 * const cursor = createCursorComponent()
 * const element = cursor.render({
 *   position: 0,
 *   color: '#333',
 *   width: 2,
 *   height: '100%'
 * })
 *
 * // Later, update position
 * cursor.update?.({ position: 0.5 })
 * ```
 */
export function createCursorComponent() {
  return createComponent<CursorProps>(
    (props) => {
      return createElement('div', {
        class: 'cursor',
        style: {
          position: 'absolute',
          zIndex: '5',
          top: '0',
          left: `${props.position * 100}%`,
          transform: `translateX(-${props.width / 2}px)`,
          height: props.height,
          width: `${props.width}px`,
          backgroundColor: props.color,
          borderRadius: '2px',
          pointerEvents: 'none',
        },
      })
    },
    (element, props) => {
      if (props.position !== undefined) {
        element.style.left = `${props.position * 100}%`
      }
      if (props.color !== undefined) {
        element.style.backgroundColor = props.color
      }
      if (props.width !== undefined) {
        element.style.width = `${props.width}px`
        element.style.transform = `translateX(-${props.width / 2}px)`
      }
      if (props.height !== undefined) {
        element.style.height = props.height
      }
    },
  )
}
