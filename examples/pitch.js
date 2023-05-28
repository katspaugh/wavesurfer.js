import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const pitchWorker = new Worker('/examples/pitch-worker.js', { type: 'module' })

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgba(200, 200, 200, 0.5)',
  progressColor: 'rgba(100, 100, 100, 0.5)',
  url: '/examples/audio/librivox.mp3',
  minPxPerSec: 200,
  sampleRate: 11025,
})

// Pitch detection
wavesurfer.on('decode', () => {
  const peaks = wavesurfer.getDecodedData().getChannelData(0)
  pitchWorker.postMessage({ peaks, sampleRate: wavesurfer.options.sampleRate })
})

// When the worker sends back pitch data, update the UI
pitchWorker.onmessage = (e) => {
  const { frequencies, baseFrequency } = e.data

  // Render the frequencies on a canvas
  const pitchUpColor = '#385587'
  const pitchDownColor = '#C26351'
  const height = 100

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = frequencies.length
  canvas.height = height
  canvas.style.width = '100%'
  canvas.style.height = '100%'

  // Each frequency is a point whose Y position is the frequency and X position is the time
  const pointSize = devicePixelRatio
  let prevY = 0
  frequencies.forEach((frequency, index) => {
    if (!frequency) return
    const y = Math.round(height - (frequency / (baseFrequency * 2)) * height)
    ctx.fillStyle = y > prevY ? pitchDownColor : pitchUpColor
    ctx.fillRect(index, y, pointSize, pointSize)
    prevY = y
  })

  // Add the canvas to the waveform container
  wavesurfer.renderer.getWrapper().appendChild(canvas)
  // Remove the canvas when a new audio is loaded
  wavesurfer.once('load', () => canvas.remove())
}

// Play on click
wavesurfer.on('interaction', () => {
  if (!wavesurfer.isPlaying()) wavesurfer.play()
})

// Drag'n'drop
{
  const dropArea = document.querySelector('#drop')
  dropArea.ondragenter = (e) => {
    e.preventDefault()
    e.target.classList.add('over')
  }
  dropArea.ondragleave = (e) => {
    e.preventDefault()
    e.target.classList.remove('over')
  }
  dropArea.ondragover = (e) => {
    e.preventDefault()
  }
  dropArea.ondrop = (e) => {
    e.preventDefault()
    e.target.classList.remove('over')

    // Read the audio file
    const reader = new FileReader()
    reader.onload = (event) => {
      wavesurfer.load(event.target.result)
    }
    reader.readAsDataURL(e.dataTransfer.files[0])

    // Write the name of the file into the drop area
    dropArea.textContent = e.dataTransfer.files[0].name
    wavesurfer.empty()
  }
  document.body.ondrop = (e) => {
    e.preventDefault()
  }
}

/*
<html>
<style>
#drop {
  height: 128px;
  border: 4px dashed #999;
  margin: 2em 0;
  text-align:center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
#drop.over {
  border-color: #333;
}
</style>

<p align="right">Audio from <a href="https://librivox.org/">LibriVox</a></p>
<div id="waveform"></div>
<div id="drop">Drag-n-drop your own audio file</div>
</html>
*/
