const id = '#waveform'

describe('WaveSurfer', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/index.html')

    cy.window().its('WaveSurfer').should('exist')
  })

  it('should use minPxPerSec and hideScrollbar', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          minPxPerSec: 100,
          hideScrollbar: true,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('minPxPerSec-hideScrollbar')
          resolve()
        })
      })
    })
  })

  it('should use barWidth', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          barWidth: 3,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('barWidth')
          resolve()
        })
      })
    })
  })

  it('should use all bar options', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          barWidth: 4,
          barGap: 3,
          barRadius: 4,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('bars')
          resolve()
        })
      })
    })
  })

  it('should use barHeight to scale the waveform vertically', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          barHeight: 2,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('barHeight')
          resolve()
        })
      })
    })
  })

  it('should use color options', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          waveColor: 'red',
          progressColor: 'green',
          cursorColor: 'blue',
        })

        win.wavesurfer.once('ready', () => {
          win.wavesurfer.setTime(10)
          cy.wait(100)
          cy.get(id).matchImageSnapshot('colors')
          resolve()
        })
      })
    })
  })

  it('should use gradient color options', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          waveColor: ['rgb(200, 165, 49)', 'rgb(211, 194, 138)', 'rgb(205, 124, 49)', 'rgb(205, 98, 49)'],
          progressColor: 'rgba(0, 0, 0, 0.25)',
          cursorColor: 'blue',
        })

        win.wavesurfer.once('ready', () => {
          win.wavesurfer.setTime(10)
          cy.wait(100)
          cy.snap
          cy.get(id).matchImageSnapshot('colors-gradient')
          resolve()
        })
      })
    })
  })

  it('should use cursor options', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          cursorColor: 'red',
          cursorWidth: 4,
        })

        win.wavesurfer.once('ready', () => {
          win.wavesurfer.setTime(10)
          cy.wait(100)
          cy.get(id).matchImageSnapshot('cursor')
          resolve()
        })
      })
    })
  })

  it('should not scroll with autoScroll false', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          autoScroll: false,
          minPxPerSec: 200,
          hideScrollbar: true,
        })

        win.wavesurfer.once('ready', () => {
          win.wavesurfer.setTime(10)
          cy.wait(100)
          cy.get(id).matchImageSnapshot('autoScroll-false')
          resolve()
        })
      })
    })
  })

  it('should not scroll to center with autoCenter false', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          autoCenter: false,
          minPxPerSec: 200,
          hideScrollbar: true,
        })

        win.wavesurfer.once('ready', () => {
          win.wavesurfer.setTime(10)
          cy.wait(100)
          cy.get(id).matchImageSnapshot('autoCenter-false')
          resolve()
        })
      })
    })
  })

  it('should use height', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          height: 10,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('height-10')
          resolve()
        })
      })
    })
  })

  it('should use peaks', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          peaks: [
            [
              0, 0.0023595101665705442, 0.012107174843549728, 0.005919494666159153, -0.31324470043182373,
              0.1511787623167038, 0.2473851442337036, 0.11443428695201874, -0.036057762801647186, -0.0968964695930481,
              -0.03033737652003765, 0.10682467371225357, 0.23974689841270447, 0.013210971839725971,
              -0.12377244979143143, 0.046145666390657425, -0.015757400542497635, 0.10884027928113937,
              0.06681904196739197, 0.09432944655418396, -0.17105795443058014, -0.023439358919858932,
              -0.10380347073078156, 0.0034454423002898693, 0.08061369508504868, 0.026129156351089478,
              0.18730352818965912, 0.020447958260774612, -0.15030759572982788, 0.05689578503370285,
              -0.0009095853311009705, 0.2749626338481903, 0.2565386891365051, 0.07571295648813248, 0.10791446268558502,
              -0.06575305759906769, 0.15336275100708008, 0.07056761533021927, 0.03287476301193237, -0.09044631570577621,
              0.01777501218020916, -0.04906218498945236, -0.04756792634725571, -0.006875281687825918,
              0.04520256072282791, -0.02362387254834175, -0.0668797641992569, 0.12266506254673004, -0.10895221680402756,
              0.03791835159063339, -0.0195105392485857, -0.031097881495952606, 0.04252675920724869,
              -0.09187793731689453, 0.0829525887966156, -0.003812957089394331, 0.0431736595928669, 0.07634212076663971,
              -0.05335947126150131, 0.0345163568854332, -0.049201950430870056, 0.02300390601158142,
              0.007677287794649601, 0.015354577451944351, 0.007677287794649601, 0.007677288725972176,
            ],
          ],
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('peaks')
          resolve()
        })
      })
    })
  })

  it('should use external media', () => {
    cy.window().then((win) => {
      const audio = new Audio('../../examples/audio/demo.wav')

      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          media: audio,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('media')
          resolve()
        })
      })
    })
  })

  it('should split channels', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/stereo.mp3',
          splitChannels: true,
          waveColor: 'rgb(200, 0, 200)',
          progressColor: 'rgb(100, 0, 100)',
        })

        win.wavesurfer.once('ready', () => {
          win.wavesurfer.setTime(2)
          cy.wait(100)
          cy.get(id).matchImageSnapshot('split-channels')
          resolve()
        })
      })
    })
  })

  it('should split channels with options', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
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

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('split-channels-options')
          resolve()
        })
      })
    })
  })

  it('should use plugins with Regions', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        const regions = win.Regions.create()

        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          plugins: [regions],
        })

        win.wavesurfer.once('ready', () => {
          regions.addRegion({
            start: 1,
            end: 3,
            color: 'rgba(255, 0, 0, 0.1)',
          })

          cy.get(id).matchImageSnapshot('plugins-regions')
          resolve()
        })
      })
    })
  })

  it('should use two plugins: Regions and Timeline', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        const regions = win.Regions.create()

        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          plugins: [regions, win.Timeline.create()],
        })

        win.wavesurfer.once('ready', () => {
          regions.addRegion({
            start: 1,
            end: 3,
            color: 'rgba(255, 0, 0, 0.1)',
          })

          cy.get(id).matchImageSnapshot('plugins-regions-timeline')
          resolve()
        })
      })
    })
  })

  it('should normalize', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          url: '../../examples/audio/demo.wav',
          normalize: true,
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('normalize')
          resolve()
        })
      })
    })
  })
})
