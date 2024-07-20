// WebAudio speed control with pitch preservation

import WaveSurfer from 'wavesurfer.js'

// Init wavesurfer
const wavesurfer = WaveSurfer.create({
  backend: 'WebAudio',
  container: document.body,
  waveColor: 'violet',
  progressColor: 'purple',
  url: '/examples/audio/librivox.mp3',
})

// Wait for the audio to be ready
wavesurfer.on('ready', async () => {
  const webAudioPlayer = wavesurfer.getMediaElement()
  const gainNode = webAudioPlayer.getGainNode()
  const audioContext = gainNode.context

  // Load the phase vocoder audio worklet
  await audioContext.audioWorklet.addModule('/examples/phase-vocoder/phase-vocoder.min.js')
  const phaseVocoderNode = new AudioWorkletNode(audioContext, 'phase-vocoder-processor')

  // Connect the worklet to the wavesurfer audio
  gainNode.disconnect()
  gainNode.connect(phaseVocoderNode)
  phaseVocoderNode.connect(audioContext.destination)

  // Speed slider
  document.querySelector('input[type="range"]').addEventListener('input', (e) => {
    const speed = e.target.valueAsNumber
    document.querySelector('#rate').textContent = speed.toFixed(2)
    wavesurfer.setPlaybackRate(speed)
    const pitchFactorParam = phaseVocoderNode.parameters.get('pitchFactor')
    pitchFactorParam.value = 1 / speed
  })

  // Play/pause button
  document.querySelector('button').addEventListener('click', () => {
    wavesurfer.playPause()
  })
})

/*
<html>
  <div style="display: flex; margin: 1rem 0; gap: 1rem;">
    <button>
      Play/pause
    </button>

    <label>
      Playback rate: <span id="rate">1.00</span>x
    </label>

    <label>
      0.1x <input type="range" min="0.1" max="4" step="0.1" value="1" /> 4x
    </label>
  </div>

  <p>
    📖 Based on <a href="https://github.com/olvb/phaze" target="_top">github.com/olvb/phaze</a>
  </p>
</html>
*/
