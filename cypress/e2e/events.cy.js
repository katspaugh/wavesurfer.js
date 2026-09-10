// Regression test for https://github.com/katspaugh/wavesurfer.js/issues/4360
// (play/pause/finish fired twice in 7.12.x, where the reactive-state event
// bridge re-emitted every event already emitted from the media listeners).
// Exercised in a real browser with real playback -- the unit tests only
// dispatch synthetic media events.
describe('WaveSurfer playback events', () => {
  let wavesurfer

  afterEach(() => {
    wavesurfer?.destroy()
    wavesurfer = undefined
  })

  const waitForEvent = (name) => new Cypress.Promise((resolve) => wavesurfer.once(name, resolve))

  it('emits play, pause and finish exactly once per playback transition', () => {
    cy.visit('cypress/e2e/events.html')
    cy.window().its('WaveSurfer').should('exist')

    const counts = { play: 0, pause: 0, finish: 0 }

    cy.window()
      .then((win) => {
        wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          url: '../../examples/audio/demo.wav',
        })
        for (const name of Object.keys(counts)) {
          wavesurfer.on(name, () => counts[name]++)
        }
        return waitForEvent('ready')
      })
      .then(() => {
        const played = waitForEvent('play')
        wavesurfer.play()
        return played
      })
      .then(() => {
        const paused = waitForEvent('pause')
        wavesurfer.pause()
        return paused
      })
      .then(() => {
        expect(counts).to.deep.equal({ play: 1, pause: 1, finish: 0 })

        // Play the last fraction of a second so the media reaches 'ended'
        const finished = waitForEvent('finish')
        wavesurfer.setTime(wavesurfer.getDuration() - 0.3)
        wavesurfer.play()
        return finished
      })
      .then(() => {
        // Let any duplicate emission queued behind 'ended' drain
        cy.wait(200).then(() => {
          // The media element fires 'pause' before 'ended', so pause is 2
          expect(counts).to.deep.equal({ play: 2, pause: 2, finish: 1 })
        })
      })
  })
})
