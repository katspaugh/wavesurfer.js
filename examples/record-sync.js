// Record plugin

import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js'

let wavesurfer, record
let scrollingWaveform = false
let continuousWaveform = true

const wavesurfer2 = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',

  // Set a bar width
  barWidth: 2,
  // Optionally, specify the spacing between bars
  barGap: 1,
  // And the bar radius
  barRadius: 2,
})

wavesurfer2.on('ready', function () {
  const createWaveSurfer = () => {
    // Destroy the previous wavesurfer instance
    if (wavesurfer) {
      wavesurfer.destroy()
    }

    // Create a new Wavesurfer instance
    wavesurfer = WaveSurfer.create({
      container: '#mic',
      waveColor: 'rgb(200, 0, 200)',
      progressColor: 'rgb(100, 0, 100)',
    })

    // Initialize the Record plugin
    record = wavesurfer.registerPlugin(
      RecordPlugin.create({
        renderRecordedAudio: false,
        scrollingWaveform,
        continuousWaveform,
        continuousWaveformDuration: wavesurfer2.getDuration(),
      }),
    )

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
    pauseButton.style.display = 'none'
    recButton.textContent = 'Record'

    record.on('record-progress', (time) => {
      updateProgress(time)
    })
  }

  const progress = document.querySelector('#progress')
  const updateProgress = (time) => {
    // time will be in milliseconds, convert it to mm:ss format
    const formattedTime = [
      Math.floor((time % 3600000) / 60000), // minutes
      Math.floor((time % 60000) / 1000), // seconds
    ]
      .map((v) => (v < 10 ? '0' + v : v))
      .join(':')
    progress.textContent = formattedTime
  }

  const pauseButton = document.querySelector('#pause')
  pauseButton.onclick = () => {
    if (record.isPaused()) {
      wavesurfer2.play()
      record.resumeRecording()
      pauseButton.textContent = 'Pause'
      return
    }

    wavesurfer2.pause()
    record.pauseRecording()
    pauseButton.textContent = 'Resume'
  }

  const micSelect = document.querySelector('#mic-select')
  {
    // Mic selection
    RecordPlugin.getAvailableAudioDevices().then((devices) => {
      devices.forEach((device) => {
        const option = document.createElement('option')
        option.value = device.deviceId
        option.text = device.label || device.deviceId
        micSelect.appendChild(option)
      })
    })
  }
  // Record button
  const recButton = document.querySelector('#record')

  recButton.onclick = () => {
    wavesurfer2.play()
    if (record.isRecording() || record.isPaused()) {
      wavesurfer2.pause()
      record.stopRecording()
      recButton.textContent = 'Record'
      pauseButton.style.display = 'none'
      return
    }

    recButton.disabled = true

    // reset the wavesurfer instance

    // get selected device
    const deviceId = micSelect.value
    record.startRecording({ deviceId }).then(() => {
      recButton.textContent = 'Stop'
      recButton.disabled = false
      pauseButton.style.display = 'inline'
    })
  }

  document.querySelector('#scrollingWaveform').onclick = (e) => {
    scrollingWaveform = e.target.checked
    if (continuousWaveform && scrollingWaveform) {
      continuousWaveform = false
      document.querySelector('#continuousWaveform').checked = false
    }
    createWaveSurfer()
  }

  document.querySelector('#continuousWaveform').onclick = (e) => {
    continuousWaveform = e.target.checked
    if (continuousWaveform && scrollingWaveform) {
      scrollingWaveform = false
      document.querySelector('#scrollingWaveform').checked = false
    }
    createWaveSurfer()
  }

  createWaveSurfer()
})

/*
<html>
  <h1 style="margin-top: 0">Press Record to start recording 🎙️</h1>

  <p>
    📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_record.RecordPlugin">Record plugin docs</a>
  </p>

  <button id="record">Record</button>
  <button id="pause" style="display: none;">Pause</button>

  <select id="mic-select">
    <option value="" hidden>Select mic</option>
  </select>

  <label><input type="checkbox" id="scrollingWaveform" /> Scrolling waveform</label>

  <label><input type="checkbox" id="continuousWaveform" checked="checked" /> Continuous waveform</label>

  <p id="progress">00:00</p>

  <div id="mic" style="border-radius: 4px; margin-top: 1rem"></div>

  <div id="recordings" style="margin: 1rem 0"></div>

  <style>
    button {
      min-width: 5rem;
      margin: 1rem 1rem 1rem 0;
    }
  </style>
</html>
*/
