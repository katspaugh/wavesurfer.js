const id = '#waveform';

describe('WaveSurfer Spectrogram plugin tests', () => {

  it('should render a spectrogram', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          url: '../../examples/audio/demo.wav',
          plugins: [win.Spectrogram.create({
            height: 200,
            labels: true,
          })],
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('spectrogram-basic')
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
        win.document.querySelector(id).style.display = 'none';        
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          plugins: [win.Spectrogram.create({
            height: 200,
            labels: true,
          })],
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

  it('should render a spectrogram when initialised with an explicit container', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {

        // Add a container for the spectrogram
        const title = win.document.createElement('h2')
        title.innerText = 'Spectrogram'
        win.document.querySelector("body").appendChild(title)
        const spectrogram = win.document.createElement('div')
        spectrogram.id = 'my_spectrogram'
        spectrogram.innerText = 'Spectrogram will go here'
        win.document.querySelector("body").appendChild(spectrogram)


        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          plugins: [win.Spectrogram.create({
            container: '#my_spectrogram',
            height: 200,
            labels: true,
          })],
        })

        // Load a file and unhide the div
        win.wavesurfer.load('../../examples/audio/demo.wav')
        win.document.querySelector(id).style.display = 'inline-block'

        // Ensure we display the spectrogram successfully
        win.wavesurfer.once('ready', () => {
          cy.get("body").matchImageSnapshot('spectrogram-explicit-container')
          resolve()
        })
      })
    })
  })  
})
