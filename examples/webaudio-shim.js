import WaveSurfer from 'wavesurfer.js'
import WebAudioPlayer from 'wavesurfer.js/dist/webaudio.js'

const webAudioPlayer = new WebAudioPlayer()
webAudioPlayer.src = '/examples/audio/audio.wav'

webAudioPlayer.addEventListener('loadedmetadata', () => {
  const wavesurfer = WaveSurfer.create({
    container: document.body,
    media: webAudioPlayer,
    peaks: webAudioPlayer.getChannelData(),
    duration: webAudioPlayer.duration,
  })

  wavesurfer.on('click', () => {
    wavesurfer.play()
  })
})
