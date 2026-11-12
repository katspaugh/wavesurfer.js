describe('Long waveform rendering', () => {
  it('keeps a zoomed waveform visible without color bleeding behind transparent progress', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().its('WaveSurfer').should('exist')

    cy.window().then((win) => {
      const wavesurfer = win.WaveSurfer.create({
        container: '#waveform',
        peaks: [new Float32Array(3600000).fill(0.5)],
        duration: 3600,
        height: 100,
        waveColor: 'red',
        progressColor: 'rgba(0, 0, 0, 0.25)',
        hideScrollbar: true,
      })

      const ready = new Promise((resolve) => wavesurfer.once('ready', resolve))
      cy.wrap(ready).then(() => {
        wavesurfer.zoom(4000)
        wavesurfer.setTime(0)
        wavesurfer.setTime(3500)
        wavesurfer.setOptions({ autoScroll: false })

        cy.wrap(wavesurfer).invoke('getScroll').should('be.greaterThan', 13000000)
        cy.get('#waveform').matchImageSnapshot('long-waveform-transparent-progress')
      })
    })
  })
})
