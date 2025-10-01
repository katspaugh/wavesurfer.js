/**
 * State management exports
 */

export { StateStore, createStore, type StateUpdate } from './store.js'
export type {
  WaveSurferState,
  AudioState,
  PlaybackState,
  ViewState,
  PluginState,
} from './state.types.js'
export {
  createInitialState,
  createInitialAudioState,
  createInitialPlaybackState,
  createInitialViewState,
  createInitialPluginState,
} from './state.types.js'
export * as selectors from './selectors.js'
