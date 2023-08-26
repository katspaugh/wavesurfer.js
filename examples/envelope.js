// Envelope plugin
// Graphical fade-in and fade-out and volume control

/*
<html>
  <button style="margin: 0 2em 2em 0">Play</button>
  Volume: <label>0</label>
  <div id="container" style="border: 1px solid #ddd;"></div>
  <p>
    📖 <a href="https://wavesurfer-js.org/docs/classes/plugins_envelope.EnvelopePlugin">Envelope plugin docs</a>
  </p>
</html>
*/

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import EnvelopePlugin from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/envelope.esm.js'

// Create an instance of WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: '#container',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
})

// Initialize the Envelope plugin
const envelope = wavesurfer.registerPlugin(
  EnvelopePlugin.create({
    volume: 0.8,
    lineColor: 'rgba(255, 0, 0, 0.5)',
    lineWidth: 4,
    dragPointSize: 8,
    dragPointFill: 'rgba(0, 255, 255, 0.8)',
    dragPointStroke: 'rgba(0, 0, 0, 0.5)',

    points: [
      { time: 11.2, volume: 0.5 },
      { time: 15.5, volume: 0.9 },
    ],
  }),
)

// Show the current volume
const volumeLabel = document.querySelector('label')
const showVolume = () => {
  volumeLabel.textContent = envelope.getCurrentVolume().toFixed(2)
}
envelope.on('volume-change', showVolume)
wavesurfer.on('timeupdate', showVolume)
wavesurfer.on('ready', showVolume)

// Play/pause button
const button = document.querySelector('button')
wavesurfer.once('ready', () => {
  button.onclick = () => {
    wavesurfer.playPause()
  }
})
wavesurfer.on('play', () => {
  button.textContent = 'Pause'
})
wavesurfer.on('pause', () => {
  button.textContent = 'Play'
})
