// Regions plugin

import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

// Initialize the Regions plugin
const regions = RegionsPlugin.create()

// Create a WaveSurfer instance
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  plugins: [regions],
})

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`

// Create some regions at specific time ranges
ws.on('decode', () => {
  // Regions
  regions.addRegion({
    start: 0,
    end: 8,
    content: 'Resize me',
    color: randomColor(),
    drag: false,
    resize: true,
  })
  regions.addRegion({
    start: 9,
    end: 10,
    content: 'Cramped region',
    color: randomColor(),
    minLength: 1,
    maxLength: 10,
  })
  regions.addRegion({
    start: 12,
    end: 17,
    content: 'Drag me',
    color: randomColor(),
    resize: false,
  })

  // Markers (zero-length regions)
  regions.addRegion({
    start: 19,
    content: 'Marker',
    color: randomColor(),
  })
  regions.addRegion({
    start: 20,
    content: 'Second marker',
    color: randomColor(),
  })
})

regions.enableDragSelection({
  color: 'rgba(255, 0, 0, 0.1)',
})

regions.on('region-updated', (region) => {
  console.log('Updated region', region)
})

// Loop a region on click
let loop = true
// Toggle looping with a checkbox
document.querySelector('input[type="checkbox"]').onclick = (e) => {
  loop = e.target.checked
}

{
  let activeRegion = null
  regions.on('region-in', (region) => {
    console.log('region-in', region)
    activeRegion = region
  })
  regions.on('region-out', (region) => {
    console.log('region-out', region)
    if (activeRegion === region) {
      if (loop) {
        region.play()
      } else {
        activeRegion = null
      }
    }
  })
  regions.on('region-clicked', (region, e) => {
    e.stopPropagation() // prevent triggering a click on the waveform
    activeRegion = region
    region.play(true)
    region.setOptions({ color: randomColor() })
  })
  // Reset the active region when the user clicks anywhere in the waveform
  ws.on('interaction', () => {
    activeRegion = null
  })
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
        Loop regions
      </label>

      <label style="margin-left: 2em">
        Zoom: <input type="range" min="10" max="1000" value="10" />
      </label>
    </p>

    <p>
      📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_regions.RegionsPlugin">Regions plugin docs</a>
    </p>
  </html>
*/
