describe('WaveSurfer error handling tests', () => {
  it('should fire error event if provided file url does not exist', () => {
    cy.visit('cypress/e2e/index.html')

    cy.window().its('WaveSurfer').should('exist')

    cy.window().then((win) => {
      return new Promise((resolve, reject) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
          url: '../../examples/audio/DOES_NOT_EXIST.wav',
        })

        win.wavesurfer.on('error', () => {
          console.log('error event fired')
          resolve()
        })
      })
    })
  })
})
