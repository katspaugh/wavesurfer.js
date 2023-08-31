// Record plugin

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js'
import RecordPlugin from 'https://unpkg.com/wavesurfer.js@7/dist/plugins/record.esm.js'

// Create an instance of WaveSurfer
const wavesurfer = WaveSurfer.create({
  container: '#mic',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
})

// Initialize the Record plugin
const record = wavesurfer.registerPlugin(RecordPlugin.create())

// Render recorded audio
record.on('record-end', (blob) => {
  const container = document.querySelector('#recordings')
  const recordedUrl = URL.createObjectURL(blob)

  // Create wavesurfer from the recorded audio
  const wavesurfer = WaveSurfer.create({
    container,
    waveColor: 'rgb(200, 100, 0)',
    progressColor: 'rgb(100, 50, 0)',
    url: recordedUrl,
  })

  // Play button
  const button = container.appendChild(document.createElement('button'))
  button.textContent = 'Play'
  button.onclick = () => wavesurfer.playPause()
  wavesurfer.on('pause', () => (button.textContent = 'Play'))
  wavesurfer.on('play', () => (button.textContent = 'Pause'))

  // Download link
  const link = container.appendChild(document.createElement('a'))
  Object.assign(link, {
    href: recordedUrl,
    download: 'recording.' + blob.type.split(';')[0].split('/')[1] || 'webm',
    textContent: 'Download recording',
  })
})

{
  // Record button
  const recButton = document.querySelector('#record')

  recButton.onclick = () => {
    if (record.isRecording()) {
      record.stopRecording()
      recButton.textContent = 'Record'
      return
    }

    recButton.disabled = true

    record.startRecording().then(() => {
      recButton.textContent = 'Stop'
      recButton.disabled = false
    })
  }
}

/*
<html>
  <h1 style="margin-top: 0">Press Record to start recording 🎙️</h1>

  <p>
    📖 <a href="https://wavesurfer-js.org/docs/classes/plugins_record.RecordPlugin">Record plugin docs</a>
  </p>

  <button id="record">Record</button>

  <div id="mic" style="border: 1px solid #ddd; border-radius: 4px; margin-top: 1rem"></div>

  <div id="recordings" style="margin: 1rem 0"></div>

  <style>
    button {
      min-width: 5rem;
      margin: 1rem 1rem 1rem 0;
    }
  </style>
</html>
*/
