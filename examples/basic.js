// A super-basic example

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
})

wavesurfer.once('interaction', () => {
  wavesurfer.play()
})
