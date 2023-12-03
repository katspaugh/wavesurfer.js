import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import WebAudio from 'https://unpkg.com/wavesurfer.js@7/dist/webaudio.js'

const media = new WebAudio()
media.src = '/examples/audio/audio.wav'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  media,
})
