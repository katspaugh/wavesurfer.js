// Waveform for a video

// Create a video element
/*
<html>
  <video
    src="/examples/audio/modular.mp4"
    controls
    playsinline
    style="width: 100%; max-width: 600px; margin: 0 auto; display: block;"
  />
</html>
*/

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

// Initialize wavesurfer.js
const ws = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  // Pass the video element in the `media` param
  media: document.querySelector('video'),
})
