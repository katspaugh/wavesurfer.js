import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
})

/** When audio starts loading */
wavesurfer.on('load', (url) => {
  console.log('Load', url)
})

/** During audio loading */
wavesurfer.on('loading', (percent) => {
  console.log('Loading', percent + '%')
})

/** When the audio has been decoded */
wavesurfer.on('decode', (duration) => {
  console.log('Decode', duration + 's')
})

/** When the audio is both decoded and can play */
wavesurfer.on('ready', (duration) => {
  console.log('Ready', duration + 's')
})

/** When a waveform is drawn */
wavesurfer.on('redraw', () => {
  console.log('Redraw')
})

/** When the audio starts playing */
wavesurfer.on('play', () => {
  console.log('Play')
})

/** When the audio pauses */
wavesurfer.on('pause', () => {
  console.log('Pause')
})

/** When the audio finishes playing */
wavesurfer.on('finish', () => {
  console.log('Finish')
})

/** On audio position change, fires continuously during playback */
wavesurfer.on('timeupdate', (currentTime) => {
  console.log('Time', currentTime + 's')
})

/** When the user seeks to a new position */
wavesurfer.on('seeking', (currentTime) => {
  console.log('Seeking', currentTime + 's')
})

/** When the user interacts with the waveform (i.g. clicks or drags on it) */
wavesurfer.on('interaction', (newTime) => {
  console.log('Interaction', newTime + 's')
})

/** When the user clicks on the waveform */
wavesurfer.on('click', (relativeX) => {
  console.log('Click', relativeX)
})

/** When the user drags the cursor */
wavesurfer.on('drag', (relativeX) => {
  console.log('Drag', relativeX)
})

/** When the waveform is scrolled (panned) */
wavesurfer.on('scroll', (visibleStartTime, visibleEndTime) => {
  console.log('Scroll', visibleStartTime + 's', visibleEndTime + 's')
})

/** When the zoom level changes */
wavesurfer.on('zoom', (minPxPerSec) => {
  console.log('Zoom', minPxPerSec + 'px/s')
})

/** Just before the waveform is destroyed so you can clean up your events */
wavesurfer.on('destroy', () => {
  console.log('Destroy')
})

wavesurfer.load('/examples/audio/audio.wav')

/*
<html>
  <label>
    Zoom: <input type="range" min="10" max="1000" value="100" />
  </label>
  <button>Play/pause</button>
  <p>Open the console to see the event logs</p>
</html>
*/

// Update the zoom level on slider change
wavesurfer.once('decode', () => {
  const slider = document.querySelector('input[type="range"]')

  slider.addEventListener('input', (e) => {
    const minPxPerSec = e.target.valueAsNumber
    wavesurfer.zoom(minPxPerSec)
  })

  document.querySelector('button').addEventListener('click', () => {
    wavesurfer.playPause()
  })
})
