/**
 * State selectors for deriving data from WaveSurfer state
 * Pure functions that select and compute derived state
 */

import type { WaveSurferState, AudioState, PlaybackState, ViewState } from './state.types.js'

// Audio selectors
export function selectAudio(state: WaveSurferState): AudioState {
  return state.audio
}

export function selectDuration(state: WaveSurferState): number {
  return state.audio.duration
}

export function selectPeaks(state: WaveSurferState): Float32Array[] | null {
  return state.audio.peaks
}

export function selectChannelCount(state: WaveSurferState): number {
  return state.audio.channelCount
}

export function selectDecodedData(state: WaveSurferState): AudioBuffer | null {
  return state.audio.decodedData
}

export function selectIsAudioLoaded(state: WaveSurferState): boolean {
  return state.audio.decodedData !== null || state.audio.peaks !== null
}

// Playback selectors
export function selectPlayback(state: WaveSurferState): PlaybackState {
  return state.playback
}

export function selectIsPlaying(state: WaveSurferState): boolean {
  return state.playback.isPlaying
}

export function selectCurrentTime(state: WaveSurferState): number {
  return state.playback.currentTime
}

export function selectPlaybackRate(state: WaveSurferState): number {
  return state.playback.playbackRate
}

export function selectVolume(state: WaveSurferState): number {
  return state.playback.volume
}

export function selectIsMuted(state: WaveSurferState): boolean {
  return state.playback.muted
}

// View selectors
export function selectView(state: WaveSurferState): ViewState {
  return state.view
}

export function selectZoom(state: WaveSurferState): number {
  return state.view.zoom
}

export function selectScrollLeft(state: WaveSurferState): number {
  return state.view.scrollLeft
}

export function selectIsScrollable(state: WaveSurferState): boolean {
  return state.view.isScrollable
}

// Computed selectors
export function selectProgress(state: WaveSurferState): number {
  const duration = state.audio.duration
  if (duration === 0) return 0
  return Math.max(0, Math.min(1, state.playback.currentTime / duration))
}

export function selectProgressPercent(state: WaveSurferState): number {
  return selectProgress(state) * 100
}

export function selectRemainingTime(state: WaveSurferState): number {
  return Math.max(0, state.audio.duration - state.playback.currentTime)
}

export function selectCanPlay(state: WaveSurferState): boolean {
  return selectIsAudioLoaded(state) && state.audio.duration > 0
}

export function selectVisibleTimeRange(state: WaveSurferState): { start: number; end: number } {
  const { scrollLeft, containerWidth, waveformWidth } = state.view
  const duration = state.audio.duration

  if (waveformWidth === 0 || duration === 0) {
    return { start: 0, end: 0 }
  }

  const startRatio = scrollLeft / waveformWidth
  const endRatio = (scrollLeft + containerWidth) / waveformWidth

  return {
    start: startRatio * duration,
    end: endRatio * duration,
  }
}
