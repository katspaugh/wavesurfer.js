/**
 * Type definitions for WaveSurfer state management
 */

export interface AudioState {
  readonly url: string | null
  readonly peaks: Float32Array[] | null
  readonly duration: number
  readonly channelCount: number
  readonly sampleRate: number
  readonly decodedData: AudioBuffer | null
}

export interface PlaybackState {
  readonly isPlaying: boolean
  readonly isSeeking: boolean
  readonly currentTime: number
  readonly playbackRate: number
  readonly volume: number
  readonly muted: boolean
}

export interface ViewState {
  readonly minPxPerSec: number
  readonly scrollLeft: number
  readonly containerWidth: number
  readonly waveformWidth: number
  readonly isScrollable: boolean
  readonly zoom: number
}

export interface PluginState {
  readonly activePlugins: string[]
  readonly pluginData: Record<string, unknown>
}

export interface WaveSurferState {
  readonly audio: AudioState
  readonly playback: PlaybackState
  readonly view: ViewState
  readonly plugins: PluginState
}

/**
 * Initial state factory
 */
export function createInitialAudioState(): AudioState {
  return {
    url: null,
    peaks: null,
    duration: 0,
    channelCount: 0,
    sampleRate: 0,
    decodedData: null,
  }
}

export function createInitialPlaybackState(): PlaybackState {
  return {
    isPlaying: false,
    isSeeking: false,
    currentTime: 0,
    playbackRate: 1,
    volume: 1,
    muted: false,
  }
}

export function createInitialViewState(): ViewState {
  return {
    minPxPerSec: 0,
    scrollLeft: 0,
    containerWidth: 0,
    waveformWidth: 0,
    isScrollable: false,
    zoom: 1,
  }
}

export function createInitialPluginState(): PluginState {
  return {
    activePlugins: [],
    pluginData: {},
  }
}

export function createInitialState(): WaveSurferState {
  return {
    audio: createInitialAudioState(),
    playback: createInitialPlaybackState(),
    view: createInitialViewState(),
    plugins: createInitialPluginState(),
  }
}
