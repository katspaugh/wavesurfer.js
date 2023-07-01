describe('WaveSurfer UMD module tests', () => {
  beforeEach((done) => {
    cy.visit('cypress/e2e/umd.html')

    cy.window().its('WaveSurfer').should('exist')
    cy.window().its('WaveSurfer.Regions').should('exist')
    cy.window().its('WaveSurfer.Timeline').should('exist')
  })

  it('should instantiate WaveSurfer with two plugins', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        const { WaveSurfer } = win
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          url: '../../examples/audio/demo.wav',
          plugins: [WaveSurfer.Regions.create(), WaveSurfer.Timeline.create()],
        })
      })
    })
  })
})
