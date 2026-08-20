describe('WaveSurfer player', () => {
  let wavesurfer
  let media

  afterEach(() => {
    wavesurfer?.destroy()
    wavesurfer = undefined
    media = undefined
  })

  it('preserves a seek requested from ready before media can play', () => {
    cy.visit('cypress/e2e/player.html')
    cy.window().its('WaveSurfer').should('exist')

    cy.window()
      .then((win) => {
        return new Cypress.Promise((resolve, reject) => {
          wavesurfer = win.WaveSurfer.create({
            container: '#waveform',
            url: '../../examples/audio/demo.wav',
            peaks: [[0, 0.5, -0.5, 0]],
            duration: 21.77,
          })

          wavesurfer.once('ready', () => {
            media = wavesurfer.getMediaElement()
            const onCanPlay = () => {
              try {
                expect(media.currentTime).to.be.closeTo(10, 0.01)
                resolve()
              } catch (error) {
                reject(error)
              }
            }

            media.addEventListener('canplay', onCanPlay, { once: true })

            try {
              expect(media.readyState).to.be.lessThan(HTMLMediaElement.HAVE_FUTURE_DATA)
              wavesurfer.setTime(10)
              expect(wavesurfer.getCurrentTime()).to.equal(10)
            } catch (error) {
              media.removeEventListener('canplay', onCanPlay)
              reject(error)
            }
          })
        })
      })
      .then(() => {
        return wavesurfer.play()
      })
      .then(() => {
        cy.wrap(null, { timeout: 5000 }).should(() => {
          expect(media.currentTime).to.be.greaterThan(10)
        })
      })
  })
})
