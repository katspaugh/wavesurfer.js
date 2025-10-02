// Regions plugin

import WaveSurfer from 'wavesurfer.js'
import { RegionsPlugin } from 'wavesurfer.js/dist/plugins/regions.esm.js'

// Create a WaveSurfer instance
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
})

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`

// Register the Regions plugin with drag selection enabled
const regions = await ws.registerPluginV8(RegionsPlugin({
  dragSelection: true,
}))

// Create some regions at specific time ranges
ws.on('decode', () => {
  // Regions
  regions.instance.actions.addRegion({
    start: 0,
    end: 8,
    content: 'Resize me',
    color: randomColor(),
    drag: false,
    resize: true,
  })
  regions.instance.actions.addRegion({
    start: 9,
    end: 10,
    content: 'Cramped region',
    color: randomColor(),
    minLength: 1,
    maxLength: 10,
  })
  regions.instance.actions.addRegion({
    start: 12,
    end: 17,
    content: 'Drag me',
    color: randomColor(),
    resize: false,
  })

  // Markers (zero-length regions)
  regions.instance.actions.addRegion({
    start: 19,
    content: 'Marker',
    color: randomColor(),
  })
  regions.instance.actions.addRegion({
    start: 20,
    content: 'Second marker',
    color: randomColor(),
  })
})

// Subscribe to regions stream
regions.instance.streams.regions.subscribe((regionsList) => {
  console.log('Regions updated:', regionsList)
})

// Example: Loop a region
// You can implement region interactions using the regions.instance.streams.regions observable

// Update the zoom level on slider change
ws.once('decode', () => {
  document.querySelector('input[type="range"]').oninput = (e) => {
    const minPxPerSec = Number(e.target.value)
    ws.zoom(minPxPerSec)
  }
})

/*
  <html>
    <div id="waveform"></div>

    <p>
      <label>
        <input type="checkbox" checked="${loop}" />
        Loop regions
      </label>

      <label style="margin-left: 2em">
        Zoom: <input type="range" min="10" max="1000" value="10" />
      </label>
    </p>

    <p>
      📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_regions.default">Regions plugin docs</a>
    </p>
  </html>
*/
