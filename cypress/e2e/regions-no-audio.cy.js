describe('WaveSurfer Regions plugin with no audio tests', () => {
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

          // For these tests we're explicitly testing for scenarios where audio is not loaded
          // so we don't pass a url, instead we use peaks & duration.
          //url: '/examples/audio/demo.wav',

          duration: 22,
          peaks: [
            [
              0, 0.0023595101665705442, 0.012107174843549728, 0.005919494666159153, -0.31324470043182373, 0.1511787623167038,
              0.2473851442337036, 0.11443428695201874, -0.036057762801647186, -0.0968964695930481, -0.03033737652003765,
              0.10682467371225357, 0.23974689841270447, 0.013210971839725971, -0.12377244979143143, 0.046145666390657425,
              -0.015757400542497635, 0.10884027928113937, 0.06681904196739197, 0.09432944655418396, -0.17105795443058014,
              -0.023439358919858932, -0.10380347073078156, 0.0034454423002898693, 0.08061369508504868, 0.026129156351089478,
              0.18730352818965912, 0.020447958260774612, -0.15030759572982788, 0.05689578503370285, -0.0009095853311009705,
              0.2749626338481903, 0.2565386891365051, 0.07571295648813248, 0.10791446268558502, -0.06575305759906769,
              0.15336275100708008, 0.07056761533021927, 0.03287476301193237, -0.09044631570577621, 0.01777501218020916,
              -0.04906218498945236, -0.04756792634725571, -0.006875281687825918, 0.04520256072282791, -0.02362387254834175,
              -0.0668797641992569, 0.12266506254673004, -0.10895221680402756, 0.03791835159063339, -0.0195105392485857,
              -0.031097881495952606, 0.04252675920724869, -0.09187793731689453, 0.0829525887966156, -0.003812957089394331,
              0.0431736595928669, 0.07634212076663971, -0.05335947126150131, 0.0345163568854332, -0.049201950430870056,
              0.02300390601158142, 0.007677287794649601, 0.015354577451944351, 0.007677287794649601, 0.007677288725972176,
            ],
          ],
          splitChannels: true,
          plugins: [win.Regions.create()],
        })

        win.wavesurfer.once('ready', () => resolve())
      })

      cy.wrap(waitForReady).then(done)
    })
  })

  it('should listen to events on a region', () => {
    cy.window().then((win) => {
      const regionsPlugin = win.wavesurfer.getActivePlugins()[0]

      const region = regionsPlugin.addRegion({
        start: 1,
        end: 3,
        content: 'Test region',
        color: 'rgba(0, 100, 0, 0.2)',
      })

      expect(region.element.textContent).to.equal('Test region')

      let eventHandlerCalled = false;

      regionsPlugin.on('region-in', (reg, e) => {
        expect(region).to.equal(reg)
        eventHandlerCalled = true;
      })

      win.wavesurfer.setTime(2)

      expect(eventHandlerCalled).to.be.true
      expect(win.wavesurfer.isPlaying()).to.be.false
      expect(win.wavesurfer.getCurrentTime()).to.equal(2)

      win.wavesurfer.destroy()
    })
  })

})
