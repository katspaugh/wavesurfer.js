// All wavesurfer options in one place

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const audio = new Audio()
audio.controls = true
audio.style.width = '100%'
document.body.appendChild(audio)

const options = {
  /** HTML element or CSS selector (required) */
  container: 'body',
  /** The height of the waveform in pixels */
  height: 128,
  /** Render each audio channel as a separate waveform */
  splitChannels: false,
  /** Stretch the waveform to the full height */
  normalize: false,
  /** The color of the waveform */
  waveColor: '#ff4e00',
  /** The color of the progress mask */
  progressColor: '#dd5e98',
  /** The color of the playpack cursor */
  cursorColor: '#ddd5e9',
  /** The cursor width */
  cursorWidth: 2,
  /** Render the waveform with bars like this: ▁ ▂ ▇ ▃ ▅ ▂ */
  barWidth: NaN,
  /** Spacing between bars in pixels */
  barGap: NaN,
  /** Rounded borders for bars */
  barRadius: NaN,
  /** A vertical scaling factor for the waveform */
  barHeight: NaN,
  /** Minimum pixels per second of audio (i.e. zoom level) */
  minPxPerSec: 1,
  /** Stretch the waveform to fill the container, true by default */
  fillParent: true,
  /** Audio URL */
  url: '/examples/audio/audio.wav',
  /** Pre-computed audio data */
  peaks: undefined,
  /** Pre-computed duration */
  duration: undefined,
  /** Use an existing media element instead of creating one */
  media: audio,
  /** Play the audio on load */
  autoplay: false,
  /** Pass false to disable clicks on the waveform */
  interact: true,
  /** Hide the scrollbar */
  hideScrollbar: false,
  /** Audio rate */
  audioRate: 1,
  /** Automatically scroll the container to keep the current position in viewport */
  autoScroll: true,
  /** If autoScroll is enabled, keep the cursor in the center of the waveform during playback */
  autoCenter: true,
  /** Decoding sample rate. Doesn't affect the playback. Defaults to 8000 */
  sampleRate: 8000,
}

const wavesurfer = WaveSurfer.create(options)

wavesurfer.on('ready', () => {
  wavesurfer.setTime(10)
})

// Generate a form input for each option
const schema = {
  height: {
    value: 128,
    min: 10,
    max: 512,
    step: 1,
  },
  cursorWidth: {
    value: 1,
    min: 0,
    max: 10,
    step: 1,
  },
  minPxPerSec: {
    value: 1,
    min: 1,
    max: 1000,
    step: 1,
  },
  barWidth: {
    value: 0,
    min: 1,
    max: 30,
    step: 1,
  },
  barHeight: {
    value: 1,
    min: 0.1,
    max: 4,
    step: 0.1,
  },
  barGap: {
    value: 0,
    min: 1,
    max: 30,
    step: 1,
  },
  peaks: {
    type: 'json',
  },
  audioRate: {
    value: 1,
    min: 0.1,
    max: 4,
    step: 0.1,
  },
  sampleRate: {
    value: 8000,
    min: 8000,
    max: 48000,
    step: 1000,
  },
}

const form = document.createElement('form')
Object.assign(form.style, {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1rem',
})
document.body.appendChild(form)

for (const key in options) {
  if (options[key] === undefined) continue
  const isColor = key.includes('Color')

  const label = document.createElement('label')
  Object.assign(label.style, {
    display: 'flex',
    alignItems: 'center',
  })

  const span = document.createElement('span')
  Object.assign(span.style, {
    textTransform: 'capitalize',
    width: '7em',
  })
  span.textContent = `${key.replace(/[a-z0-9](?=[A-Z])/g, '$& ')}: `
  label.appendChild(span)

  const input = document.createElement('input')
  const type = typeof options[key]
  Object.assign(input, {
    type: isColor ? 'color' : type === 'number' ? 'range' : type === 'boolean' ? 'checkbox' : 'text',
    name: key,
    value: options[key],
    checked: options[key] === true,
  })
  if (input.type === 'text') input.style.flex = 1
  if (options[key] instanceof HTMLElement) input.disabled = true

  if (schema[key]) {
    Object.assign(input, schema[key])
  }

  label.appendChild(input)
  form.appendChild(label)

  input.oninput = () => {
    if (type === 'number') {
      options[key] = input.valueAsNumber
    } else if (type === 'boolean') {
      options[key] = input.checked
    } else if (schema[key] && schema[key].type === 'json') {
      options[key] = JSON.parse(input.value)
    } else {
      options[key] = input.value
    }
    wavesurfer.setOptions(options)
    textarea.value = JSON.stringify(options, null, 2)
  }
}

const textarea = document.createElement('textarea')
Object.assign(textarea.style, {
  width: '100%',
  height: Object.keys(options).length + 1 + 'rem',
})
textarea.value = JSON.stringify(options, null, 2)
textarea.readOnly = true
form.appendChild(textarea)
