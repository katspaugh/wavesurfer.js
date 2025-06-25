import WebAudioPlayer from '../../dist/webaudio.js'

describe('WebAudioPlayer', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      // Create fresh mock objects for each test
      const mockBufferNode = {
        buffer: null,
        connect: cy.stub(),
        disconnect: cy.stub(),
        start: cy.stub(),
        stop: cy.stub(),
        playbackRate: { value: 1 },
        onended: null,
      }

      const mockGainNode = {
        connect: cy.stub(),
        gain: { value: 1 },
      }

      const mockAudioContext = {
        currentTime: 0,
        createBufferSource: cy.stub().returns(mockBufferNode),
        createGain: cy.stub().returns(mockGainNode),
        destination: {},
      }

      // Create a fresh WebAudioPlayer instance
      const player = new WebAudioPlayer(mockAudioContext)
      win.WebAudioPlayer = player // Attach to window for Cypress access

      // Set up a mock buffer for playback
      const mockBuffer = { duration: 10 }
      player.buffer = mockBuffer

      // Store objects as Cypress aliases for easy access
      cy.wrap(player).as('player')
      cy.wrap(mockBufferNode.start).as('startStub')
    })
  })

  describe('_play method', () => {
    it('should reset position when currentPos is negative', () => {
      cy.get('@player').then((player) => {
        player.playbackRate = 1
        player.currentTime = -1

        return player.play().then(() => {
          // Verify position was reset
          expect(player.currentTime).to.equal(0)
          cy.get('@startStub').should('have.been.calledWith', 0, 0)
        })
      })
    })

    it('should reset position when currentPos exceeds duration', () => {
      cy.get('@player').then((player) => {
        player.currentTime = 15

        return player.play().then(() => {
          // Verify position was reset
          expect(player.currentTime).to.equal(0)
          cy.get('@startStub').should('have.been.calledWith', 0, 0)
        })
      })
    })

    it('should maintain position when within valid range', () => {
      cy.get('@player').then((player) => {
        const validTime = 5
        player.currentTime = validTime

        return player.play().then(() => {
          // Verify position was maintained
          cy.get('@startStub').should('have.been.calledWith', 0, validTime)
        })
      })
    })

    it('should handle playback rate changes correctly', () => {
      cy.get('@player').then((player) => {
        player.currentTime = 2
        player.playbackRate = 2

        return player.play().then(() => {
          // currentPos should be 4 (2 * 2)
          cy.get('@startStub').should('have.been.calledWith', 0, 4)
          expect(player.bufferNode.playbackRate.value).to.equal(2)
        })
      })
    })
  })
})
