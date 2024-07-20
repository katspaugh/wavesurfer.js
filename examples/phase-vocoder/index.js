// WebAudio speed control with pitch preservation

import WaveSurfer from 'wavesurfer.js'
import WebAudioPlayer from 'wavesurfer.js/dist/webaudio.js'

async function init() {
  const audioContext = new AudioContext()
  await audioContext.audioWorklet.addModule('/examples/phase-vocoder/phase-vocoder.min.js')
  const phaseVocoderNode = new AudioWorkletNode(audioContext, 'phase-vocoder-processor')

  const webAudioPlayer = new WebAudioPlayer(audioContext)
  webAudioPlayer.src = '/examples/audio/librivox.mp3'

  webAudioPlayer.addEventListener('loadedmetadata', () => {
    const wavesurfer = WaveSurfer.create({
      container: document.body,
      waveColor: 'violet',
      progressColor: 'purple',
      media: webAudioPlayer,
      peaks: webAudioPlayer.getChannelData(),
      duration: webAudioPlayer.duration,
    })

    webAudioPlayer.getGainNode().disconnect()
    webAudioPlayer.getGainNode().connect(phaseVocoderNode)
    phaseVocoderNode.connect(audioContext.destination)

    // Speed slider
    document.querySelector('input[type="range"]').addEventListener('input', (e) => {
      const speed = e.target.valueAsNumber
      document.querySelector('#rate').textContent = speed.toFixed(2)
      wavesurfer.setPlaybackRate(speed)
      const pitchFactorParam = phaseVocoderNode.parameters.get('pitchFactor')
      pitchFactorParam.value = 1 / speed
    })

    document.querySelector('button').addEventListener('click', () => {
      wavesurfer.playPause()
    })
  })
}

init()

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
