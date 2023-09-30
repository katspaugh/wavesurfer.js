// Hover plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import Hover from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/hover.esm.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  plugins: [
    Hover.create({
      lineColor: '#ff0000',
      lineWidth: 2,
      labelBackground: '#555',
      labelColor: '#fff',
      labelSize: '11px',
    }),
  ],
})

ws.on('interaction', () => {
  ws.play()
})

/*
<html>
  <style>
    #waveform ::part(hover-label):before {
      content: '⏱️ ';
    }
  </style>

  <div id="waveform"></div>

  <p>
    📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_hover.HoverPlugin">Hover plugin docs</a>
  </p>
</html>
*/
