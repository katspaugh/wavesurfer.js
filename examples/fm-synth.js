// A two-operator FM synth with a real-time waveform

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  cursorColor: 'transparent',
  barWidth: 2,
  interact: false,
})

const audioContext = new AudioContext()

// Create an analyser node
const analyser = audioContext.createAnalyser()
analyser.fftSize = 512 * 2
analyser.connect(audioContext.destination)
const dataArray = new Float32Array(analyser.frequencyBinCount)

function createVoice() {
  // Carrier oscillator
  const carrierOsc = audioContext.createOscillator()
  carrierOsc.type = 'sine'

  // Modulator oscillator
  const modulatorOsc = audioContext.createOscillator()
  modulatorOsc.type = 'sine'

  // Modulation depth
  const modulationGain = audioContext.createGain()

  // Connect the modulator to the carrier frequency
  modulatorOsc.connect(modulationGain)
  modulationGain.connect(carrierOsc.frequency)

  // Create an output gain
  const outputGain = audioContext.createGain()
  outputGain.gain.value = 0

  // Connect carrier oscillator to output
  carrierOsc.connect(outputGain)

  // Connect output to analyser
  outputGain.connect(analyser)

  // Start oscillators
  carrierOsc.start()
  modulatorOsc.start()

  return {
    carrierOsc,
    modulatorOsc,
    modulationGain,
    outputGain,
  }
}

function playNote(frequency, modulationFrequency, modulationDepth, duration) {
  const voice = createVoice()
  const { carrierOsc, modulatorOsc, modulationGain, outputGain } = voice

  carrierOsc.frequency.value = frequency
  modulatorOsc.frequency.value = modulationFrequency
  modulationGain.gain.value = modulationDepth

  outputGain.gain.setValueAtTime(0.00001, audioContext.currentTime)
  outputGain.gain.exponentialRampToValueAtTime(1, audioContext.currentTime + duration / 1000)

  return voice
}

function releaseNote(voice, duration) {
  const { carrierOsc, modulatorOsc, modulationGain, outputGain } = voice
  outputGain.gain.cancelScheduledValues(audioContext.currentTime)
  outputGain.gain.setValueAtTime(1, audioContext.currentTime)
  outputGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration / 1000)

  setTimeout(() => {
    carrierOsc.stop()
    modulatorOsc.stop()
    carrierOsc.disconnect()
    modulatorOsc.disconnect()
    modulationGain.disconnect()
    outputGain.disconnect()
    voice.carrierOsc = null
    voice.modulatorOsc = null
    voice.modulationGain = null
    voice.outputGain = null
  }, duration + 100)
}

function createPianoRoll() {
  const baseFrequency = 110
  const numRows = 4
  const numCols = 10

  const noteFrequency = (row, col) => {
    // The top row is the bass
    // The lower rows represent the notes of a major third chord
    // Columns represent the notes of a C major scale (there are 10 columns and 4 rows)
    const chord = [-8, 0, 4, 7]
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16]
    const note = chord[row] + scale[col]
    return baseFrequency * Math.pow(2, note / 12)
  }

  const pianoRoll = document.getElementById('pianoRoll')
  const qwerty = '1234567890qwertyuiopasdfghjkl;zxcvbnm,./'
  const capsQwerty = '!@#$%^&*()QWERTYUIOPASDFGHJKL:ZXCVBNM<>?'

  const onKeyDown = (freq) => {
    const modulationIndex = parseFloat(document.getElementById('modulationIndex').value)
    const modulationDepth = parseFloat(document.getElementById('modulationDepth').value)
    const duration = parseFloat(document.getElementById('duration').value)
    return playNote(freq, freq * modulationIndex, modulationDepth, duration)
  }

  const onKeyUp = (voice) => {
    const duration = parseFloat(document.getElementById('duration').value)
    releaseNote(voice, duration)
  }

  const createButton = (row, col) => {
    const button = document.createElement('button')
    const key = qwerty[(row * numCols + col) % qwerty.length]
    const capsKey = capsQwerty[(row * numCols + col) % capsQwerty.length]
    const frequency = noteFrequency(row, col)
    let note = null

    button.textContent = key
    pianoRoll.appendChild(button)

    // Mouse
    button.addEventListener('mousedown', (e) => {
      note = onKeyDown(frequency * (e.shiftKey ? numRows : 1))
    })
    button.addEventListener('mouseup', () => {
      if (note) {
        onKeyUp(note)
        note = null
      }
    })

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === key || e.key === capsKey) {
        button.className = 'active'
        if (!note) {
          note = onKeyDown(frequency * (e.shiftKey ? numRows : 1))
        }
      }
    })
    document.addEventListener('keyup', (e) => {
      if (e.key === key || e.key === capsKey) {
        button.className = ''
        if (note) {
          onKeyUp(note)
          note = null
        }
      }
    })
  }

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      createButton(row, col)
    }
  }

  const buttons = document.querySelectorAll('button')
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey) {
      Array.from(buttons).forEach((button, index) => {
        button.textContent = capsQwerty[index]
      })
    }
  })
  document.addEventListener('keyup', (e) => {
    if (!e.shiftKey) {
      Array.from(buttons).forEach((button, index) => {
        button.textContent = qwerty[index]
      })
    }
  })
}

function randomizeFmParams() {
  document.getElementById('modulationIndex').value = Math.random() * 10
  document.getElementById('modulationDepth').value = Math.random() * 200
  document.getElementById('duration').value = Math.random() * 1000
}

// Draw the waveform
function drawWaveform() {
  // Get the waveform data from the analyser
  analyser.getFloatTimeDomainData(dataArray)
  const duration = document.getElementById('duration').valueAsNumber
  waveform && wavesurfer.load('', [dataArray], duration)
}

function animate() {
  requestAnimationFrame(animate)
  drawWaveform()
}

createPianoRoll()
animate()
randomizeFmParams()

/*
<html>
  <style>
    label {
      display: inline-block;
      width: 150px;
    }
    #pianoRoll {
      margin-top: 1em;
      width: 100%;
      display: grid;
      grid-template-columns: repeat(10, 6vw);
      grid-template-rows: repeat(5, 6vw);
      gap: 5px;
      user-select: none;
    }
    button {
      width: 100%;
      height: 100%;
      border: 1px solid #aaa;
      background-color: #fff;
      cursor: pointer;
    }
    button:nth-child(n + 11):nth-child(-n + 20) {
      margin-left: 5px;
    }
    button:nth-child(n + 21):nth-child(-n + 30) {
      margin-left: 10px;
    }
    button:nth-child(n + 31):nth-child(-n + 40) {
      margin-left: 15px;
    }
    button.active,
    button:active {
      background-color: #00f;
      color: #fff;
    }
  </style>
  <div>
    <label>Modulation index:</label>
    <input type="range" min="0.5" max="10" value="2" step="0.5" id="modulationIndex">
  </div>
  <div>
    <label>Modulation depth:</label>
    <input type="range" min="1" max="200" value="50" step="1" id="modulationDepth">
  </div>
  <div>
    <label>Attack/release:</label>
    <input type="range" min="100" max="1000" value="100" step="10" id="duration">
  </div>
  <p>
    Hold Shift to play the notes one octave higher
  </p>
  <div id="pianoRoll"></div>
  <div id="waveform"></div>
</html>
*/
