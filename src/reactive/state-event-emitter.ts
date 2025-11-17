/**
 * State-driven event emission utilities
 *
 * Automatically emit events when reactive state changes.
 * Ensures events are always in sync with state and removes manual emit() calls.
 */

import { effect, type Signal } from './store.js'
import type { WaveSurferState } from '../state/wavesurfer-state.js'

export type EventEmitter = {
  emit(event: string, ...args: any[]): void
}

/**
 * Setup automatic event emission from state changes
 *
 * This function subscribes to all relevant state signals and automatically
 * emits corresponding events when state changes. This ensures:
 * - Events are always in sync with state
 * - No manual emit() calls needed
 * - Can't forget to emit an event
 * - Clear event sources (state changes)
 *
 * @example
 * ```typescript
 * const { state } = createWaveSurferState()
 * const wavesurfer = new WaveSurfer()
 *
 * const cleanup = setupStateEventEmission(state, wavesurfer)
 *
 * // Now state changes automatically emit events
 * state.isPlaying.set(true) // → wavesurfer.emit('play')
 * ```
 *
 * @param state - Reactive state to observe
 * @param emitter - Event emitter to emit events on
 * @returns Cleanup function that removes all subscriptions
 */
export function setupStateEventEmission(state: WaveSurferState, emitter: EventEmitter): () => void {
  const cleanups: Array<() => void> = []

  // ============================================================================
  // Play/Pause Events
  // ============================================================================

  // Emit play/pause events when playing state changes
  cleanups.push(
    effect(() => {
      const isPlaying = state.isPlaying.value
      emitter.emit(isPlaying ? 'play' : 'pause')
    }, [state.isPlaying]),
  )

  // ============================================================================
  // Time Update Events
  // ============================================================================

  // Emit timeupdate when current time changes
  cleanups.push(
    effect(() => {
      const currentTime = state.currentTime.value
      emitter.emit('timeupdate', currentTime)

      // Also emit audioprocess when playing
      if (state.isPlaying.value) {
        emitter.emit('audioprocess', currentTime)
      }
    }, [state.currentTime, state.isPlaying]),
  )

  // ============================================================================
  // Seeking Events
  // ============================================================================

  // Emit seeking event when seeking state changes to true
  cleanups.push(
    effect(() => {
      const isSeeking = state.isSeeking.value
      if (isSeeking) {
        emitter.emit('seeking', state.currentTime.value)
      }
    }, [state.isSeeking, state.currentTime]),
  )

  // ============================================================================
  // Ready Event
  // ============================================================================

  // Emit ready when state becomes ready
  let wasReady = false
  cleanups.push(
    effect(() => {
      const isReady = state.isReady.value
      if (isReady && !wasReady) {
        wasReady = true
        emitter.emit('ready', state.duration.value)
      }
    }, [state.isReady, state.duration]),
  )

  // ============================================================================
  // Finish Event
  // ============================================================================

  // Emit finish when playback ends (reached duration and stopped)
  let wasPlayingAtEnd = false
  cleanups.push(
    effect(() => {
      const isPlaying = state.isPlaying.value
      const currentTime = state.currentTime.value
      const duration = state.duration.value

      // Check if we're at the end
      const isAtEnd = duration > 0 && currentTime >= duration

      // Emit finish when we were playing at end and now stopped
      if (wasPlayingAtEnd && !isPlaying && isAtEnd) {
        emitter.emit('finish')
      }

      // Track if we're playing at the end
      wasPlayingAtEnd = isPlaying && isAtEnd
    }, [state.isPlaying, state.currentTime, state.duration]),
  )

  // ============================================================================
  // Zoom Events
  // ============================================================================

  // Emit zoom when zoom level changes
  cleanups.push(
    effect(() => {
      const zoom = state.zoom.value
      if (zoom > 0) {
        emitter.emit('zoom', zoom)
      }
    }, [state.zoom]),
  )

  // Return cleanup function
  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}

/**
 * Setup custom event emission from signal changes
 *
 * This is a lower-level utility for setting up custom event emission
 * from any signal. Useful when you need more control over event emission logic.
 *
 * @example
 * ```typescript
 * const volumeSignal = signal(1)
 *
 * const cleanup = setupSignalEventEmission(
 *   volumeSignal,
 *   emitter,
 *   (volume) => ['volume', volume]
 * )
 * ```
 *
 * @param signal - Signal to observe
 * @param emitter - Event emitter
 * @param getEventData - Function that returns [eventName, ...args]
 * @returns Cleanup function
 */
export function setupSignalEventEmission<T>(
  signal: Signal<T>,
  emitter: EventEmitter,
  getEventData: (value: T) => [string, ...any[]],
): () => void {
  return effect(() => {
    const value = signal.value
    const [eventName, ...args] = getEventData(value)
    emitter.emit(eventName, ...args)
  }, [signal])
}

/**
 * Setup event emission with debouncing
 *
 * Useful for high-frequency events like scroll or timeupdate.
 *
 * @example
 * ```typescript
 * const cleanup = setupDebouncedEventEmission(
 *   state.scrollPosition,
 *   emitter,
 *   (pos) => ['scroll', pos],
 *   100 // debounce 100ms
 * )
 * ```
 *
 * @param signal - Signal to observe
 * @param emitter - Event emitter
 * @param getEventData - Function that returns [eventName, ...args]
 * @param debounceMs - Debounce delay in milliseconds
 * @returns Cleanup function
 */
export function setupDebouncedEventEmission<T>(
  signal: Signal<T>,
  emitter: EventEmitter,
  getEventData: (value: T) => [string, ...any[]],
  debounceMs: number,
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const cleanup = effect(() => {
    const value = signal.value

    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      const [eventName, ...args] = getEventData(value)
      emitter.emit(eventName, ...args)
      timeoutId = null
    }, debounceMs)
  }, [signal])

  // Return cleanup that also clears pending timeout
  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    cleanup()
  }
}

/**
 * Setup conditional event emission
 *
 * Only emit events when a condition is met.
 *
 * @example
 * ```typescript
 * // Only emit finish event when playing stops at end
 * const cleanup = setupConditionalEventEmission(
 *   state.isPlaying,
 *   emitter,
 *   (isPlaying) => !isPlaying && state.currentTime.value >= state.duration.value,
 *   () => ['finish']
 * )
 * ```
 *
 * @param signal - Signal to observe
 * @param emitter - Event emitter
 * @param condition - Function that returns true when event should emit
 * @param getEventData - Function that returns [eventName, ...args]
 * @returns Cleanup function
 */
export function setupConditionalEventEmission<T>(
  signal: Signal<T>,
  emitter: EventEmitter,
  condition: (value: T) => boolean,
  getEventData: (value: T) => [string, ...any[]],
): () => void {
  return effect(() => {
    const value = signal.value
    if (condition(value)) {
      const [eventName, ...args] = getEventData(value)
      emitter.emit(eventName, ...args)
    }
  }, [signal])
}
