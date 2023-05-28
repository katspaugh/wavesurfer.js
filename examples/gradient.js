// Fancy gradients

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

// Create a canvas gradient
const ctx = document.createElement('canvas').getContext('2d')
const gradient = ctx.createLinearGradient(0, 0, 0, 150)
gradient.addColorStop(0, 'rgb(200, 0, 200)')
gradient.addColorStop(0.7, 'rgb(100, 0, 100)')
gradient.addColorStop(1, 'rgb(0, 0, 0)')

// Default style with a gradient
WaveSurfer.create({
  container: document.body,
  waveColor: gradient,
  progressColor: 'rgba(0, 0, 100, 0.5)',
  url: '/examples/audio/audio.wav',
})

// SoundCloud-style bars
WaveSurfer.create({
  container: document.body,
  waveColor: gradient,
  height: 200,
  barWidth: 2,
  progressColor: 'rgba(0, 0, 100, 0.5)',
  url: '/examples/audio/audio.wav',
})
