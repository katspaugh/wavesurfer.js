// Customized Timeline plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import TimelinePlugin from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/timeline.js'

// Create a timeline plugin instance with custom options
const topTimeline = TimelinePlugin.create({
  height: 20,
  insertPosition: 'beforebegin',
  timeInterval: 0.2,
  primaryLabelInterval: 5,
  secondaryLabelInterval: 1,
  style: {
    fontSize: '20px',
    color: '#2D5B88',
  },
})

// Create a second timeline
const bottomTimline = TimelinePlugin.create({
  height: 10,
  timeInterval: 0.1,
  primaryLabelInterval: 1,
  style: {
    fontSize: '10px',
    color: '#6A3274',
  },
})

// Create an instance of WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
  plugins: [topTimeline, bottomTimline],
})

// Play on click
wavesurfer.once('interaction', () => {
  wavesurfer.play()
})
