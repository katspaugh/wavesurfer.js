/**
 * Media event bridge utilities
 *
 * Bridges HTMLMediaElement events to reactive state updates.
 * Provides a clean separation between imperative media API and reactive state.
 */

import type { WaveSurferActions } from '../state/wavesurfer-state.js'

/**
 * Bridge HTMLMediaElement events to WaveSurfer state actions
 *
 * This function sets up event listeners on a media element that automatically
 * update the reactive state through actions. It handles all standard media events
 * (play, pause, timeupdate, etc.) and keeps state in sync with media.
 *
 * @example
 * ```typescript
 * const { state, actions } = createWaveSurferState()
 * const media = document.createElement('audio')
 *
 * const cleanup = bridgeMediaEvents(media, actions)
 *
 * // Now media events automatically update state
 * media.play() // → actions.setPlaying(true)
 * ```
 *
 * @param media - HTMLMediaElement to listen to
 * @param actions - State actions to call on events
 * @returns Cleanup function that removes all listeners
 */
export function bridgeMediaEvents(media: HTMLMediaElement, actions: WaveSurferActions): () => void {
  const listeners: Array<() => void> = []

  // Helper to add event listener and track cleanup
  const addListener = <K extends keyof HTMLMediaElementEventMap>(
    event: K,
    handler: (e: HTMLMediaElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => {
    media.addEventListener(event, handler, options)
    listeners.push(() => media.removeEventListener(event, handler))
  }

  // ============================================================================
  // Playback State Events
  // ============================================================================

  addListener('play', () => {
    actions.setPlaying(true)
  })

  addListener('pause', () => {
    actions.setPlaying(false)
  })

  addListener('ended', () => {
    actions.setPlaying(false)
    // Set current time to duration on end
    if (media.duration) {
      actions.setCurrentTime(media.duration)
    }
  })

  // ============================================================================
  // Time and Duration Events
  // ============================================================================

  addListener('timeupdate', () => {
    actions.setCurrentTime(media.currentTime)
  })

  addListener('durationchange', () => {
    if (isFinite(media.duration)) {
      actions.setDuration(media.duration)
    }
  })

  addListener('loadedmetadata', () => {
    if (isFinite(media.duration)) {
      actions.setDuration(media.duration)
    }
  })

  // ============================================================================
  // Seeking Events
  // ============================================================================

  addListener('seeking', () => {
    actions.setSeeking(true)
  })

  addListener('seeked', () => {
    actions.setSeeking(false)
  })

  // ============================================================================
  // Volume Events
  // ============================================================================

  addListener('volumechange', () => {
    actions.setVolume(media.volume)
  })

  // ============================================================================
  // Playback Rate Events
  // ============================================================================

  addListener('ratechange', () => {
    actions.setPlaybackRate(media.playbackRate)
  })

  // Return cleanup function that removes all listeners
  return () => {
    listeners.forEach((cleanup) => cleanup())
  }
}

/**
 * Bridge HTMLMediaElement events with custom handler
 *
 * Similar to bridgeMediaEvents but allows custom state update logic.
 * Useful when you need more control over how events map to state.
 *
 * @example
 * ```typescript
 * const cleanup = bridgeMediaEventsWithHandler(media, (event, data) => {
 *   if (event === 'play') {
 *     actions.setPlaying(true)
 *     console.log('Started playing')
 *   }
 * })
 * ```
 *
 * @param media - HTMLMediaElement to listen to
 * @param handler - Custom handler function
 * @returns Cleanup function that removes all listeners
 */
export function bridgeMediaEventsWithHandler(
  media: HTMLMediaElement,
  handler: (event: string, data?: any) => void,
): () => void {
  const listeners: Array<() => void> = []

  const addListener = <K extends keyof HTMLMediaElementEventMap>(event: K) => {
    const listener = (e: HTMLMediaElementEventMap[K]) => {
      handler(event, e)
    }
    media.addEventListener(event, listener)
    listeners.push(() => media.removeEventListener(event, listener))
  }

  // Add all standard media events
  const events: Array<keyof HTMLMediaElementEventMap> = [
    'play',
    'pause',
    'ended',
    'timeupdate',
    'durationchange',
    'loadedmetadata',
    'seeking',
    'seeked',
    'volumechange',
    'ratechange',
    'waiting',
    'canplay',
    'canplaythrough',
    'loadstart',
    'progress',
    'suspend',
    'abort',
    'error',
    'emptied',
    'stalled',
    'loadeddata',
    'playing',
  ]

  events.forEach((event) => addListener(event))

  return () => {
    listeners.forEach((cleanup) => cleanup())
  }
}
