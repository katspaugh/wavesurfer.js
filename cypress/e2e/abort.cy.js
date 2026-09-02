describe('WaveSurfer abort handling tests', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/index.html')

    cy.window().its('WaveSurfer').should('exist')
  })

  // destroy() is terminal (v8): a post-destroy load() must reject catchably
  // (the v7 record plugin's async onstop could reach this path -- see
  // issue #3637) and emit 'error', never resurrect the instance.
  it('load url after destroyed should reject and emit error', () => {
    cy.window().then((win) => {
      return new Promise((resolve, reject) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
        })

        win.wavesurfer.destroy()

        win.wavesurfer.on('ready', () => reject(new Error('ready must not fire on a destroyed instance')))

        win.wavesurfer.load('../../examples/audio/demo.wav').then(
          () => reject(new Error('load() after destroy must reject')),
          (e) => {
            expect(e.message).to.match(/destroyed/)
            resolve()
          },
        )
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
