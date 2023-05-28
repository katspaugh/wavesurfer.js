// Timeline plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import TimelinePlugin from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/timeline.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
})

// Initialize the Timeline plugin
ws.registerPlugin(TimelinePlugin.create())

// Play on click
ws.on('interaction', () => {
  ws.play()
})

// Rewind to the beginning on finished playing
ws.on('finish', () => {
  ws.setTime(0)
})
