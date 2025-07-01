// Customized Timeline plugin

import WaveSurfer from 'wavesurfer.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'

// Create a timeline plugin instance with custom options
const topTimeline = TimelinePlugin.create({
  height: 20,
  insertPosition: 'beforebegin',
  timeInterval: 0.2,
  primaryLabelInterval: 5,
  secondaryLabelInterval: 1,
  style: {
    fontSize: '20px',
    color: '#2D5B88',
  },
})

// Create a second timeline
const bottomTimeline = TimelinePlugin.create({
  height: 10,
  timeInterval: 0.1,
  primaryLabelInterval: 1,
  style: {
    fontSize: '10px',
    color: '#6A3274',
  },
})

// Create an instance of WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  minPxPerSec: 100,
  plugins: [topTimeline, bottomTimeline],
})

// Play on click
wavesurfer.once('interaction', () => {
  wavesurfer.play()
})

/*
<html>
  <div id="waveform"></div>
  <p>
    📖 <a href="https://wavesurfer.xyz/docs/modules/plugins_timeline">Timeline plugin docs</a>
  </p>
</html>
*/
