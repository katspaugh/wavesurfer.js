/**
 * Centralized reactive state for WaveSurfer
 *
 * This module provides a single source of truth for all WaveSurfer state.
 * State is managed using reactive signals that automatically notify subscribers.
 */

import { signal, computed, type Signal, type WritableSignal } from '../reactive/store.js'

/**
 * The lifecycle phase of the current/most-recent load, driven by the load
 * pipeline in `loadAudio`/`load`/`loadBlob`. `idle` is the initial value
 * before any load has started.
 */
export type LoadPhase = 'idle' | 'fetching' | 'decoding' | 'ready' | 'error'

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
  readonly muted: Signal<boolean>
  readonly playbackRate: Signal<number>

  // Audio data
  readonly audioBuffer: Signal<AudioBuffer | null>
  readonly peaks: Signal<Array<Float32Array | number[]> | null>
  readonly url: Signal<string>

  // UI state
  readonly zoom: Signal<number>
  readonly scrollPosition: Signal<number>

  // Load lifecycle
  readonly loadPhase: Signal<LoadPhase>

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
  /** @internal No caller in WaveSurfer's own wiring -- see the note above these six actions' implementations below. Public for direct/standalone use of this module. */
  setCurrentTime: (time: number) => void
  /** @internal See setCurrentTime. */
  setDuration: (duration: number) => void
  /** @internal See setCurrentTime. */
  setPlaying: (playing: boolean) => void
  /** @internal See setCurrentTime. */
  setSeeking: (seeking: boolean) => void
  /** @internal See setCurrentTime. */
  setVolume: (volume: number) => void
  /** @internal See setCurrentTime. */
  setPlaybackRate: (rate: number) => void
  setAudioBuffer: (buffer: AudioBuffer | null) => void
  setPeaks: (peaks: Array<Float32Array | number[]> | null) => void
  setUrl: (url: string) => void
  setZoom: (zoom: number) => void
  setScrollPosition: (position: number) => void
  setLoadPhase: (phase: LoadPhase) => void
}

/**
 * Optional Player signals to compose into WaveSurferState
 * When provided, these signals from Player are used directly instead of creating new ones
 * Note: Signals must be WritableSignal to allow state actions to update them
 */
export interface PlayerSignals {
  isPlaying?: WritableSignal<boolean>
  currentTime?: WritableSignal<number>
  duration?: WritableSignal<number>
  volume?: WritableSignal<number>
  muted?: WritableSignal<boolean>
  playbackRate?: WritableSignal<number>
  isSeeking?: WritableSignal<boolean>
}

/**
 * Create a new WaveSurfer state instance
 *
 * @param playerSignals - Optional signals from Player to compose with WaveSurfer state
 *
 * @example
 * ```typescript
 * // Without Player signals (standalone)
 * const { state, actions } = createWaveSurferState()
 *
 * // With Player signals (composed)
 * const { state, actions } = createWaveSurferState({
 *   isPlaying: player.isPlayingSignal,
 *   currentTime: player.currentTimeSignal,
 *   // ...
 * })
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
export function createWaveSurferState(playerSignals?: PlayerSignals): {
  state: WaveSurferState
  actions: WaveSurferActions
  dispose: () => void
} {
  // Use Player signals if provided, otherwise create new ones
  const currentTime = playerSignals?.currentTime ?? signal(0)
  const duration = playerSignals?.duration ?? signal(0)
  const isPlaying = playerSignals?.isPlaying ?? signal(false)
  const isSeeking = playerSignals?.isSeeking ?? signal(false)
  const volume = playerSignals?.volume ?? signal(1)
  const muted = playerSignals?.muted ?? signal(false)
  const playbackRate = playerSignals?.playbackRate ?? signal(1)

  // WaveSurfer-specific signals (not in Player)
  const audioBuffer = signal<AudioBuffer | null>(null)
  const peaks = signal<Array<Float32Array | number[]> | null>(null)
  const url = signal('')
  const zoom = signal(0)
  const scrollPosition = signal(0)
  const loadPhase = signal<LoadPhase>('idle')

  // Computed values (derived state)
  const isPaused = computed(() => !isPlaying.value, [isPlaying])

  const canPlay = computed(() => audioBuffer.value !== null, [audioBuffer])

  const isReady = computed(() => {
    return canPlay.value && duration.value > 0
  }, [canPlay, duration])

  // Historical alias of currentTime -- kept as-is (public API), not currentTime's inverse or a distinct value.
  const progress = computed(() => currentTime.value, [currentTime])

  const progressPercent = computed(() => {
    return duration.value > 0 ? currentTime.value / duration.value : 0
  }, [currentTime, duration])

  const computeds = [isPaused, canPlay, isReady, progress, progressPercent]

  // Public read-only state
  const state: WaveSurferState = {
    currentTime,
    duration,
    isPlaying,
    isPaused,
    isSeeking,
    volume,
    muted,
    playbackRate,
    audioBuffer,
    peaks,
    url,
    zoom,
    scrollPosition,
    loadPhase,
    canPlay,
    isReady,
    progress,
    progressPercent,
  }

  // Actions that modify state.
  //
  // setCurrentTime/setDuration/setPlaying/setSeeking/setVolume/setPlaybackRate
  // (marked @internal on WaveSurferActions above) have no caller in
  // WaveSurfer's own wiring: when playerSignals are supplied, WaveSurfer
  // writes to the composed currentTime/duration/isPlaying/isSeeking/volume
  // signals exclusively through the Player pipeline (media events/mutations
  // -> the Player's own signals -> WaveSurfer's mirrored playbackSignals,
  // which ARE these signals by reference -- see bindPlayerSignals in
  // wavesurfer.ts).
  // They're kept, not deleted, because they're part of this module's
  // standalone/direct-use public contract (see the dedicated test coverage
  // in wavesurfer-state.test.ts) independent of the WaveSurfer integration.
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
        // Don't clobber an already-valid duration (e.g. reported by media
        // metadata) with the AudioBuffer's duration, which can differ
        // fractionally due to sample-rate resampling or encoder padding.
        // Mirrors the media-first precedence in WaveSurfer.getDuration().
        const current = duration.value
        if (current === 0 || Number.isNaN(current) || current === Infinity) {
          duration.set(buffer.duration)
        }
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

    setLoadPhase: (phase: LoadPhase) => {
      loadPhase.set(phase)
    },
  }

  const dispose = () => {
    computeds.forEach((c) => c.dispose())
  }

  return { state, actions, dispose }
}
