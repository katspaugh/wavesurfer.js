// Web Audio example

import WaveSurfer from 'wavesurfer.js'

// Define the equalizer bands
const eqBands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

// Create a WaveSurfer instance and pass the media element
const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  mediaControls: true,
})

wavesurfer.on('click', () => wavesurfer.playPause())

wavesurfer.once('play', () => {
  // Create Web Audio context
  const audioContext = new AudioContext()

  // Create a biquad filter for each band
  const filters = eqBands.map((band) => {
    const filter = audioContext.createBiquadFilter()
    filter.type = band <= 32 ? 'lowshelf' : band >= 16000 ? 'highshelf' : 'peaking'
    filter.gain.value = Math.random() * 40 - 20
    filter.Q.value = 1 // resonance
    filter.frequency.value = band // the cut-off frequency
    return filter
  })

  const audio = wavesurfer.getMediaElement()
  const mediaNode = audioContext.createMediaElementSource(audio)

  // Connect the filters and media node sequentially
  const equalizer = filters.reduce((prev, curr) => {
    prev.connect(curr)
    return curr
  }, mediaNode)

  // Connect the filters to the audio output
  equalizer.connect(audioContext.destination)

  sliders.forEach((slider, i) => {
    const filter = filters[i]
    filter.gain.value = slider.value
    slider.oninput = (e) => (filter.gain.value = e.target.value)
  })
})

// HTML UI
// Create a vertical slider for each band
const container = document.createElement('p')
const sliders = eqBands.map(() => {
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.orient = 'vertical'
  slider.style.appearance = 'slider-vertical'
  slider.style.width = '8%'
  slider.min = -40
  slider.max = 40
  slider.value = Math.random() * 40 - 20
  slider.step = 0.1
  container.appendChild(slider)
  return slider
})
document.body.appendChild(container)
