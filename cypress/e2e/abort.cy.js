describe('WaveSurfer abort handling tests', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/index.html')

    cy.window().its('WaveSurfer').should('exist')
  })

  // https://github.com/katspaugh/wavesurfer.js/issues/3637
  it('load url after destroyed should emit ready', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
        })

        win.wavesurfer.destroy()

        win.wavesurfer.load('../../examples/audio/demo.wav')

        win.wavesurfer.on('ready', resolve)
      })
    })
  })

  it('destroy before wavesurfer ready should throw AbortError Exception', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
        })

        // catch load error
        win.wavesurfer.load('../../examples/audio/demo.wav').catch((e) => {
          expect(e.name).to.equal('AbortError')
          expect(e.message).to.match(/aborted/)
          resolve()
        })

        win.wavesurfer.destroy()
      })
    })
  })

  it('destroy before wavesurfer ready should emit AbortError Exception', () => {
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
        })

        win.wavesurfer.load('../../examples/audio/demo.wav').catch(() => {})

        win.wavesurfer.destroy()

        // listening wavesurfer emit error event
        win.wavesurfer.on('error', (e) => {
          expect(e.name).to.equal('AbortError')
          expect(e.message).to.match(/aborted/)
          resolve()
        })
      })
    })
  })
})
