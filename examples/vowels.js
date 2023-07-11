// American English vowels

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import Spectrogram from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/spectrogram.esm.js'

// Sounds generated with `say -v 'Reed (English (US))' word`
const vowels = ['i', 'ɪ', 'ɛ', 'æ', 'ɑ', 'ɔ', 'o', 'ʊ', 'u', 'ʌ', 'ə', 'ɝ']
const files = ['ee', 'ih', 'hen', 'hat', 'ah', 'hot', 'oh', 'hook', 'oo', 'uh', 'ahoy', 'er']

const grid = document.querySelector('.grid')
const containers = vowels.map((vowel) => {
  const vowelDiv = document.createElement('div')
  vowelDiv.textContent = `[ ${vowel} ]`
  return grid.appendChild(vowelDiv)
})

containers.forEach((vowelDiv, idx) => {
  const wavesurfer = WaveSurfer.create({
    container: vowelDiv,
    height: 50,
    hideScrollbar: true,
    waveColor: 'rgb(200, 0, 200)',
    progressColor: 'rgb(100, 0, 100)',
    url: `/examples/audio/${files[idx]}.mp4`,
    sampleRate: 14600,
    interact: false,
    plugins: [
      Spectrogram.create({
        labels: true,
        labelsColor: 'currentColor',
        labelsBackground: 'transparent',
        height: 150,
      }),
    ],
  })

  wavesurfer.on('ready', () => {
    vowelDiv.onclick = () => {
      wavesurfer.playPause()
    }
  })
})

/*
<html>
  <div class="grid"></div>

  <style>
  .grid {
    display: flex;
    flex-flow: row wrap;
    gap: 2px;
  }
  .grid > div {
    min-width: 120px;
    padding: 0.5rem;
    text-align: center;
    border: 1px solid #333;
    border-radius: 4px;
    cursor: pointer;
  }
  ::part(spec-labels) {
    position: absolute;
    right: 0;
  }
  </style>
</html>
*/
