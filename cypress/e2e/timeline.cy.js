// A top timeline (insertPosition: 'beforebegin') reserves its own space above the waveform. These
// are layout assertions on real bounding boxes: jsdom does no layout, so the unit tests can't tell
// whether the timeline actually clears the waveform (#3551).

const id = '#waveform'

// High peaks, as in the original report: the waveform reaches the very top of its area
const peaks = [[0.1, 1]]

const wrapReady = (wavesurfer, event = 'ready') => {
  const waitForReady = new Promise((resolve) => {
    wavesurfer.once(event, resolve)
  })
  return cy.wrap(waitForReady)
}

// The vertical layout of the player in whole pixels. The container (#waveform) is not the shadow
// host: the host is the div wavesurfer adds inside it, and everything below lives in its shadow root.
const measure = (win) => {
  const host = win.document.querySelector(`${id} > div`)
  const root = host.shadowRoot
  const box = (el) => {
    const { top, bottom } = el.getBoundingClientRect()
    return { top: Math.round(top), bottom: Math.round(bottom) }
  }
  const timelines = Array.from(root.querySelectorAll('[part="timeline"]'))
  return {
    host: box(host),
    waveform: box(root.querySelector('.canvases canvas')),
    topTimelines: timelines.filter((el) => el.style.position === 'absolute').map(box),
    bottomTimelines: timelines.filter((el) => el.style.position === 'relative').map(box),
  }
}

// Measures and asserts, retrying until the assertions hold: layout can settle a frame after the
// event that causes it, and the first canvas may not be there yet right after 'ready'.
const shouldMeasure = (assertions) => cy.window().should((win) => assertions(measure(win)))

describe('Timeline layout', () => {
  beforeEach(() => {
    cy.visit('cypress/e2e/index.html')
    cy.window().its('WaveSurfer').should('exist')
    cy.window().its('Timeline').should('exist')
  })

  const create = (win, plugins) =>
    win.WaveSurfer.create({
      container: id,
      url: '../../examples/audio/audio.wav',
      peaks,
      plugins,
    })

  // A style rule the page might use on the public ::part(scroll) styling surface
  const addPageStyle = (css) =>
    cy.document().then((doc) => {
      const style = doc.createElement('style')
      style.textContent = css
      doc.head.appendChild(style)
    })

  it('puts a top timeline above the waveform instead of over it', () => {
    cy.window().then((win) => {
      const wavesurfer = create(win, [win.Timeline.create({ height: 20, insertPosition: 'beforebegin' })])

      wrapReady(wavesurfer).then(() => {
        shouldMeasure(({ host, waveform, topTimelines }) => {
          expect(topTimelines).to.have.length(1)
          const [timeline] = topTimelines
          // Sits inside its own player, directly above the waveform, without overlapping it
          expect(timeline.top).to.equal(host.top)
          expect(timeline.bottom).to.be.at.most(waveform.top)
          expect(waveform.top - timeline.top).to.equal(20)
        })
      })
    })
  })

  it('still puts a bottom timeline below the waveform', () => {
    cy.window().then((win) => {
      const wavesurfer = create(win, [
        win.Timeline.create({ height: 20, insertPosition: 'beforebegin' }),
        win.Timeline.create({ height: 20 }),
      ])

      wrapReady(wavesurfer).then(() => {
        shouldMeasure(({ host, waveform, topTimelines, bottomTimelines }) => {
          expect(topTimelines).to.have.length(1)
          expect(bottomTimelines).to.have.length(1)
          expect(topTimelines[0].bottom).to.be.at.most(waveform.top)
          expect(bottomTimelines[0].top).to.be.at.least(waveform.bottom)
          expect(bottomTimelines[0].bottom).to.equal(host.bottom)
        })
      })
    })
  })

  it('stacks several top timelines and closes up when the first one is destroyed', () => {
    cy.window().then((win) => {
      const first = win.Timeline.create({ height: 20, insertPosition: 'beforebegin' })
      const second = win.Timeline.create({ height: 10, insertPosition: 'beforebegin' })
      const wavesurfer = create(win, [first, second])

      wrapReady(wavesurfer).then(() => {
        shouldMeasure(({ host, waveform, topTimelines }) => {
          expect(topTimelines).to.have.length(2)
          expect(waveform.top - host.top).to.equal(30)
          topTimelines.forEach((timeline) => expect(timeline.bottom).to.be.at.most(waveform.top))
        })

        // Destroy the one registered first: the survivor must sit right against the waveform again
        cy.then(() => first.destroy())
        shouldMeasure(({ host, waveform, topTimelines }) => {
          expect(topTimelines).to.have.length(1)
          expect(topTimelines[0].top).to.equal(host.top)
          expect(topTimelines[0].bottom).to.equal(waveform.top)
          expect(waveform.top - host.top).to.equal(10)
        })
      })
    })
  })

  it('keeps padding a page sets on the scroll container through ::part(scroll)', () => {
    addPageStyle(`${id} > div::part(scroll) { padding-top: 8px }`)

    cy.window().then((win) => {
      const wavesurfer = create(win, [win.Timeline.create({ height: 20, insertPosition: 'beforebegin' })])

      wrapReady(wavesurfer).then(() => {
        shouldMeasure(({ host, waveform, topTimelines }) => {
          const [timeline] = topTimelines
          // The page's own 8px stays above the timeline, which still clears the waveform
          expect(timeline.top - host.top).to.equal(8)
          expect(timeline.bottom).to.be.at.most(waveform.top)
          expect(waveform.top - timeline.top).to.equal(20)
        })
      })
    })
  })

  it('follows a page padding that changes with the viewport', () => {
    addPageStyle(`
      ${id} > div::part(scroll) { padding-top: 8px }
      @media (max-width: 500px) { ${id} > div::part(scroll) { padding-top: 24px } }
    `)

    cy.window().then((win) => {
      const wavesurfer = create(win, [win.Timeline.create({ height: 20, insertPosition: 'beforebegin' })])

      wrapReady(wavesurfer).then(() => {
        shouldMeasure(({ host, topTimelines }) => expect(topTimelines[0].top - host.top).to.equal(8))

        // The container is a fixed width, so only the window's resize event tells the plugin
        cy.viewport(400, 600)
        shouldMeasure(({ host, waveform, topTimelines }) => {
          expect(topTimelines[0].top - host.top).to.equal(24)
          expect(topTimelines[0].bottom).to.be.at.most(waveform.top)
        })
      })
    })
  })
})
