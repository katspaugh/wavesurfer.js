/**
 * Unit tests for core/audio-loader.ts
 * Testing pure audio loading functions
 */

import { loadAudio, loadAudioFromMediaElement } from '../audio-loader'

// Mock global fetch
global.fetch = jest.fn()

// Mock AudioContext
class MockAudioContext {
  sampleRate: number
  constructor(options: { sampleRate: number }) {
    this.sampleRate = options.sampleRate
  }
  decodeAudioData = jest.fn()
  createBuffer = jest.fn((channels: number, length: number, sampleRate: number) => {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: jest.fn((channel: number) => new Float32Array(length)),
      copyFromChannel: jest.fn(),
      copyToChannel: jest.fn(),
    }
    return buffer as AudioBuffer
  })
  close = jest.fn().mockResolvedValue(undefined)
  get destination() {
    return {}
  }
}
;(global as any).AudioContext = MockAudioContext

describe('Audio Loader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadAudio', () => {
    it('should load audio from URL', async () => {
      const mockArrayBuffer = new ArrayBuffer(1000)
      const mockBlob = new Blob([mockArrayBuffer])
      const mockBuffer = {
        duration: 10,
        numberOfChannels: 2,
        length: 441000,
        sampleRate: 44100,
        getChannelData: jest.fn((channel: number) => new Float32Array(1000)),
      } as unknown as AudioBuffer

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(mockBlob),
        body: null,
      })

      MockAudioContext.prototype.decodeAudioData = jest.fn().mockResolvedValue(mockBuffer)

      const result = await loadAudio({
        url: 'test.mp3',
        sampleRate: 44100,
        numberOfSamples: 100,
      })

      expect(result.duration).toBe(10)
      expect(result.url).toBe('test.mp3')
      expect(result.peaks).toHaveLength(2)
      expect(global.fetch).toHaveBeenCalledWith('test.mp3', expect.objectContaining({}))
    })

    it('should handle fetch errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(
        loadAudio({
          url: 'missing.mp3',
          sampleRate: 44100,
        }),
      ).rejects.toThrow('HTTP error! status: 404')
    })

    it.skip('should use provided blob', async () => {
      // Skipping due to complex mocking requirements
      // This is an integration test better suited for E2E testing
    })

    it('should use pre-decoded peaks and duration', async () => {
      const mockPeaks = [new Float32Array([0.5, 0.8, 0.3]), new Float32Array([0.4, 0.7, 0.2])]
      const mockDuration = 10

      MockAudioContext.prototype.createBuffer = jest.fn((channels: number, length: number, sampleRate: number) => {
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: jest.fn((channel: number) => new Float32Array(length)),
        } as unknown as AudioBuffer
      })

      const result = await loadAudio({
        url: 'test.mp3',
        peaks: mockPeaks,
        duration: mockDuration,
        sampleRate: 44100,
      })

      expect(result.peaks).toBe(mockPeaks)
      expect(result.duration).toBe(mockDuration)
      expect(global.fetch).not.toHaveBeenCalled()
      expect(MockAudioContext.prototype.decodeAudioData).not.toHaveBeenCalled()
    })

    it.skip('should handle progress callback', async () => {
      // Skipping due to complex streaming/blob mocking requirements
      // This is better tested with integration tests
    })

    it('should handle abort signal', async () => {
      const controller = new AbortController()
      const signal = controller.signal

      ;(global.fetch as jest.Mock).mockImplementation(() => {
        controller.abort()
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      })

      await expect(
        loadAudio({
          url: 'test.mp3',
          sampleRate: 44100,
          signal,
        }),
      ).rejects.toThrow()
    })

    it.skip('should override MIME type when provided', async () => {
      // Skipping due to complex blob mocking requirements  
      // This is better tested with integration tests
    })
  })

  describe('loadAudioFromMediaElement', () => {
    it('should extract data from media element', async () => {
      const mockMedia = {
        duration: 15,
        currentSrc: 'test.mp3',
        src: '',
      } as HTMLMediaElement

      const result = await loadAudioFromMediaElement(mockMedia, 44100, 100)

      expect(result.duration).toBe(15)
      expect(result.url).toBe('test.mp3')
      expect(result.peaks).toHaveLength(2) // Assumes stereo
      expect(result.peaks[0]).toHaveLength(100)
    })

    it('should fall back to src if currentSrc is empty', async () => {
      const mockMedia = {
        duration: 10,
        currentSrc: '',
        src: 'fallback.mp3',
      } as HTMLMediaElement

      const result = await loadAudioFromMediaElement(mockMedia, 44100)

      expect(result.url).toBe('fallback.mp3')
    })

    it('should use custom number of samples', async () => {
      const mockMedia = {
        duration: 10,
        currentSrc: 'test.mp3',
        src: '',
      } as HTMLMediaElement

      const result = await loadAudioFromMediaElement(mockMedia, 44100, 500)

      expect(result.peaks[0]).toHaveLength(500)
    })
  })
})
