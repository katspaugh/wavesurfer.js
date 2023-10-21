const id = '#waveform'
const otherId = `#otherWaveform`

describe('WaveSurfer options tests', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/index.html')
    cy.viewport(600, 600)
    cy.window().its('WaveSurfer').should('exist')
  })

  it('should use minPxPerSec and hideScrollbar', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        minPxPerSec: 100,
        hideScrollbar: true,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('minPxPerSec-hideScrollbar')
        done()
      })
    })
  })

  it('should use barWidth', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barWidth: 3,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('barWidth')
        done()
      })
    })
  })

  it('should use all bar options', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barWidth: 4,
        barGap: 3,
        barRadius: 4,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('bars')
        done()
      })
    })
  })

  it('should use barAlign=top to align the waveform vertically', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barAlign: 'top',
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('barAlign-top')
        done()
      })
    })
  })

  it('should use barAlign=bottom to align the waveform vertically', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barAlign: 'bottom',
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('barAlign-bottom')
        done()
      })
    })
  })

  it('should use barAlign and barWidth together', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barAlign: 'bottom',
        barWidth: 4,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('barAlign-barWidth')
        done()
      })
    })
  })

  it('should use barHeight to scale the waveform vertically', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barHeight: 2,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('barHeight')
        done()
      })
    })
  })

  it('should use color options', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        waveColor: 'red',
        progressColor: 'green',
        cursorColor: 'blue',
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setTime(10)
        cy.wait(100)
        cy.get(id).matchImageSnapshot('colors')
        done()
      })
    })
  })

  it('should use gradient color options', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        waveColor: ['rgb(200, 165, 49)', 'rgb(211, 194, 138)', 'rgb(205, 124, 49)', 'rgb(205, 98, 49)'],
        progressColor: 'rgba(0, 0, 0, 0.25)',
        cursorColor: 'blue',
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setTime(10)
        cy.wait(100)
        cy.snap
        cy.get(id).matchImageSnapshot('colors-gradient')
        done()
      })
    })
  })

  it('should use cursor options', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        cursorColor: 'red',
        cursorWidth: 4,
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setTime(10)
        cy.wait(100)
        cy.get(id).matchImageSnapshot('cursor')
        done()
      })
    })
  })

  it('should not scroll with autoScroll false', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        autoScroll: false,
        minPxPerSec: 200,
        hideScrollbar: true,
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setTime(10)
        cy.wait(100)
        cy.get(id).matchImageSnapshot('autoScroll-false')
        done()
      })
    })
  })

  it('should not scroll to center with autoCenter false', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        autoCenter: false,
        minPxPerSec: 200,
        hideScrollbar: true,
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setTime(10)
        cy.wait(100)
        cy.get(id).matchImageSnapshot('autoCenter-false')
        done()
      })
    })
  })

  it('should use peaks', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        peaks: [
          [
            0, 0.0023595101665705442, 0.012107174843549728, 0.005919494666159153, -0.31324470043182373,
            0.1511787623167038, 0.2473851442337036, 0.11443428695201874, -0.036057762801647186, -0.0968964695930481,
            -0.03033737652003765, 0.10682467371225357, 0.23974689841270447, 0.013210971839725971, -0.12377244979143143,
            0.046145666390657425, -0.015757400542497635, 0.10884027928113937, 0.06681904196739197, 0.09432944655418396,
            -0.17105795443058014, -0.023439358919858932, -0.10380347073078156, 0.0034454423002898693,
            0.08061369508504868, 0.026129156351089478, 0.18730352818965912, 0.020447958260774612, -0.15030759572982788,
            0.05689578503370285, -0.0009095853311009705, 0.2749626338481903, 0.2565386891365051, 0.07571295648813248,
            0.10791446268558502, -0.06575305759906769, 0.15336275100708008, 0.07056761533021927, 0.03287476301193237,
            -0.09044631570577621, 0.01777501218020916, -0.04906218498945236, -0.04756792634725571,
            -0.006875281687825918, 0.04520256072282791, -0.02362387254834175, -0.0668797641992569, 0.12266506254673004,
            -0.10895221680402756, 0.03791835159063339, -0.0195105392485857, -0.031097881495952606, 0.04252675920724869,
            -0.09187793731689453, 0.0829525887966156, -0.003812957089394331, 0.0431736595928669, 0.07634212076663971,
            -0.05335947126150131, 0.0345163568854332, -0.049201950430870056, 0.02300390601158142, 0.007677287794649601,
            0.015354577451944351, 0.007677287794649601, 0.007677288725972176,
          ],
        ],
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('peaks')
        done()
      })
    })
  })

  it('should use external media', (done) => {
    cy.window().then((win) => {
      const audio = new Audio('../../examples/audio/demo.wav')

      const wavesurfer = win.WaveSurfer.create({
        container: id,
        media: audio,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('media')
        done()
      })
    })
  })

  it('should split channels', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/stereo.mp3',
        splitChannels: true,
        waveColor: 'rgb(200, 0, 200)',
        progressColor: 'rgb(100, 0, 100)',
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setTime(2)
        cy.wait(100)
        cy.get(id).matchImageSnapshot('split-channels')
        done()
      })
    })
  })

  it('should split channels with options', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/stereo.mp3',
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

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('split-channels-options')
        done()
      })
    })
  })

  it('should use plugins with Regions', (done) => {
    cy.window().then((win) => {
      const regions = win.Regions.create()

      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        plugins: [regions],
      })

      wavesurfer.once('ready', () => {
        regions.addRegion({
          start: 1,
          end: 3,
          color: 'rgba(255, 0, 0, 0.1)',
        })

        cy.get(id).matchImageSnapshot('plugins-regions')
        done()
      })
    })
  })

  it('should use two plugins: Regions and Timeline', (done) => {
    cy.window().then((win) => {
      const regions = win.Regions.create()

      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        plugins: [regions, win.Timeline.create()],
      })

      wavesurfer.once('ready', () => {
        regions.addRegion({
          start: 1,
          end: 3,
          color: 'rgba(255, 0, 0, 0.1)',
        })

        cy.get(id).matchImageSnapshot('plugins-regions-timeline')
        done()
      })
    })
  })

  it('should normalize', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        normalize: true,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('normalize')
        done()
      })
    })
  })

  it('should use height', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        height: 10,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('height-10')
        done()
      })
    })
  })

  it('should use parent height if height is auto', (done) => {
    cy.window().then((win) => {
      win.document.querySelector(id).style.height = '200px'

      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        height: 'auto',
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('height-auto')
        win.document.querySelector(id).style.height = ''
        done()
      })
    })
  })

  it('should fall back to 128 if container height is not set', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        height: 'auto',
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('height-auto-0')
        done()
      })
    })
  })

  it('should use a custom rendering function', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
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

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('custom-render')
        done()
      })
    })
  })

  it('should pass custom parameters to fetch', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        fetchParams: {
          headers: {
            'X-Custom-Header': 'foo',
          },
        },
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('fetch-options')
        done()
      })
    })
  })

  it('should remount the container when set via setOptions', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        barWidth: 4,
        barGap: 3,
        barRadius: 4,
      })

      wavesurfer.once('ready', () => {
        wavesurfer.setOptions({ container: otherId })
        cy.get(id).children().should('have.length', 0)
        cy.get(otherId).children().should('have.length', 1)
        cy.get(otherId).matchImageSnapshot('bars')
        done()
      })
    })
  })

  it('should accept a numeric width option', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        width: 100,
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('width-100')
        wavesurfer.setOptions({ width: 300 })
        cy.get(id).matchImageSnapshot('width-300')
        done()
      })
    })
  })

  it('should accept a CSS value for the width option', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        width: '10rem',
      })

      wavesurfer.once('ready', () => {
        cy.get(id).matchImageSnapshot('width-10rem')
        wavesurfer.setOptions({ width: '200px' })
        cy.get(id).matchImageSnapshot('width-200px')
        done()
      })
    })
  })

  it('should render pre-decoded waveform w/o audio', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        peaks: new Array(512).fill(0.5).map((v, i) => v * Math.sin(i / 16)),
        duration: 12.5,
      })

      expect(wavesurfer.getDuration().toFixed(2)).to.equal('12.50')

      wavesurfer.once('redraw', () => {
        cy.get(id).matchImageSnapshot('pre-decoded-no-audio')
        done()
      })
    })
  })

  it('should support Web Audio playback', (done) => {
    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: id,
        url: '../../examples/audio/demo.wav',
        backend: 'WebAudio',
      })

      wavesurfer.once('ready', () => {
        expect(wavesurfer.getDuration().toFixed(2)).to.equal('21.77')
        wavesurfer.setTime(10)
        expect(wavesurfer.getCurrentTime().toFixed(2)).to.equal('10.00')
        wavesurfer.setTime(21.6)
        wavesurfer.play()
      })

      wavesurfer.once('finish', () => {
        done()
      })
    })
  })
})
