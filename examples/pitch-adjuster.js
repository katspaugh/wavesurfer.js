/**
 * Pitch Adjuster plugin example
 */

import WaveSurfer from '../dist/wavesurfer.esm.js'
import { SoundTouchNode } from 'https://unpkg.com/@soundtouchjs/audio-worklet?module'

const wavesurfer = WaveSurfer.create({
  backend: 'WebAudio',
  container: '#waveform',
  waveColor: 'rgb(200, 200, 200)',
  progressColor: 'rgb(80, 80, 80)',
  url: '/examples/audio/librivox.mp3',
})

const semitonesInput = document.querySelector('#semitones')
const semitonesValue = document.querySelector('#semitones-value')
const status = document.querySelector('#status')
let soundTouchNode = null
let semitones = 0

status.textContent = 'Loading audio...'

const updateLabels = () => {
  semitonesValue.textContent = semitones.toFixed(1)
}

const applyPitch = () => {
  if (!soundTouchNode) return
  soundTouchNode.pitchSemitones.value = semitones
  soundTouchNode.playbackRate.value = 1

  // Keep playback speed fixed while pitch is shifted in DSP.
  wavesurfer.setPlaybackRate(1)
  updateLabels()
}

wavesurfer.on('ready', async () => {
  status.textContent = 'Loading DSP (SoundTouchJS)...'

  try {
    const webAudioPlayer = wavesurfer.getMediaElement()
    const gainNode = webAudioPlayer.getGainNode()
    const audioContext = gainNode.context

    await SoundTouchNode.register(audioContext, 'https://unpkg.com/@soundtouchjs/audio-worklet/dist/soundtouch-processor.js')
    soundTouchNode = new SoundTouchNode({ context: audioContext })

    gainNode.disconnect()
    gainNode.connect(soundTouchNode)
    soundTouchNode.connect(audioContext.destination)

    applyPitch()
    status.textContent = 'DSP ready (SoundTouchJS)'
  } catch (err) {
    status.textContent = `Pitch DSP error: ${(err && err.message) || String(err)}`
  }
})

wavesurfer.on('error', (err) => {
  status.textContent = `Audio error: ${err.message || String(err)}`
})

semitonesInput.addEventListener('input', (e) => {
  semitones = e.target.valueAsNumber
  applyPitch()
  if (!wavesurfer.isPlaying()) {
    wavesurfer.play()
  }
})

document.querySelector('#play').addEventListener('click', () => {
  wavesurfer.getMediaElement().preservesPitch = false
  wavesurfer.playPause()
})

updateLabels()

/*
<html>
  <div id="waveform"></div>

  <div style="display:flex; align-items:center; gap:1rem; margin-top:1rem; flex-wrap:wrap;">
    <button id="play">Play / Pause</button>

    <label>
      Pitch: <strong><span id="semitones-value">0.0</span> st</strong>
    </label>

    <span id="status">Loading DSP...</span>

    <label>
      -12
      <input id="semitones" type="range" min="-12" max="12" step="0.1" value="0" />
      +12
    </label>

  </div>
</html>
*/