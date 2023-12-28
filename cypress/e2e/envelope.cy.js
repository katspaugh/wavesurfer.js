const id = '#waveform'

describe('WaveSurfer Envelope plugin tests', () => {
  it('should render an envelope', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Envelope.create({
              volume: 0.8,
              lineColor: 'rgba(255, 0, 0, 0.5)',
              lineWidth: 4,
              dragPointSize: 20,
              dragLine: false,
              dragPointFill: 'rgba(0, 255, 255, 0.8)',
              dragPointStroke: 'rgba(0, 0, 0, 0.5)',

              points: [
                { time: 11.2, volume: 0.5 },
                { time: 15.5, volume: 0.8 },
              ],
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('envelope-basic')
          resolve()
        })
      })
    })
  })

  xit('should render an envelope and add a point', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        const envelopePlugin = win.Envelope.create({
          volume: 0.5,
          lineColor: 'rgba(255, 0, 0, 0.5)',
          lineWidth: 10,
          dragPointSize: 12,
          dragLine: true,
          dragPointFill: 'rgba(0, 255, 255, 0.8)',
          dragPointStroke: 'rgba(0, 0, 0, 0.5)',

          points: [
            { time: 12.2, volume: 0.4 },
            { time: 16.5, volume: 0.9 },
          ],
        })

        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 200,
          url: '../../examples/audio/demo.wav',
          plugins: [envelopePlugin],
        })

        envelopePlugin.addPoint({ id: 'new-point', time: 10.1, volume: 0.6 })

        win.wavesurfer.once('ready', () => {
          cy.get(id).matchImageSnapshot('envelope-add-point')
          resolve()
        })
      })
    })
  })
})
