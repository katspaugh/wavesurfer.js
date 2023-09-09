// Envelope plugin
// Graphical fade-in and fade-out and volume control

/*
<html>
  <button style="min-width: 5em" id="play">Play</button>
  <button style="margin: 0 1em 2em" id="randomize">Randomize points</button>

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

const isMobile = top.matchMedia('(max-width: 900px)').matches

// Initialize the Envelope plugin
const envelope = wavesurfer.registerPlugin(
  EnvelopePlugin.create({
    volume: 0.8,
    lineColor: 'rgba(255, 0, 0, 0.5)',
    lineWidth: 4,
    dragPointSize: isMobile ? 20 : 12,
    dragLine: !isMobile,
    dragPointFill: 'rgba(0, 255, 255, 0.8)',
    dragPointStroke: 'rgba(0, 0, 0, 0.5)',

    points: [
      { time: 11.2, volume: 0.5 },
      { time: 15.5, volume: 0.8 },
    ],
  }),
)

envelope.on('points-change', (points) => {
  console.log('Envelope points changed', points)
})

envelope.addPoint({ time: 1, volume: 0.9 })

// Randomize points
const randomizePoints = () => {
  const points = []
  const len = 5 * Math.random()
  for (let i = 0; i < len; i++) {
    points.push({
      time: Math.random() * wavesurfer.getDuration(),
      volume: Math.random(),
    })
  }
  envelope.setPoints(points)
}

document.querySelector('#randomize').onclick = randomizePoints

// Show the current volume
const volumeLabel = document.querySelector('label')
const showVolume = () => {
  volumeLabel.textContent = envelope.getCurrentVolume().toFixed(2)
}
envelope.on('volume-change', showVolume)
wavesurfer.on('ready', showVolume)

// Play/pause button
const button = document.querySelector('#play')
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
