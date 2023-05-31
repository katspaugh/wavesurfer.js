// Custom rendering function

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

const wavesurfer = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/demo.wav',

  /**
   * Render a waveform as a squiggly line
   * @see https://css-tricks.com/making-an-audio-waveform-visualizer-with-vanilla-javascript/
   */
  renderFunction: (channels, ctx) => {
    const { width, height } = ctx.canvas
    const scale = channels[0].length / width
    const step = 10

    ctx.translate(0, height / 2)
    ctx.strokeStyle = ctx.fillStyle
    ctx.beginPath()

    for (let i = 0; i < width; i += step * 2) {
      const index = Math.floor(i * scale)
      const value = Math.abs(channels[0][index])
      let x = i
      let y = value * height

      ctx.moveTo(x, 0)
      ctx.lineTo(x, y)
      ctx.arc(x + step / 2, y, step / 2, Math.PI, 0, true)
      ctx.lineTo(x + step, 0)

      x = x + step
      y = -y
      ctx.moveTo(x, 0)
      ctx.lineTo(x, y)
      ctx.arc(x + step / 2, y, step / 2, Math.PI, 0, false)
      ctx.lineTo(x + step, 0)
    }

    ctx.stroke()
    ctx.closePath()
  },
})

wavesurfer.on('interaction', () => {
  wavesurfer.play()
})
