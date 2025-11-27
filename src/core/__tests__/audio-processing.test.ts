/**
 * Unit tests for core/audio-processing.ts
 * Testing pure audio processing functions
 */

import {
  extractPeaks,
  normalizeAudioData,
  calculateWaveformPoints,
  splitChannelData,
  extractChannelData,
  findMaxAmplitude,
  needsNormalization,
  normalizeChannelData,
} from '../audio-processing'

// Mock AudioBuffer for testing
function createMockAudioBuffer(
  numberOfChannels: number,
  length: number,
  sampleRate: number,
  channelDataArray?: Float32Array[],
): AudioBuffer {
  const buffer = {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (channel: number) => {
      if (channelDataArray && channelDataArray[channel]) {
        return channelDataArray[channel]
      }
      const data = new Float32Array(length)
      // Fill with test data
      for (let i = 0; i < length; i++) {
        data[i] = Math.sin((i / length) * Math.PI * 2) * 0.5
      }
      return data
    },
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as AudioBuffer
  return buffer
}

describe('Peak Extraction', () => {
  describe('extractPeaks', () => {
    it('should extract peaks from audio buffer', () => {
      const buffer = createMockAudioBuffer(2, 1000, 44100)
      const peaks = extractPeaks(buffer, 100)

      expect(peaks).toHaveLength(2) // 2 channels
      expect(peaks[0]).toBeInstanceOf(Float32Array)
      expect(peaks[0]).toHaveLength(100)
    })

    it('should handle single channel', () => {
      const buffer = createMockAudioBuffer(1, 500, 44100)
      const peaks = extractPeaks(buffer, 50)

      expect(peaks).toHaveLength(1)
      expect(peaks[0]).toHaveLength(50)
    })

    it('should extract correct peak values', () => {
      const channelData = new Float32Array([0.5, -0.8, 0.3, -0.6])
      const buffer = createMockAudioBuffer(1, 4, 44100, [channelData])
      const peaks = extractPeaks(buffer, 2)

      expect(peaks[0][0]).toBeCloseTo(0.8) // Max of [0.5, -0.8]
      expect(peaks[0][1]).toBeCloseTo(0.6) // Max of [0.3, -0.6]
    })

    it('should handle more samples requested than available', () => {
      const buffer = createMockAudioBuffer(1, 10, 44100)
      const peaks = extractPeaks(buffer, 100)

      expect(peaks[0]).toHaveLength(100)
    })
  })
})

describe('Normalization', () => {
  describe('normalizeAudioData', () => {
    it('should normalize peaks to max of 1.0', () => {
      const peaks = [new Float32Array([0.5, 1.0, 0.25]), new Float32Array([0.3, 0.8, 0.4])]
      const normalized = normalizeAudioData(peaks)

      expect(normalized[0][1]).toBe(1.0) // Max value stays 1.0
      expect(normalized[0][0]).toBe(0.5)
      expect(normalized[1][0]).toBeCloseTo(0.3)
    })

    it('should normalize with custom max peak', () => {
      const peaks = [new Float32Array([0.5, 0.25])]
      const normalized = normalizeAudioData(peaks, 0.5)

      expect(normalized[0][0]).toBe(1.0) // 0.5 / 0.5
      expect(normalized[0][1]).toBe(0.5) // 0.25 / 0.5
    })

    it('should handle zero max peak', () => {
      const peaks = [new Float32Array([0, 0, 0])]
      const normalized = normalizeAudioData(peaks)

      expect(normalized).toEqual(peaks) // Should return original
    })

    it('should not mutate input', () => {
      const peaks = [new Float32Array([0.5, 1.0])]
      const original = peaks[0][0]
      normalizeAudioData(peaks)

      expect(peaks[0][0]).toBe(original)
    })
  })

  describe('needsNormalization', () => {
    it('should detect values outside -1..1', () => {
      expect(needsNormalization([new Float32Array([0.5, 1.5, 0.3])])).toBe(true)
      expect(needsNormalization([new Float32Array([0.5, -1.5, 0.3])])).toBe(true)
    })

    it('should return false for normalized data', () => {
      expect(needsNormalization([new Float32Array([0.5, 1.0, -0.8])])).toBe(false)
      expect(needsNormalization([new Float32Array([0, 0.5, -0.5])])).toBe(false)
    })

    it('should handle empty data', () => {
      expect(needsNormalization([new Float32Array()])).toBe(false)
      expect(needsNormalization([])).toBe(false)
    })
  })

  describe('normalizeChannelData', () => {
    it('should normalize channel data when needed', () => {
      const channelData = [new Float32Array([1.0, 2.0, 0.5])]
      const normalized = normalizeChannelData(channelData)

      expect(normalized[0][1]).toBe(1.0) // 2.0 / 2.0
      expect(normalized[0][0]).toBe(0.5) // 1.0 / 2.0
      expect(normalized[0][2]).toBe(0.25) // 0.5 / 2.0
    })

    it('should not normalize when not needed', () => {
      const channelData = [new Float32Array([0.5, 1.0, -0.8])]
      const normalized = normalizeChannelData(channelData)

      expect(normalized).toBe(channelData) // Same reference
    })

    it('should not mutate input', () => {
      const channelData = [new Float32Array([1.0, 2.0])]
      const original = channelData[0][1]
      normalizeChannelData(channelData)

      expect(channelData[0][1]).toBe(original)
    })
  })

  describe('findMaxAmplitude', () => {
    it('should find maximum absolute value', () => {
      const channelData = [new Float32Array([0.5, -0.8, 0.3, -0.6])]
      expect(findMaxAmplitude(channelData)).toBeCloseTo(0.8)
    })

    it('should handle positive and negative values', () => {
      const channelData = [new Float32Array([0.5, 1.2, -1.5, 0.8])]
      expect(findMaxAmplitude(channelData)).toBe(1.5)
    })

    it('should handle empty data', () => {
      expect(findMaxAmplitude([new Float32Array()])).toBe(0)
      expect(findMaxAmplitude([])).toBe(0)
    })
  })
})

describe('Waveform Points', () => {
  describe('calculateWaveformPoints', () => {
    it('should calculate points for line mode', () => {
      const peaks = new Float32Array([0.5, 0.8, 0.3])
      const points = calculateWaveformPoints(peaks, 300, 100, {})

      expect(points).toHaveLength(300)
      expect(points[0]).toHaveProperty('x')
      expect(points[0]).toHaveProperty('y')
      expect(points[0]).toHaveProperty('height')
    })

    it('should calculate points for bar mode', () => {
      const peaks = new Float32Array([0.5, 0.8, 0.3, 0.6])
      const points = calculateWaveformPoints(peaks, 400, 100, {
        barWidth: 10,
        barGap: 2,
      })

      expect(points.length).toBeGreaterThan(0)
      expect(points[0].x).toBe(0)
    })

    it('should apply vertical scale', () => {
      const peaks = new Float32Array([0.5])
      const points1 = calculateWaveformPoints(peaks, 100, 100, { vScale: 1 })
      const points2 = calculateWaveformPoints(peaks, 100, 100, { vScale: 2 })

      expect(points2[0].height).toBe(points1[0].height * 2)
    })

    it('should handle top alignment', () => {
      const peaks = new Float32Array([0.5])
      const points = calculateWaveformPoints(peaks, 100, 100, {
        barWidth: 10,
        barAlign: 'top',
      })

      expect(points[0].y).toBe(0)
    })

    it('should handle bottom alignment', () => {
      const peaks = new Float32Array([0.5])
      const height = 100
      const points = calculateWaveformPoints(peaks, 100, height, {
        barWidth: 10,
        barAlign: 'bottom',
      })

      expect(points[0].y).toBe(height - points[0].height)
    })
  })
})

describe('Multi-Channel Processing', () => {
  describe('splitChannelData', () => {
    it('should split channels with offsets', () => {
      const channelData = [new Float32Array([0.5, 0.8]), new Float32Array([0.3, 0.6])]
      const buffer = createMockAudioBuffer(2, 2, 44100, channelData)
      const result = splitChannelData(buffer, {
        totalHeight: 200,
        defaultColor: '#999',
        overlay: false,
      })

      expect(result).toHaveLength(2)
      expect(result[0].height).toBe(100) // 200 / 2
      expect(result[0].offset).toBe(0)
      expect(result[1].offset).toBe(100)
    })

    it('should overlay channels when requested', () => {
      const buffer = createMockAudioBuffer(2, 10, 44100)
      const result = splitChannelData(buffer, {
        totalHeight: 200,
        defaultColor: '#999',
        overlay: true,
      })

      expect(result[0].offset).toBe(0)
      expect(result[1].offset).toBe(0) // Overlaid
    })

    it('should use custom channel colors', () => {
      const buffer = createMockAudioBuffer(2, 10, 44100)
      const result = splitChannelData(buffer, {
        totalHeight: 200,
        defaultColor: '#999',
        channelColors: ['#f00', '#00f'],
      })

      expect(result[0].color).toBe('#f00')
      expect(result[1].color).toBe('#00f')
    })

    it('should fall back to default color', () => {
      const buffer = createMockAudioBuffer(2, 10, 44100)
      const result = splitChannelData(buffer, {
        totalHeight: 200,
        defaultColor: '#abc',
      })

      expect(result[0].color).toBe('#abc')
      expect(result[1].color).toBe('#abc')
    })
  })

  describe('extractChannelData', () => {
    it('should extract all channel data', () => {
      const buffer = createMockAudioBuffer(2, 100, 44100)
      const channels = extractChannelData(buffer)

      expect(channels).toHaveLength(2)
      expect(channels[0]).toBeInstanceOf(Float32Array)
      expect(channels[0]).toHaveLength(100)
    })

    it('should handle single channel', () => {
      const buffer = createMockAudioBuffer(1, 50, 44100)
      const channels = extractChannelData(buffer)

      expect(channels).toHaveLength(1)
      expect(channels[0]).toHaveLength(50)
    })
  })
})
