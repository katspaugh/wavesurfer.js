/**
 * FFT (Fast Fourier Transform) implementation
 * Based on https://github.com/corbanbrook/dsp.js
 *
 * The legacy ES5 constructor-function FFT class. Everything else that used to live in this file
 * (frequency-scale math, autoGain/color-mapping helpers, colormap/UI helpers) is fully typed and
 * has moved to spectrogram-render-utils.ts (R16) - this file's blanket @ts-nocheck below is now
 * truthfully scoped to just the untyped ES5 `this.x =` constructor pattern below, which doesn't
 * type-check as a class under strict mode.
 */

// eslint-disable-next-line
// @ts-nocheck

/**
 * Calculate FFT - Based on https://github.com/corbanbrook/dsp.js
 */
function FFT(bufferSize: number, sampleRate: number, windowFunc: string, alpha: number, windowLength?: number) {
  // Absent values default to the full buffer; explicit values are validated, not coerced
  windowLength = windowLength ?? bufferSize
  if (!Number.isInteger(windowLength) || windowLength < 2 || windowLength > bufferSize) {
    // Every window formula divides by (windowLength - 1) and the table has bufferSize entries
    throw Error('windowLength must be an integer between 2 and bufferSize')
  }
  this.bufferSize = bufferSize
  this.windowLength = windowLength
  this.sampleRate = sampleRate
  this.bandwidth = (2 / bufferSize) * (sampleRate / 2)

  this.sinTable = new Float32Array(bufferSize)
  this.cosTable = new Float32Array(bufferSize)
  this.windowValues = new Float32Array(bufferSize)
  this.reverseTable = new Uint32Array(bufferSize)

  this.peakBand = 0
  this.peak = 0

  switch (windowFunc) {
    case 'bartlett':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] =
          (2 / (windowLength - 1)) * ((windowLength - 1) / 2 - Math.abs(i - (windowLength - 1) / 2))
      }
      break
    case 'bartlettHann':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] =
          0.62 - 0.48 * Math.abs(i / (windowLength - 1) - 0.5) - 0.38 * Math.cos((Math.PI * 2 * i) / (windowLength - 1))
      }
      break
    case 'blackman':
      alpha = alpha ?? 0.16
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] =
          (1 - alpha) / 2 -
          0.5 * Math.cos((Math.PI * 2 * i) / (windowLength - 1)) +
          (alpha / 2) * Math.cos((4 * Math.PI * i) / (windowLength - 1))
      }
      break
    case 'cosine':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] = Math.cos((Math.PI * i) / (windowLength - 1) - Math.PI / 2)
      }
      break
    case 'gauss':
      alpha = alpha || 0.25
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] = Math.pow(
          Math.E,
          -0.5 * Math.pow((i - (windowLength - 1) / 2) / ((alpha * (windowLength - 1)) / 2), 2),
        )
      }
      break
    case 'hamming':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] = 0.54 - 0.46 * Math.cos((Math.PI * 2 * i) / (windowLength - 1))
      }
      break
    case 'hann':
    case undefined:
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] = 0.5 * (1 - Math.cos((Math.PI * 2 * i) / (windowLength - 1)))
      }
      break
    case 'lanczoz':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] =
          Math.sin(Math.PI * ((2 * i) / (windowLength - 1) - 1)) / (Math.PI * ((2 * i) / (windowLength - 1) - 1))
      }
      break
    case 'rectangular':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] = 1
      }
      break
    case 'triangular':
      for (let i = 0; i < windowLength; i++) {
        this.windowValues[i] = (2 / windowLength) * (windowLength / 2 - Math.abs(i - (windowLength - 1) / 2))
      }
      break
    default:
      throw Error("No such window function '" + windowFunc + "'")
  }

  // When the window is shorter than the FFT, the remaining table entries stay zero (zero
  // padding) and the live samples are scaled up so the 2 / bufferSize magnitude
  // normalization in calculateSpectrum() remains calibrated
  if (windowLength < bufferSize) {
    const windowScale = bufferSize / windowLength
    for (let i = 0; i < windowLength; i++) {
      this.windowValues[i] *= windowScale
    }
  }

  let limit = 1
  let bit = bufferSize >> 1

  while (limit < bufferSize) {
    for (let i = 0; i < limit; i++) {
      this.reverseTable[i + limit] = this.reverseTable[i] + bit
    }

    limit = limit << 1
    bit = bit >> 1
  }

  // Precompute sin/cos tables for FFT twiddle factors
  // Index 0 is a special case: -PI/0 would produce NaN, use 0 instead
  this.sinTable[0] = 0
  this.cosTable[0] = 1
  for (let i = 1; i < bufferSize; i++) {
    this.sinTable[i] = Math.sin(-Math.PI / i)
    this.cosTable[i] = Math.cos(-Math.PI / i)
  }

  this.calculateSpectrum = function (buffer: Float32Array): Float32Array {
    const bufferSize = this.bufferSize,
      cosTable = this.cosTable,
      sinTable = this.sinTable,
      reverseTable = this.reverseTable,
      real = new Float32Array(bufferSize),
      imag = new Float32Array(bufferSize),
      bSi = 2 / this.bufferSize,
      sqrt = Math.sqrt,
      spectrum = new Float32Array(bufferSize / 2)

    let rval, ival, mag

    const k = Math.floor(Math.log(bufferSize) / Math.LN2)

    if (Math.pow(2, k) !== bufferSize) {
      throw 'Invalid buffer size, must be a power of 2.'
    }
    if (bufferSize !== buffer.length) {
      throw (
        'Supplied buffer is not the same size as defined FFT. FFT Size: ' +
        bufferSize +
        ' Buffer Size: ' +
        buffer.length
      )
    }

    let halfSize = 1,
      phaseShiftStepReal,
      phaseShiftStepImag,
      currentPhaseShiftReal,
      currentPhaseShiftImag,
      off,
      tr,
      ti,
      tmpReal

    for (let i = 0; i < bufferSize; i++) {
      real[i] = buffer[reverseTable[i]] * this.windowValues[reverseTable[i]]
      imag[i] = 0
    }

    while (halfSize < bufferSize) {
      phaseShiftStepReal = cosTable[halfSize]
      phaseShiftStepImag = sinTable[halfSize]

      currentPhaseShiftReal = 1
      currentPhaseShiftImag = 0

      for (let fftStep = 0; fftStep < halfSize; fftStep++) {
        let i = fftStep

        while (i < bufferSize) {
          off = i + halfSize
          tr = currentPhaseShiftReal * real[off] - currentPhaseShiftImag * imag[off]
          ti = currentPhaseShiftReal * imag[off] + currentPhaseShiftImag * real[off]

          real[off] = real[i] - tr
          imag[off] = imag[i] - ti
          real[i] += tr
          imag[i] += ti

          i += halfSize << 1
        }

        tmpReal = currentPhaseShiftReal
        currentPhaseShiftReal = tmpReal * phaseShiftStepReal - currentPhaseShiftImag * phaseShiftStepImag
        currentPhaseShiftImag = tmpReal * phaseShiftStepImag + currentPhaseShiftImag * phaseShiftStepReal
      }

      halfSize = halfSize << 1
    }

    for (let i = 0, N = bufferSize / 2; i < N; i++) {
      rval = real[i]
      ival = imag[i]
      mag = bSi * sqrt(rval * rval + ival * ival)

      if (mag > this.peak) {
        this.peakBand = i
        this.peak = mag
      }
      spectrum[i] = mag
    }
    return spectrum
  }
}

// TypeScript declaration for FFT class
export declare class FFT {
  constructor(bufferSize: number, sampleRate: number, windowFunc: string, alpha: number, windowLength?: number)
  bufferSize: number
  windowLength: number
  calculateSpectrum(buffer: Float32Array): Float32Array
}

// Export the FFT constructor function
export { FFT }
export default FFT
