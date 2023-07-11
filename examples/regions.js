// Regions plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js'
import RegionsPlugin from 'https://unpkg.com/wavesurfer.js/dist/plugins/regions.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
})

// Initialize the Regions plugin
const wsRegions = ws.registerPlugin(RegionsPlugin.create())

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`

// Create some regions at specific time ranges
ws.on('decode', () => {
  // Regions
  wsRegions.addRegion({
    start: 0,
    end: 8,
    content: 'Resize me',
    color: randomColor(),
    drag: false,
    resize: true,
  })
  wsRegions.addRegion({
    start: 9,
    end: 10,
    content: 'Cramped region',
    color: randomColor(),
    minLength: 1,
    maxLength: 10,
  })
  wsRegions.addRegion({
    start: 12,
    end: 17,
    content: 'Drag me',
    color: randomColor(),
    resize: false,
  })

  // Markers (zero-length regions)
  wsRegions.addRegion({
    start: 19,
    content: 'Marker',
    color: randomColor(),
  })
  wsRegions.addRegion({
    start: 20,
    content: 'Second marker',
    color: randomColor(),
  })
})

wsRegions.enableDragSelection({
  color: 'rgba(255, 0, 0, 0.1)',
})

wsRegions.on('region-updated', (region) => {
  console.log('Updated region', region)
})

// Loop a region on click
let loop = true
let activeRegion = null

wsRegions.on('region-clicked', (region, e) => {
  e.stopPropagation() // prevent triggering a click on the waveform
  activeRegion = region
  region.play()
  region.setOptions({ color: randomColor() })
})

// Track the time
ws.on('timeupdate', (currentTime) => {
  // When the end of the region is reached
  if (activeRegion && ws.isPlaying() && currentTime >= activeRegion.end) {
    if (loop) {
      // If looping, jump to the start of the region
      ws.setTime(activeRegion.start)
    } else {
      // Otherwise, exit the region
      activeRegion = null
    }
  }
})

ws.on('interaction', () => (activeRegion = null))

// Toggle looping with a checkbox
document.querySelector('input[type="checkbox"]').onclick = (e) => {
  loop = e.target.checked
}

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
        Loop regions on click
      </label>

      <label style="margin-left: 2em">
        Zoom: <input type="range" min="10" max="1000" value="10" />
      </label>
    </p>

    <p>
      📖 <a href="https://wavesurfer-js.org/docs/classes/plugins_regions.RegionsPlugin">Regions plugin docs</a>
    </p>
  </html>
*/
