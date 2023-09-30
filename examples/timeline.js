// Timeline plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import TimelinePlugin from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/timeline.esm.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
})

// Initialize the Timeline plugin
ws.registerPlugin(TimelinePlugin.create())

// Play on click
ws.on('interaction', () => {
  ws.play()
})

// Rewind to the beginning on finished playing
ws.on('finish', () => {
  ws.setTime(0)
})

/*
<html>
  <div id="waveform"></div>
  <p>
    📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_timeline.TimelinePlugin">Timeline plugin docs</a>
  </p>
</html>
*/
