// Custom styling via CSS

/*
  <html>
    <style>
      #waveform ::part(cursor) {
        height: 100px;
        top: 28px;
        border-radius: 4px;
        border: 1px solid #fff;
      }

      #waveform ::part(cursor):after {
        content: '🏄';
        font-size: 1.5em;
        position: absolute;
        left: 0;
        top: -28px;
        transform: translateX(-50%);
      }

      #waveform ::part(region) {
        background-color: rgba(0, 0, 100, 0.25) !important;
      }

      #waveform ::part(region-green) {
        background-color: rgba(0, 100, 0, 0.25) !important;
        font-size: 12px;
        text-shadow: 0 0 2px #fff;
      }

      #waveform ::part(marker) {
        background-color: rgba(0, 0, 100, 0.25) !important;
        border: 1px solid #fff;
        padding: 1px;
        text-indent: 10px;
        font-family: fantasy;
        text-decoration: underline;
      }

      #waveform ::part(region-handle-right) {
        border-right-width: 4px !important;
        border-right-color: #fff000 !important;
      }
    </style>

    <div id="waveform"></div>
  </html>
*/

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import RegionsPlugin from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/regions.js'

// Create a Regions plugin instance
const wsRegions = RegionsPlugin.create()

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'hotpink',
  progressColor: 'paleturquoise',
  cursorColor: '#57BAB6',
  cursorWidth: 4,
  url: '/examples/audio/audio.wav',
  plugins: [wsRegions],
})

// Create some regions at specific time ranges
ws.on('decode', () => {
  wsRegions.addRegion({
    start: 4,
    end: 7,
    content: 'Blue',
  })

  wsRegions.addRegion({
    id: 'region-green',
    start: 10,
    end: 12,
    content: 'Green',
  })

  wsRegions.addRegion({
    start: 19,
    content: 'Marker',
  })
})
