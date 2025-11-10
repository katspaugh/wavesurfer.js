describe('WaveSurfer abort handling tests', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/index.html')

    cy.window().its('WaveSurfer').should('exist')
  })

  // https://github.com/katspaugh/wavesurfer.js/issues/3637
  // v8.0.0 breaking change: load() after destroy() is no longer supported
  it('load url after destroyed should throw error', () => {
    cy.window().then(async (win) => {
      win.wavesurfer = win.WaveSurfer.create({
        container: '#waveform',
        height: 200,
        waveColor: 'rgb(200, 200, 0)',
        progressColor: 'rgb(100, 100, 0)',
      })

      win.wavesurfer.destroy()

      // Should reject with error (load is async)
      try {
        await win.wavesurfer.load('../../examples/audio/demo.wav')
        throw new Error('Expected load() to throw an error')
      } catch (err) {
        expect(err.message).to.include('Cannot call load() on a destroyed WaveSurfer instance')
      }
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
