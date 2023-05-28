// Set the playback speed

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
      0.25x <input type="range" min="0" max="4" step="1" value="2" /> 4x
    </label>

    <label>
      <input type="checkbox" checked />
      Preserve pitch
    </label>
  </div>
</html>
*/

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/librivox.mp3',
})

let preservePitch = true
const speeds = [0.25, 0.5, 1, 2, 4]

// Toggle pitch preservation
document.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
  preservePitch = e.target.checked
  wavesurfer.setPlaybackRate(wavesurfer.getPlaybackRate(), preservePitch)
})

// Set the playback rate
document.querySelector('input[type="range"]').addEventListener('input', (e) => {
  const speed = speeds[e.target.valueAsNumber]
  document.querySelector('#rate').textContent = speed.toFixed(2)
  wavesurfer.setPlaybackRate(speed, preservePitch)
  wavesurfer.play()
})

// Play/pause
document.querySelector('button').addEventListener('click', () => {
  wavesurfer.playPause()
})
