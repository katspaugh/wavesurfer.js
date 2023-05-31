/**
 * Multi-track mixer
 *
 * @see https://github.com/katspaugh/wavesurfer-multitrack
 */

/*
<html>
  <label>
    Zoom: <input type="range" min="10" max="100" value="10" />
  </label>

  <div style="margin: 2em 0">
    <button id="play">Play</button>
    <button id="forward">Forward 30s</button>
    <button id="backward">Back 30s</button>
  </div>

  <div id="multitrack" style="background: #2d2d2d; color: #fff"></div>

  <script src="https://unpkg.com/wavesurfer-multitrack/dist/multitrack.min.js"></script>
</html>
*/

// Call Multitrack.create to initialize a multitrack mixer
// Pass a tracks array and WaveSurfer options with a container element
const multitrack = Multitrack.create(
  [
    {
      id: 0,
    },
    {
      id: 1,
      draggable: false,
      startPosition: 14, // start time relative to the entire multitrack
      url: '/examples/audio/librivox.mp3',
      fadeInEnd: 5,
      fadeOutStart: 250,
      volume: 1,
      options: {
        waveColor: 'hsl(46, 87%, 49%)',
        progressColor: 'hsl(46, 87%, 20%)',
      },
      intro: {
        endTime: 16,
        label: 'Intro',
        color: '#FFE56E',
      },
      markers: [
        {
          time: 21,
          label: 'M1',
          color: 'hsla(600, 100%, 30%, 0.5)',
        },
        {
          time: 22.7,
          label: 'M2',
          color: 'hsla(400, 100%, 30%, 0.5)',
        },
        {
          time: 24,
          label: 'M3',
          color: 'hsla(200, 50%, 70%, 0.5)',
        },
        {
          time: 27,
          label: 'M4',
          color: 'hsla(200, 50%, 70%, 0.5)',
        },
      ],
      // peaks: [ [ 0, 0, 2.567, -2.454, 10.5645 ] ], // optional pre-generated peaks
    },
    {
      id: 2,
      draggable: true,
      startPosition: 1,
      startCue: 2.1,
      endCue: 20,
      fadeInEnd: 8,
      fadeOutStart: 11,
      volume: 0.8,
      options: {
        waveColor: 'hsl(161, 87%, 49%)',
        progressColor: 'hsl(161, 87%, 20%)',
      },
      url: '/examples/audio/audio.wav',
    },
  ],
  {
    container: document.querySelector('#multitrack'), // required!
    minPxPerSec: 10, // zoom level
    rightButtonDrag: true, // drag tracks with the right mouse button
    cursorWidth: 2,
    cursorColor: '#D72F21',
    trackBackground: '#2D2D2D',
    trackBorderColor: '#7C7C7C',
    envelopeOptions: {
      lineColor: 'rgba(255, 0, 0, 0.7)',
      lineWidth: 4,
      dragPointSize: 8,
      dragPointFill: 'rgba(255, 255, 255, 0.8)',
      dragPointStroke: 'rgba(255, 255, 255, 0.3)',
    },
  },
)

// Events
multitrack.on('start-position-change', ({ id, startPosition }) => {
  console.log(`Track ${id} start position updated to ${startPosition}`)
})
multitrack.on('start-cue-change', ({ id, startCue }) => {
  console.log(`Track ${id} start cue updated to ${startCue}`)
})
multitrack.on('end-cue-change', ({ id, endCue }) => {
  console.log(`Track ${id} end cue updated to ${endCue}`)
})
multitrack.on('volume-change', ({ id, volume }) => {
  console.log(`Track ${id} volume updated to ${volume}`)
})
multitrack.on('fade-in-change', ({ id, fadeInEnd }) => {
  console.log(`Track ${id} fade-in updated to ${fadeInEnd}`)
})
multitrack.on('fade-out-change', ({ id, fadeOutStart }) => {
  console.log(`Track ${id} fade-out updated to ${fadeOutStart}`)
})
multitrack.on('intro-end-change', ({ id, endTime }) => {
  console.log(`Track ${id} intro end updated to ${endTime}`)
})

// Drag'n'drop a track object (not an audio file!)
multitrack.on('drop', ({ id }) => {
  multitrack.addTrack({
    id,
    url: '/examples/audio/demo.wav',
    startPosition: 0,
    draggable: true,
    options: {
      waveColor: 'hsl(25, 87%, 49%)',
      progressColor: 'hsl(25, 87%, 20%)',
    },
  })
})

// Play/pause button
const button = document.querySelector('#play')
button.disabled = true
multitrack.once('canplay', () => {
  button.disabled = false
  button.onclick = () => {
    multitrack.isPlaying() ? multitrack.pause() : multitrack.play()
    button.textContent = multitrack.isPlaying() ? 'Pause' : 'Play'
  }
})

// Forward/back buttons
const forward = document.querySelector('#forward')
forward.onclick = () => {
  multitrack.setTime(multitrack.getCurrentTime() + 30)
}
const backward = document.querySelector('#backward')
backward.onclick = () => {
  multitrack.setTime(multitrack.getCurrentTime() - 30)
}

// Zoom
const slider = document.querySelector('input[type="range"]')
slider.oninput = () => {
  multitrack.zoom(slider.valueAsNumber)
}

// Destroy the plugin on unmount
// This should be called before calling initMultiTrack again to properly clean up
window.onbeforeunload = () => {
  multitrack.destroy()
}
