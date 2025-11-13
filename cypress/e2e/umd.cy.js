describe('WaveSurfer UMD module tests', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/umd.html')
    cy.window().its('WaveSurfer').should('exist')
  })

  it('should instantiate WaveSurfer with two plugins', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        const { WaveSurfer } = win
        // Handle both direct export and namespace export (for plugins with named exports)
        const Regions = WaveSurfer.Regions.default || WaveSurfer.Regions
        const Timeline = WaveSurfer.Timeline.default || WaveSurfer.Timeline
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          url: '../../examples/audio/demo.wav',
          plugins: [Regions.create(), Timeline.create()],
        })
        resolve()
      })
    })
  })
})
