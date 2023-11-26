// Timeline plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import TimelinePlugin from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/timeline.esm.js'

// Create an instance of WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
  plugins: [TimelinePlugin.create()],
})

// Play on click
wavesurfer.on('interaction', () => {
  wavesurfer.play()
})

// Rewind to the beginning on finished playing
wavesurfer.on('finish', () => {
  wavesurfer.setTime(0)
})

/*
<html>
  <label>
    Zoom: <input type="range" min="10" max="1000" value="100" />
  </label>

  <div id="waveform"></div>
  <p>
    📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_timeline.TimelinePlugin">Timeline plugin docs</a>
  </p>
</html>
*/

// Update the zoom level on slider change
wavesurfer.once('decode', () => {
  const slider = document.querySelector('input[type="range"]')

  slider.addEventListener('input', (e) => {
    const minPxPerSec = e.target.valueAsNumber
    wavesurfer.zoom(minPxPerSec)
  })
})
