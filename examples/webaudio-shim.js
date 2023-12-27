import WaveSurfer from 'wavesurfer.js'
import WebAudio from 'wavesurfer.js/dist/webaudio.js'

const media = new WebAudio()
media.src = '/examples/audio/audio.wav'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  media,
})
