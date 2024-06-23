describe('WaveSurfer basic tests', () => {
  beforeEach((done) => {
    cy.visit('cypress/e2e/index.html')

    cy.window().its('WaveSurfer').should('exist')

    cy.window().then((win) => {
      const waitForReady = new Promise((resolve) => {
        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
          url: '../../examples/audio/demo.wav',
        })

        win.wavesurfer.once('ready', () => resolve())
      })

      cy.wrap(waitForReady).then(done)
    })
  })

  it('should instantiate WaveSurfer without errors', () => {
    cy.window().its('wavesurfer').should('be.an', 'object')
  })

  it('should emit a redrawcomplete event', () => {
    cy.window().then((win) => {
      const { wavesurfer } = win
      expect(wavesurfer.getDuration().toFixed(2)).to.equal('21.77')

      wavesurfer.options.minPxPerSec = 200
      wavesurfer.load('../../examples/audio/audio.wav')

      return new Promise((resolve) => {
        wavesurfer.once('redrawcomplete', () => {
          wavesurfer.zoom(100)
          wavesurfer.once('redrawcomplete', () => {
            resolve()
          })
        })
      })
    })
  })

  it('should load an audio file without errors', () => {
    cy.window().then((win) => {
      expect(win.wavesurfer.getDuration().toFixed(2)).to.equal('21.77')

      win.wavesurfer.load('../../examples/audio/audio.wav')

      return new Promise((resolve) => {
        win.wavesurfer.once('ready', () => {
          expect(win.wavesurfer.getDuration().toFixed(2)).to.equal('26.39')
          resolve()
        })
      })
    })
  })

  it('should catch fetch errors', () => {
    cy.window().then((win) => {
      return win.wavesurfer.load('../../examples/audio/audio.w1av').catch((e) => {
        expect(e.message).to.equal('Failed to fetch ../../examples/audio/audio.w1av: 404 (Not Found)')
      })
    })
  })

  it('should play and pause audio', () => {
    cy.window().then((win) => {
      expect(win.wavesurfer.getCurrentTime()).to.equal(0)

      win.wavesurfer.play()

      cy.wait(1000).then(() => {
        expect(win.wavesurfer.isPlaying()).to.be.true

        win.wavesurfer.pause()

        expect(win.wavesurfer.getCurrentTime()).to.be.greaterThan(0)
      })
    })
  })

  it('should set and get volume without errors', () => {
    cy.window().then((win) => {
      win.wavesurfer.setVolume(0.5)
      expect(win.wavesurfer.getVolume()).to.equal(0.5)
    })
  })

  it('should set and get muted state without errors', () => {
    cy.window().then((win) => {
      win.wavesurfer.setMuted(true)
      expect(win.wavesurfer.getMuted()).to.be.true
    })
  })

  it('should set and get playback rate without errors', () => {
    cy.window().then((win) => {
      win.wavesurfer.setPlaybackRate(1.5)
      expect(win.wavesurfer.getPlaybackRate()).to.equal(1.5)
    })
  })

  it('should seek to a time in seconds', () => {
    cy.window().then((win) => {
      win.wavesurfer.setTime(10.1)
      expect(win.wavesurfer.getCurrentTime()).to.equal(10.1)
      expect(win.wavesurfer.getScroll()).to.equal(0) // no scroll
    })
  })

  it('should set the zoom level', () => {
    cy.window().then((win) => {
      const initialWidth = win.wavesurfer.getWrapper().clientWidth

      win.wavesurfer.zoom(200)
      const zoomedWidth = win.wavesurfer.renderer.getWrapper().clientWidth
      expect(zoomedWidth).to.be.greaterThan(initialWidth)
      win.wavesurfer.zoom(600)
      const newWidth = win.wavesurfer.getWrapper().clientWidth

      expect(Math.round(newWidth / zoomedWidth)).to.equal(3)
    })
  })

  it('should scroll on seek if zoomed in', () => {
    cy.window().then((win) => {
      win.wavesurfer.zoom(300)
      const zoomedWidth = win.wavesurfer.getWrapper().clientWidth
      win.wavesurfer.zoom(600)
      const newWidth = win.wavesurfer.getWrapper().clientWidth

      expect(Math.round(newWidth / zoomedWidth)).to.equal(2)

      win.wavesurfer.setTime(20)

      cy.wait(1000).then(() => {
        expect(win.wavesurfer.getScroll()).to.be.greaterThan(100)
      })
    })
  })

  it('should scroll on setScrollTime if zoomed in', () => {
    cy.window().then((win) => {
      win.wavesurfer.zoom(300)
      const zoomedWidth = win.wavesurfer.getWrapper().clientWidth
      win.wavesurfer.zoom(600)
      const newWidth = win.wavesurfer.getWrapper().clientWidth

      expect(Math.round(newWidth / zoomedWidth)).to.equal(2)

      win.wavesurfer.setScrollTime(20)

      cy.wait(1000).then(() => {
        expect(win.wavesurfer.getScroll()).to.be.greaterThan(100)
      })
    })
  })

  it('should export decoded audio data', () => {
    cy.window().then((win) => {
      const data = win.wavesurfer.getDecodedData()

      expect(data.getChannelData).to.be.a('function')
      expect(data.length).to.equal(174191)
      expect(data.sampleRate).to.equal(8000)
      expect(data.duration.toFixed(2)).to.equal('21.77')
    })
  })

  it('should not fill the container if fillParent is false', () => {
    cy.window().then((win) => {
      win.wavesurfer.setOptions({
        fillParent: false,
        minPxPerSec: 10,
      })
      expect(win.document.querySelector('#waveform').clientWidth).to.greaterThan(
        win.wavesurfer.getWrapper().clientWidth,
      )
    })
  })

  it('should export peaks', () => {
    cy.window().then((win) => {
      const peaks = win.wavesurfer.exportPeaks({
        channels: 2,
        maxLength: 1000,
        precision: 100,
      })
      expect(peaks.length).to.equal(1) // the file is mono
      expect(peaks[0].length).to.equal(1000)
      expect(peaks[0][0]).to.equal(0.01)
      expect(peaks[0][99]).to.equal(0.3)
      expect(peaks[0][100]).to.equal(0.31)

      const peaksB = win.wavesurfer.exportPeaks({
        maxLength: 1000,
        precision: 1000,
      })
      expect(peaksB.length).to.equal(1)
      expect(peaksB[0].length).to.equal(1000)
      expect(peaksB[0][0]).to.equal(0.015)
      expect(peaksB[0][99]).to.equal(0.296)
      expect(peaksB[0][100]).to.equal(0.308)

      const peaksC = win.wavesurfer.exportPeaks()
      expect(peaksC.length).to.equal(1)
      expect(peaksC[0].length).to.equal(8000)
      expect(peaksC[0][0]).to.equal(0.0117)
      expect(peaksC[0][99]).to.equal(0.0076)
      expect(peaksC[0][100]).to.equal(0.01)
    })
  })

  describe('exportImage', () => {
    it('should export an image as a data-URI', () => {
      cy.window()
        .then((win) => {
          return win.wavesurfer.exportImage()
        })
        .then((data) => {
          expect(data[0]).to.match(/^data:image\/png;base64,/)
        })
    })

    it('should export an image as a JPEG data-URI', () => {
      cy.window()
        .then((win) => {
          return win.wavesurfer.exportImage('image/jpeg', 0.75)
        })
        .then((data) => {
          expect(data[0]).to.match(/^data:image\/jpeg;base64,/)
        })
    })

    it('should export an image as a blob', () => {
      cy.window()
        .then((win) => {
          return win.wavesurfer.exportImage('image/webp', 0.75, 'blob')
        })
        .then((data) => {
          expect(data[0]).to.be.a('blob')
        })
    })
  })

  it('should destroy wavesurfer', () => {
    cy.window().then((win) => {
      win.wavesurfer.destroy()
    })
  })

  describe('setMediaElement', () => {
    // Mock add/remove event listeners for `media` elements
    const attachMockListeners = (el) => {
      el.eventCount = 0

      const addEventListener = el.addEventListener
      el.addEventListener = (eventName, callback, options) => {
        if (!options || !options.once) el.eventCount++
        addEventListener.call(el, eventName, callback, options)
      }
      const removeEventListener = el.removeEventListener
      el.removeEventListener = (eventName, callback) => {
        el.eventCount--
        removeEventListener.call(el, eventName, callback)
      }
    }

    beforeEach((done) => {
      cy.window().then((win) => {
        win.wavesurfer.destroy()

        const originalMedia = document.createElement('audio')
        attachMockListeners(originalMedia)

        win.wavesurfer = win.WaveSurfer.create({
          container: '#waveform',
          url: '../../examples/audio/demo.wav',
          media: originalMedia,
        })

        win.wavesurfer.once('ready', () => done())
      })
    })

    it('should set media without errors', () => {
      cy.window().then((win) => {
        const media = document.createElement('audio')
        media.id = 'new-media'
        win.wavesurfer.setMediaElement(media)
        expect(win.wavesurfer.getMediaElement().id).to.equal('new-media')
      })
    })

    it('should unsubscribe events from removed media element', () => {
      cy.window().then((win) => {
        const originalMedia = win.wavesurfer.getMediaElement()
        const media = document.createElement('audio')

        expect(originalMedia.eventCount).to.be.greaterThan(0)

        win.wavesurfer.setMediaElement(media)
        expect(originalMedia.eventCount).to.be.lessThan(1)
      })
    })

    it('should subscribe events for newly set media element', () => {
      cy.window().then((win) => {
        const newMedia = document.createElement('audio')
        attachMockListeners(newMedia)

        win.wavesurfer.setMediaElement(newMedia)
        expect(newMedia.eventCount).to.be.greaterThan(0)
      })
    })
  })

  it('should return true when calling isPlaying() after play()', (done) => {
    cy.window().then((win) => {
      expect(win.wavesurfer.isPlaying()).to.be.false
      win.wavesurfer.play()
      expect(win.wavesurfer.isPlaying()).to.be.true
      win.wavesurfer.once('play', () => {
        expect(win.wavesurfer.isPlaying()).to.be.true
        win.wavesurfer.pause()
        expect(win.wavesurfer.isPlaying()).to.be.false
        done()
      })
    })
  })
})
