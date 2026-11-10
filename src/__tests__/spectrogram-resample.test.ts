import { resampleChannel, efficientResample } from '../spectrogram-render-utils.js'

const col = (...values: number[]) => Uint8Array.from(values)
const toArrays = (matrix: Uint8Array[]) => matrix.map((column) => Array.from(column))

describe('resampleChannel', () => {
  it('returns the input matrix itself when the width already matches', () => {
    const matrix = [col(1, 2), col(3, 4)]
    expect(resampleChannel(matrix, 2)).toBe(matrix)
  })

  it('returns the input matrix itself for a target width of 0', () => {
    const matrix = [col(1, 2), col(3, 4)]
    expect(resampleChannel(matrix, 0)).toBe(matrix)
  })

  it('averages source columns when downsampling, rounding to the nearest integer', () => {
    const matrix = [col(0, 10), col(1, 20), col(4, 30), col(6, 41)]
    // ratio 2: [0,2) and [2,4)
    expect(toArrays(resampleChannel(matrix, 2))).toEqual([
      [1, 15], // (0+1)/2 = 0.5 -> 1, (10+20)/2 = 15
      [5, 36], // (4+6)/2 = 5, (30+41)/2 = 35.5 -> 36
    ])
  })

  it('averages overlapping source ranges for a non-integer downsampling ratio', () => {
    const matrix = [col(0), col(30), col(60)]
    // ratio 1.5: i=0 -> [0,2), i=1 -> [1,3)
    expect(toArrays(resampleChannel(matrix, 2))).toEqual([[15], [45]])
  })

  it('lets neighboring target columns share a source column for a ratio just above 1', () => {
    const matrix = [col(7, 8), col(9, 10), col(11, 12), col(13, 14)]
    // ratio 4/3: i=0 -> [0,2), i=1 -> [1,3), i=2 -> [2,4)
    expect(toArrays(resampleChannel(matrix, 3))).toEqual([
      [8, 9],
      [10, 11],
      [12, 13],
    ])
  })

  it('produces fresh columns, never aliases of the input, when resampling', () => {
    const matrix = [col(1), col(2), col(3), col(4)]
    const result = resampleChannel(matrix, 2)
    for (const column of result) {
      expect(matrix).not.toContain(column)
    }
    const up = resampleChannel(matrix, 8)
    for (const column of up) {
      expect(matrix).not.toContain(column)
    }
  })

  it('linearly interpolates between neighbors when upsampling', () => {
    const matrix = [col(0, 100), col(100, 0)]
    // ratio 0.5: src 0, 0.5, 1, 1.5
    expect(toArrays(resampleChannel(matrix, 4))).toEqual([
      [0, 100], // exact match
      [50, 50], // halfway
      [100, 0], // exact match
      [100, 0], // past the last column: clamped to the boundary (nearest neighbor)
    ])
  })

  it('rounds interpolated values', () => {
    const matrix = [col(0), col(10), col(20)]
    // ratio 3/4 = 0.75: src 0, 0.75, 1.5, 2.25
    expect(toArrays(resampleChannel(matrix, 4))).toEqual([[0], [8], [15], [20]])
  })

  it('upsamples a single source column by repeating it', () => {
    const matrix = [col(5, 6)]
    expect(toArrays(resampleChannel(matrix, 3))).toEqual([
      [5, 6],
      [5, 6],
      [5, 6],
    ])
  })

  it('throws for an empty matrix resampled to a non-zero width (current behavior)', () => {
    // No source columns gives ratio 0, so the upsampling branch copies oldMatrix[0], which is
    // undefined. drawSpectrogram never gets here: it treats all-empty channels as nothing to draw.
    expect(() => resampleChannel([], 2)).toThrow(TypeError)
  })

  it('does not modify the input matrix', () => {
    const matrix = [col(1, 2), col(3, 4), col(5, 6)]
    const snapshot = toArrays(matrix)
    resampleChannel(matrix, 2)
    resampleChannel(matrix, 5)
    expect(toArrays(matrix)).toEqual(snapshot)
  })
})

describe('efficientResample', () => {
  it('resamples every channel independently to the same width', () => {
    const left = [col(0), col(10), col(20), col(30)]
    const right = [col(100), col(80)]
    const result = efficientResample([left, right], 2)
    expect(result).toHaveLength(2)
    expect(toArrays(result[0])).toEqual([[5], [25]])
    // Already the target width: passed through as is
    expect(result[1]).toBe(right)
  })

  it('returns an empty array for no channels', () => {
    expect(efficientResample([], 10)).toEqual([])
  })
})
