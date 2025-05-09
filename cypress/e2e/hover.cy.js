const id = '#waveform'

describe('WaveSurfer Hover plugin tests', () => {
  it('should render a label to the right with labelPreferLeft=false', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 500,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Hover.create({
              labelSize: '72px',
              labelPreferLeft: false,
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          // Move the mouse to the center of the container
          cy.get(id).trigger('pointermove', 'center')

          // Verify that the label got drawn on the right
          cy.wait(100)
          cy.get(id).matchImageSnapshot('hover-prefer-left-false')
          resolve()
        })
      })
    })
  })

  it('should render a label to the left with labelPreferLeft=false when near to the right edge', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 500,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Hover.create({
              labelSize: '72px',
              labelPreferLeft: false,
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          // Move the mouse to the right of the container
          cy.get(id).trigger('pointermove', 'right')

          // Verify that the label got drawn on the left
          cy.wait(100)
          cy.get(id).matchImageSnapshot('hover-prefer-left-false-near-right-edge')
          resolve()
        })
      })
    })
  })

  it('should render a label to the left with labelPreferLeft=true', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 500,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Hover.create({
              labelSize: '72px',
              labelPreferLeft: true,
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          // Move the mouse to the center of the container
          cy.get(id).trigger('pointermove', 'center')

          // Verify that the label got drawn on the left
          cy.wait(100)
          cy.get(id).matchImageSnapshot('hover-prefer-left-true')
          resolve()
        })
      })
    })
  })

  it('should render a label to the right with labelPreferLeft=true when near to the left edge', () => {
    cy.visit('cypress/e2e/index.html')
    cy.window().then((win) => {
      return new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: id,
          height: 500,
          url: '../../examples/audio/demo.wav',
          plugins: [
            win.Hover.create({
              labelSize: '72px',
              labelPreferLeft: true,
            }),
          ],
        })

        win.wavesurfer.once('ready', () => {
          // Move the mouse to the center of the container
          cy.get(id).trigger('pointermove', 'left')

          // Verify that the label got drawn on the right
          cy.wait(100)
          cy.get(id).matchImageSnapshot('hover-prefer-left-true-near-left-edge')
          resolve()
        })
      })
    })
  })
})
