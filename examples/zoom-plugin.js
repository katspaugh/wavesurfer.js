/**
 * Zoom plugin
 *
 * Zoom in or out on the waveform when scrolling the mouse wheel
 */

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import ZoomPlugin from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/zoom.esm.js'

// Create an instance of WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
})

// Initialize the Zoom plugin
wavesurfer.registerPlugin(
  ZoomPlugin.create({
    // the amount of zoom per wheel step, e.g. 0.5 means a 50% magnification per scroll
    scale: 0.5,
    // Optionally, specify the maximum pixels-per-second factor while zooming
    maxZoom: 100,
  }),
)

//  show the current minPxPerSec value
const minPxPerSecSpan = document.querySelector('#minPxPerSec')
wavesurfer.on('zoom', (minPxPerSec) => {
  minPxPerSecSpan.textContent = `${Math.round(minPxPerSec)}`
})

// Create a minPxPerSec display and waveform container
/*
<html>
  <div>
       minPxPerSec: <span id="minPxPerSec">100</span> px/s
  </div>

    <div id="waveform"></div>
 </html>
 *
 */

// A few more controls
/*
<html>
    <button id="play">Play/Pause</button>
    <button id="backward">Backward 5s</button>
    <button id="forward">Forward 5s</button>
  <p>
    📖 Zoom in or out on the waveform when scrolling the mouse wheel
  </p>
</html>
*/

const playButton = document.querySelector('#play')
const forwardButton = document.querySelector('#forward')
const backButton = document.querySelector('#backward')

playButton.onclick = () => {
  wavesurfer.playPause()
}

forwardButton.onclick = () => {
  wavesurfer.skip(5)
}

backButton.onclick = () => {
  wavesurfer.skip(-5)
}
