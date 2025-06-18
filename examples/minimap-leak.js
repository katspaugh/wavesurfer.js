// Plugin leak test

// Instructions:
// 1. Load the page and press the "Reload" button several times
// 2. Open the Memory tab in Chrome DevTools
// 3. Take a heap snapshot
// 4. Look for "MinimapPlugin" in the snapshot - there should be only one instance of it
// 4. Look for "WaveSurfer" in the snapshot - there should be only two instances of it


import WaveSurfer from 'wavesurfer.js'
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
  hideScrollbar: true,
  autoCenter: false,
})

function createMinimapPlugin() {
  return Minimap.create({
    height: 20,
    waveColor: '#ddd',
    progressColor: '#999',
  })
}

let minimapPlugin = createMinimapPlugin()
ws.registerPlugin(minimapPlugin)

ws.on('interaction', () => {
  ws.play()
})

document.querySelector('#reload').onclick = async (e) => {
  minimapPlugin.destroy()
  minimapPlugin = createMinimapPlugin()
  ws.registerPlugin(minimapPlugin)
}

/*
<html>
  <div id="waveform"></div>
  <button id="reload">Reload</button>
  <p>
    📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_minimap.MinimapPlugin">Minimap plugin docs</a>
  </p>
</html>
*/
