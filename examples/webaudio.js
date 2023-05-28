// Web Audio example

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

// Create your own media element
const audio = new Audio()
audio.controls = true
audio.src = '/examples/audio/audio.wav'

// Create a WaveSurfer instance and pass the media element
const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  media: audio, // <- this is the important part
})

// Optionally, add the audio to the page to see the controls
document.body.appendChild(audio)

// Now, create a Web Audio equalizer

// Create Web Audio context
const audioContext = new AudioContext()

// Define the equalizer bands
const eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

// Create a biquad filter for each band
const filters = eqBands.map((band) => {
  const filter = audioContext.createBiquadFilter()
  filter.type = band <= 32 ? 'lowshelf' : band >= 16000 ? 'hishelf' : 'peaking'
  filter.gain.value = Math.random() * 40 - 20
  filter.Q.value = 1 // resonance
  filter.frequency.value = band // the cut-off frequency
  return filter
})

// Connect the audio to the equalizer
audio.addEventListener(
  'canplay',
  () => {
    // Create a MediaElementSourceNode from the audio element
    const mediaNode = audioContext.createMediaElementSource(audio)

    // Connect the filters and media node sequentially
    const equalizer = filters.reduce((prev, curr) => {
      prev.connect(curr)
      return curr
    }, mediaNode)

    // Connect the filters to the audio output
    equalizer.connect(audioContext.destination)
  },
  { once: true },
)

// Create a vertical slider for each band
const container = document.createElement('p')
filters.forEach((filter) => {
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.orient = 'vertical'
  slider.style.appearance = 'slider-vertical'
  slider.style.width = '8%'
  slider.min = -40
  slider.max = 40
  slider.value = filter.gain.value
  slider.step = 0.1
  slider.oninput = (e) => (filter.gain.value = e.target.value)
  container.appendChild(slider)
})
document.body.appendChild(container)
