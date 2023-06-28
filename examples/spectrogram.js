// Spectrogram plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import Spectrogram from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/spectrogram.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/demo.wav',
  sampleRate: 22050,
})

// Initialize the Spectrogram plugin
ws.registerPlugin(
  Spectrogram.create({
    labels: true,
    height: 256,
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
    📖 <a href="https://wavesurfer-js.org/docs/classes/plugins_spectrogram.SpectrogramPlugin">Spectrogram plugin docs</a>
  </p>
</html>
*/
