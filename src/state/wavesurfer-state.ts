/**
 * Centralized reactive state for WaveSurfer
 *
 * This module provides a single source of truth for all WaveSurfer state.
 * State is managed using reactive signals that automatically notify subscribers.
 */

import { signal, computed, type Signal } from '../reactive/store.js'

/**
 * Read-only reactive state for WaveSurfer
 */
export interface WaveSurferState {
  // Playback state
  readonly currentTime: Signal<number>
  readonly duration: Signal<number>
  readonly isPlaying: Signal<boolean>
  readonly isPaused: Signal<boolean>
  readonly isSeeking: Signal<boolean>

  // Audio controls
  readonly volume: Signal<number>
  readonly playbackRate: Signal<number>

  // Audio data
  readonly audioBuffer: Signal<AudioBuffer | null>
  readonly peaks: Signal<Array<Float32Array | number[]> | null>
  readonly url: Signal<string>

  // UI state
  readonly zoom: Signal<number>
  readonly scrollPosition: Signal<number>

  // Computed state (derived from other state)
  readonly canPlay: Signal<boolean>
  readonly isReady: Signal<boolean>
  readonly progress: Signal<number>
  readonly progressPercent: Signal<number>
}

/**
 * Actions for updating WaveSurfer state
 */
export interface WaveSurferActions {
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setPlaying: (playing: boolean) => void
  setSeeking: (seeking: boolean) => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void
  setAudioBuffer: (buffer: AudioBuffer | null) => void
  setPeaks: (peaks: Array<Float32Array | number[]> | null) => void
  setUrl: (url: string) => void
  setZoom: (zoom: number) => void
  setScrollPosition: (position: number) => void
}

/**
 * Create a new WaveSurfer state instance
 *
 * @example
 * ```typescript
 * const { state, actions } = createWaveSurferState()
 *
 * // Read state
 * console.log(state.isPlaying.value)
 *
 * // Update state
 * actions.setPlaying(true)
 *
 * // Subscribe to changes
 * state.isPlaying.subscribe(playing => {
 *   console.log('Playing:', playing)
 * })
 * ```
 */
export function createWaveSurferState(): {
  state: WaveSurferState
  actions: WaveSurferActions
} {
  // Writable signals (internal state)
  const currentTime = signal(0)
  const duration = signal(0)
  const isPlaying = signal(false)
  const isSeeking = signal(false)
  const volume = signal(1)
  const playbackRate = signal(1)
  const audioBuffer = signal<AudioBuffer | null>(null)
  const peaks = signal<Array<Float32Array | number[]> | null>(null)
  const url = signal('')
  const zoom = signal(0)
  const scrollPosition = signal(0)

  // Computed values (derived state)
  const isPaused = computed(() => !isPlaying.value, [isPlaying])

  const canPlay = computed(() => audioBuffer.value !== null, [audioBuffer])

  const isReady = computed(() => {
    return canPlay.value && duration.value > 0
  }, [canPlay, duration])

  const progress = computed(() => currentTime.value, [currentTime])

  const progressPercent = computed(() => {
    return duration.value > 0 ? currentTime.value / duration.value : 0
  }, [currentTime, duration])

  // Public read-only state
  const state: WaveSurferState = {
    currentTime,
    duration,
    isPlaying,
    isPaused,
    isSeeking,
    volume,
    playbackRate,
    audioBuffer,
    peaks,
    url,
    zoom,
    scrollPosition,
    canPlay,
    isReady,
    progress,
    progressPercent,
  }

  // Actions that modify state
  const actions: WaveSurferActions = {
    setCurrentTime: (time: number) => {
      const clampedTime = Math.max(0, Math.min(duration.value || Infinity, time))
      currentTime.set(clampedTime)
    },

    setDuration: (d: number) => {
      duration.set(Math.max(0, d))
    },

    setPlaying: (playing: boolean) => {
      isPlaying.set(playing)
    },

    setSeeking: (seeking: boolean) => {
      isSeeking.set(seeking)
    },

    setVolume: (v: number) => {
      const clampedVolume = Math.max(0, Math.min(1, v))
      volume.set(clampedVolume)
    },

    setPlaybackRate: (rate: number) => {
      const clampedRate = Math.max(0.1, Math.min(16, rate))
      playbackRate.set(clampedRate)
    },

    setAudioBuffer: (buffer: AudioBuffer | null) => {
      audioBuffer.set(buffer)
      if (buffer) {
        duration.set(buffer.duration)
      }
    },

    setPeaks: (p: Array<Float32Array | number[]> | null) => {
      peaks.set(p)
    },

    setUrl: (u: string) => {
      url.set(u)
    },

    setZoom: (z: number) => {
      zoom.set(Math.max(0, z))
    },

    setScrollPosition: (pos: number) => {
      scrollPosition.set(Math.max(0, pos))
    },
  }

  return { state, actions }
}
