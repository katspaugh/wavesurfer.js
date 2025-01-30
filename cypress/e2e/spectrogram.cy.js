const id = '#waveform'
const scales = ['linear', 'mel', 'log', 'bark', 'erb']

xdescribe('WaveSurfer Spectrogram plugin tests', () => {
  it('should render a spectrogram', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Spectrogram.create({
              height: 200,
              labels: true,
              scale: 'linear',
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('spectrogram-basic')
          resolve()
        })
      })
    })
  })

  it('should render a spectrogram without labels', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Spectrogram.create({
              height: 200,
              labels: false,
              scale: 'linear',
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('spectrogram-no-labels')
          resolve()
        })
      })
    })
  })

  it('should render a spectrogram when initialised into a hidden div', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        // Hide the wavesurfer div and initialise
        win.document.querySelector(id).style.display = 'none'
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          plugins: [
            win.Spectrogram.create({
              height: 200,
              labels: true,
              scale: 'linear',
            }),
          ],
        })

        // Load a file and unhide the div
        win.wavesurfer.load('../../examples/audio/demo.wav')
        win.document.querySelector(id).style.display = 'inline-block'

        // Ensure we display the spectrogram successfully
        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('spectrogram-unhidden')
          resolve()
        })
      })
    })
  })

  scales.forEach((scale) => {
    it(`should display correct frequency labels with 1kHz tone (${scale})`, () => {
      cy.visit('cypress/e2e/index.html')
      cy.window().then((win) => {
        return new Promise((resolve) => {
          win.wavesurfer = win.WaveSurfer.create({
            container: id,
            height: 200,
            url: '../../examples/audio/1khz.mp3',
            plugins: [
              win.Spectrogram.create({
                height: 200,
                labels: true,
                scale: scale,
                frequencyMin: 0,
                frequencyMax: 4000,
                splitChannels: false,
              }),
            ],
          })

          win.wavesurfer.once('ready', () => {
            cy.get(id).matchImageSnapshot(`spectrogram-1khz-${scale}`)
            resolve()
          })
        })
      })
    })
  })
})
