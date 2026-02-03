// Mock AudioContext and related classes before importing
const mockBufferNode = {
  buffer: null as AudioBuffer | null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  playbackRate: { value: 1 },
  onended: null as (() => void) | null,
}

const mockGainNode = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  gain: { value: 1 },
}

let mockCurrentTime = 0

const mockAudioContext = {
  get currentTime() {
    return mockCurrentTime
  },
  createBufferSource: jest.fn(() => ({ ...mockBufferNode, onended: null })),
  createGain: jest.fn(() => mockGainNode),
  destination: {},
}

// Mock window.AudioContext
;(global as any).AudioContext = jest.fn(() => mockAudioContext)

import WebAudioPlayer from '../webaudio.js'

describe('WebAudioPlayer', () => {
  let player: WebAudioPlayer

  beforeEach(() => {
    jest.clearAllMocks()
    mockCurrentTime = 0
    // Reset mockBufferNode state
    mockBufferNode.onended = null

    player = new WebAudioPlayer(mockAudioContext as unknown as AudioContext)
    // Set up a mock buffer with 33 seconds duration
    ;(player as any).buffer = { duration: 33 }
  })

  describe('position reset behavior', () => {
    it('should NOT reset position when seeking to exactly the duration', async () => {
      // Set position to exactly the duration
      player.currentTime = 33 // exactly at the end

      await player.play()

      // Position should remain at 33, not reset to 0
      expect((player as any).playbackPosition).toBe(33)
    })

    it('should reset position when seeking past the duration', async () => {
      // Set position past the duration
      player.currentTime = 35 // past the end

      await player.play()

      // Position should be reset to 0
      expect((player as any).playbackPosition).toBe(0)
    })

    it('should maintain position when seeking near but not at the duration', async () => {
      // Set position near the end
      player.currentTime = 32.5

      await player.play()

      // Position should be maintained
      expect((player as any).playbackPosition).toBe(32.5)
    })

    it('should maintain position when seeking within valid range', async () => {
      player.currentTime = 15

      await player.play()

      expect((player as any).playbackPosition).toBe(15)
    })

    it('should reset position when seeking to negative value', async () => {
      player.currentTime = -5

      await player.play()

      expect((player as any).playbackPosition).toBe(0)
    })
  })

  describe('seeking while playing', () => {
    it('should correctly seek to new position while playing near the end', async () => {
      // Start playing from position 0
      mockCurrentTime = 0
      await player.play()

      // Simulate time passing - now at 31 seconds of playback
      mockCurrentTime = 31
      ;(player as any).playStartTime = 0

      // Seek to position 30 while playing
      player.currentTime = 30

      // Position should be 30
      expect((player as any).playbackPosition).toBe(30)
      expect(player.paused).toBe(false)
    })

    it('should correctly seek to a position close to duration while playing', async () => {
      // Start playing from position 0
      mockCurrentTime = 0
      await player.play()

      // Simulate time passing
      mockCurrentTime = 31
      ;(player as any).playStartTime = 0

      // Seek to position 32.9 (close to 33 second duration)
      player.currentTime = 32.9

      // Position should be maintained at 32.9, not reset
      expect((player as any).playbackPosition).toBe(32.9)
    })

    it('should correctly seek to exactly duration while playing', async () => {
      // Start playing from position 0
      mockCurrentTime = 0
      await player.play()

      // Simulate time passing
      mockCurrentTime = 31
      ;(player as any).playStartTime = 0

      // Seek to exactly the duration
      player.currentTime = 33

      // Position should be maintained at 33, not reset to 0
      expect((player as any).playbackPosition).toBe(33)
    })
  })
})
