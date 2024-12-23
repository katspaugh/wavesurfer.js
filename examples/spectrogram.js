// Spectrogram plugin

import WaveSurfer from 'wavesurfer.js'
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  sampleRate: 44100,
})

// Initialize the Spectrogram plugin
ws.registerPlugin(
  Spectrogram.create({
    labels: true,
    height: 200,
    splitChannels: true,
    scale: 'mel', // or 'linear'
    frequencyMax: 8000,
    frequencyMin: 0,
    fftSamples: 1024,
    labelsBackground: 'rgba(0, 0, 0, 0.1)',
  }),
)

// Play on click
ws.once('interaction', () => {
  ws.play()
})

/*
<html>
  <div id="waveform"></div>
  <p>
    📖 <a href="https://wavesurfer.xyz/docs/modules/plugins_spectrogram">Spectrogram plugin docs</a>
  </p>
</html>
*/
