describe('WaveSurfer player', () => {
  it('preserves a seek requested from ready before media can play', () => {
    cy.visit('cypress/e2e/player.html')
    cy.window().its('WaveSurfer').should('exist')

    cy.window().then((win) => {
      return new Cypress.Promise((resolve, reject) => {
        const wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          url: '../../examples/audio/demo.wav',
          peaks: [[0, 0.5, -0.5, 0]],
          duration: 21.77,
        })

        wavesurfer.once('ready', () => {
          const media = wavesurfer.getMediaElement()

          try {
            expect(media.readyState).to.be.lessThan(HTMLMediaElement.HAVE_FUTURE_DATA)
            wavesurfer.setTime(10)
            expect(wavesurfer.getCurrentTime()).to.equal(10)
          } catch (error) {
            reject(error)
            return
          }

          media.addEventListener(
            'canplay',
            async () => {
              try {
                expect(media.currentTime).to.be.closeTo(10, 0.01)
                await wavesurfer.play()
                setTimeout(() => {
                  try {
                    wavesurfer.pause()
                    expect(media.currentTime).to.be.greaterThan(10)
                    resolve()
                  } catch (error) {
                    reject(error)
                  }
                }, 200)
              } catch (error) {
                reject(error)
              }
            },
            { once: true },
          )
        })
      })
    })
  })
})
