// Minimap plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import Minimap from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/minimap.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
  hideScrollbar: true,
  autoCenter: false,
  plugins: [
    // Register the plugin
    Minimap.create({
      height: 20,
      waveColor: '#ddd',
      progressColor: '#999',
      // the Minimap takes all the same options as the WaveSurfer itself
    }),
  ],
})

ws.on('interaction', () => {
  ws.play()
})

/*
<html>
  <div id="waveform"></div>
  <p>
    📖 <a href="https://wavesurfer-js.org/docs/classes/plugins_minimap.MinimapPlugin">Minimap plugin docs</a>
  </p>
</html>
*/
