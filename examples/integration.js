/**
 * WaveSurfer.js Integration Example
 * Demonstrates how to use the reactive architecture
 */

import { createStore, createInitialState, selectors } from '../src/state/index.js'
import { errorHandler } from '../src/utils/errors.js'
import Player from '../src/player.js'
import Renderer from '../src/renderer.js'
import * as waveform from '../src/core/waveform.js'

// ===========================
// 1. Initialize State Store
// ===========================

const store = createStore(createInitialState())

console.log('Initial state:', store.snapshot)

// ===========================
// 2. Subscribe to State Changes
// ===========================

// Subscribe to playback state
store.select(selectors.selectIsPlaying).subscribe((isPlaying) => {
  console.log('Playing:', isPlaying)
  document.getElementById('play-status').textContent = isPlaying ? 'Playing' : 'Paused'
})

// Subscribe to current time with debounce
store
  .select(selectors.selectCurrentTime)
  .debounce(100)
  .subscribe((currentTime) => {
    document.getElementById('time-display').textContent = formatTime(currentTime)
  })

// Subscribe to progress
store.select(selectors.selectProgress).subscribe((progress) => {
  document.getElementById('progress-bar').style.width = `${progress * 100}%`
})

// Subscribe to duration
store.select(selectors.selectDuration).subscribe((duration) => {
  document.getElementById('duration-display').textContent = formatTime(duration)
})

// ===========================
// 3. Error Handling
// ===========================

// Global error handler
errorHandler.subscribe((error) => {
  console.error('WaveSurfer Error:', error)
  document.getElementById('error-display').textContent = `Error: ${error.message} (${error.code})`

  // Hide error after 5 seconds
  setTimeout(() => {
    document.getElementById('error-display').textContent = ''
  }, 5000)
})

// ===========================
// 4. Initialize Player
// ===========================

const player = new Player({
  media: document.getElementById('audio-element'),
  store: store,
})

// Classic event API (still works)
player.on('play', () => {
  console.log('Play event (classic API)')
})

// New stream-based API
player.getEventValue('play').subscribe(() => {
  console.log('Play event (stream API)')
})

// ===========================
// 5. Initialize Renderer
// ===========================

const renderer = new Renderer(
  {
    container: '#waveform',
    waveColor: '#4F4A85',
    progressColor: '#383351',
    cursorColor: '#fff',
    cursorWidth: 2,
    height: 128,
    minPxPerSec: 50,
    fillParent: true,
    interact: true,
    dragToSeek: true,
  },
  undefined,
  store
)

// Subscribe to renderer events
renderer.getEventValue('click').subscribe(([relativeX]) => {
  const duration = store.snapshot.audio.duration
  const time = waveform.calculateTimeFromProgress(relativeX, duration)
  player.setTime(time)
})

// ===========================
// 6. Control Buttons
// ===========================

document.getElementById('play-btn').addEventListener('click', () => {
  if (player.isPlaying()) {
    player.pause()
  } else {
    player.play()
  }
})

document.getElementById('stop-btn').addEventListener('click', () => {
  player.pause()
  player.setTime(0)
})

document.getElementById('skip-back').addEventListener('click', () => {
  const currentTime = player.getCurrentTime()
  player.setTime(Math.max(0, currentTime - 10))
})

document.getElementById('skip-forward').addEventListener('click', () => {
  const currentTime = player.getCurrentTime()
  const duration = player.getDuration()
  player.setTime(Math.min(duration, currentTime + 10))
})

// ===========================
// 7. Volume Control
// ===========================

document.getElementById('volume-slider').addEventListener('input', (e) => {
  const volume = parseFloat(e.target.value)
  player.setVolume(volume)
})

// Subscribe to volume changes
store.select(selectors.selectVolume).subscribe((volume) => {
  document.getElementById('volume-display').textContent = Math.round(volume * 100) + '%'
})

// ===========================
// 8. Playback Rate Control
// ===========================

document.getElementById('speed-select').addEventListener('change', (e) => {
  const rate = parseFloat(e.target.value)
  player.setPlaybackRate(rate)
})

// Subscribe to rate changes
store.select(selectors.selectPlaybackRate).subscribe((rate) => {
  document.getElementById('speed-display').textContent = `${rate}x`
})

// ===========================
// 9. Zoom Control
// ===========================

document.getElementById('zoom-in').addEventListener('click', () => {
  const currentZoom = store.snapshot.view.minPxPerSec
  renderer.zoom(currentZoom * 1.5)
})

document.getElementById('zoom-out').addEventListener('click', () => {
  const currentZoom = store.snapshot.view.minPxPerSec
  renderer.zoom(currentZoom / 1.5)
})

// Subscribe to zoom changes
store.select((state) => state.view.zoom).subscribe((zoom) => {
  document.getElementById('zoom-display').textContent = `${zoom.toFixed(1)}x`
})

// ===========================
// 10. Load Audio
// ===========================

document.getElementById('load-btn').addEventListener('click', async () => {
  const url = document.getElementById('audio-url').value

  try {
    // Update loading state
    store.update((state) => ({
      ...state,
      audio: { ...state.audio, url },
    }))

    // Load audio into player
    const response = await fetch(url)
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    // Decode audio
    const audioContext = new AudioContext()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Render waveform
    await renderer.render(audioBuffer)

    // Close audio context
    audioContext.close()

    console.log('Audio loaded successfully')
  } catch (error) {
    errorHandler.handle(error, 'LOAD_ERROR', { url })
  }
})

// ===========================
// 11. State Debugging
// ===========================

// Log all state changes in development
if (import.meta.env.DEV) {
  store.subscribe((state) => {
    console.log('State updated:', state)
  })
}

// Expose store for debugging
window.store = store
window.player = player
window.renderer = renderer

// ===========================
// 12. Utility Functions
// ===========================

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// ===========================
// 13. Combine Multiple Streams
// ===========================

import { combineStreams } from '../src/streams/index.js'

// Display formatted time range
combineStreams(
  store.select(selectors.selectCurrentTime),
  store.select(selectors.selectDuration)
).subscribe(([current, duration]) => {
  document.getElementById('time-range').textContent = `${formatTime(current)} / ${formatTime(duration)}`
})

// ===========================
// 14. Using Pure Functions
// ===========================

// Calculate and display progress percentage
store.select((state) => state.playback.currentTime).subscribe((currentTime) => {
  const duration = store.snapshot.audio.duration
  const progress = waveform.calculateProgress(currentTime, duration)
  const percent = waveform.calculateProgressPercent(currentTime, duration)
  const remaining = waveform.calculateRemainingTime(currentTime, duration)

  console.log(`Progress: ${percent.toFixed(1)}%, Remaining: ${formatTime(remaining)}`)
})

// ===========================
// 15. Cleanup on Page Unload
// ===========================

window.addEventListener('beforeunload', () => {
  player.destroy()
  renderer.destroy()
  store.complete()
})

console.log('WaveSurfer initialized!')
console.log('Available in console: window.store, window.player, window.renderer')
