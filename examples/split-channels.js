// Split channels

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  url: '/examples/audio/stereo.mp3',
  splitChannels: [
    {
      waveColor: 'rgb(200, 0, 200)',
      progressColor: 'rgb(100, 0, 100)',
    },
    {
      waveColor: 'rgb(0, 200, 200)',
      progressColor: 'rgb(0, 100, 100)',
    },
  ],
})

wavesurfer.on('interaction', () => {
  wavesurfer.play()
})
