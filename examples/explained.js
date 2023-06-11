// Wavesurfer configuration explained

// First, import the library.
import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

// Alternatively, insert a script tag that exposes `WaveSurfer` as a global variable:
// <script src="https://unpkg.com/wavesurfer.js@beta"></script>

// Create a wavesurfer instance and pass different parameters
// See the full list of options here: https://wavesurfer-js.org/docs/options.html
const wavesurfer = WaveSurfer.create({
  // The container is where the waveform will be drawn.
  // This is the only required parameter.
  // We're passing `document.body` here, but you can pass any DOM element or a CSS selector.
  container: document.body,

  // The height is optional. If not set, it will default to 128 pixels.
  height: 150,

  // The main waveform color.
  // It can be any CSS color, e.g. a hex or rgba, or even a Canvas gradient.
  waveColor: 'rgb(200, 0, 200)',

  // This is the color of the progress mask
  progressColor: 'rgb(100, 0, 100)',

  // Finally, pass the URL of an audio file
  // Note: this URL must support CORS
  url: '/examples/audio/audio.wav',
})

// Now, let's add some interaction. We'll add a play/pause button.

// First, create a button element
const button = document.createElement('button')
button.textContent = 'Play'
button.style.margin = '1em 0'
document.body.appendChild(button)

// Next, let's change the text on the button when the audio is playing
wavesurfer.on('play', () => {
  button.textContent = 'Pause'
})
// And when it's paused
wavesurfer.on('pause', () => {
  button.textContent = 'Play'
})

// Subscribe to wavesurfer's `ready` event to know when we can interact with the player
wavesurfer.on('ready', () => {
  // Finally, inside the callback, we'll add a click listener to the button.
  button.addEventListener('click', () => {
    if (wavesurfer.isPlaying()) {
      wavesurfer.pause()
    } else {
      wavesurfer.play()
    }
  })
})
