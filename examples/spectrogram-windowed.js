// Windowed Spectrogram plugin - Optimized for very long audio files

import WaveSurfer from 'wavesurfer.js'
import WindowedSpectrogram from 'wavesurfer.js/dist/plugins/spectrogram-windowed.esm.js'
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/librivox.mp3',
  sampleRate: 44100,
  minPxPerSec: 100,
})

// Initialize the Windowed Spectrogram plugin
ws.registerPlugin(
  WindowedSpectrogram.create({
    labels: true,
    splitChannels: true,
    scale: 'mel', // or 'linear', 'logarithmic', 'bark', 'erb'
    frequencyMax: 18000,
    frequencyMin: 0,
    fftSamples: 1024, // Use a reasonable FFT size (powers of 2: 256, 512, 1024, 2048)
    labelsBackground: 'rgba(0, 0, 0, 0.1)',
    colorMap: 'roseus', // Color scheme optimized for long audio viewing
    useWebWorker: true,
    progressiveLoading: true,
  }),
)

// Initialize the TimeLabels plugin
ws.registerPlugin(
  TimelinePlugin.create({
    labels: true,
    labelsBackground: 'rgba(0, 0, 0, 0.1)',
  }),
)

// Initialize the Zoom plugin for interactive zooming
ws.registerPlugin(
  ZoomPlugin.create({
    scale: 0.5, // 50% zoom per wheel step
    maxZoom: 1000, // Allow zooming up to 1000 px/sec
  }),
)

// Show the current zoom level
ws.on('zoom', (minPxPerSec) => {
  const zoomDisplay = document.querySelector('#zoom-level')
  if (zoomDisplay) {
    zoomDisplay.textContent = `${Math.round(minPxPerSec)} px/s`
  }
})

// Play on click
ws.once('interaction', () => {
  ws.play()
})

/*
<html>
  <div style="margin-bottom: 10px;">
    Zoom level: <span id="zoom-level">50 px/s</span>
  </div>
  <div id="waveform"></div>
  <p>
    📖 <a href="https://wavesurfer.xyz/docs/modules/plugins_spectrogram">Windowed Spectrogram plugin docs</a>
  </p>
  <p>
    ⚡ This plugin is optimized for very long audio files by using a sliding window approach
    that keeps memory usage constant regardless of audio length.
  </p>
  <p>
    🔍 Use mouse wheel to zoom in/out. The spectrogram will dynamically load segments as you navigate.
    Notice how segments are loaded on-demand as you zoom and scroll!
  </p>
</html>
*/
