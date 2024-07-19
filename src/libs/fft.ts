/**
 * Calculate FFT - Based on https://github.com/corbanbrook/dsp.js
 */
export default class FFT {
    bandwidth = 0
    sinTable: Float32Array | undefined
    cosTable: Float32Array | undefined
    windowValues: Float32Array | undefined
    reverseTable: Uint32Array | undefined
    peakBand = 0
    peak = 0

    constructor(private bufferSize: number, sampleRate: number, windowFunc: FFTWindowFunction, alpha?: number) {
        this.bandwidth = (2 / bufferSize) * (sampleRate / 2)
        this.calculateWindowValues(bufferSize, windowFunc, alpha);
        this.calculateReverseTable(bufferSize)
        this.calculateSinCosTable(bufferSize)
    }

    private calculateWindowValues(bufferSize: number, windowFunc: FFTWindowFunction, alpha?: number) {
        this.windowValues = new Float32Array(bufferSize)
        let i: number;
        switch (windowFunc) {
            case 'bartlett':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = (2 / (bufferSize - 1)) * ((bufferSize - 1) / 2 - Math.abs(i - (bufferSize - 1) / 2))
                }
                break
            case 'bartlettHann':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] =
                        0.62 - 0.48 * Math.abs(i / (bufferSize - 1) - 0.5) - 0.38 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1))
                }
                break
            case 'blackman':
                alpha = alpha || 0.16
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] =
                        (1 - alpha) / 2 -
                        0.5 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1)) +
                        (alpha / 2) * Math.cos((4 * Math.PI * i) / (bufferSize - 1))
                }
                break
            case 'cosine':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = Math.cos((Math.PI * i) / (bufferSize - 1) - Math.PI / 2)
                }
                break
            case 'gauss':
                alpha = alpha || 0.25
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = Math.pow(
                        Math.E,
                        -0.5 * Math.pow((i - (bufferSize - 1) / 2) / ((alpha * (bufferSize - 1)) / 2), 2),
                    )
                }
                break
            case 'hamming':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = 0.54 - 0.46 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1))
                }
                break
            case 'hann':
            case undefined:
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = 0.5 * (1 - Math.cos((Math.PI * 2 * i) / (bufferSize - 1)))
                }
                break
            case 'lanczoz':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] =
                        Math.sin(Math.PI * ((2 * i) / (bufferSize - 1) - 1)) / (Math.PI * ((2 * i) / (bufferSize - 1) - 1))
                }
                break
            case 'rectangular':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = 1
                }
                break
            case 'triangular':
                for (i = 0; i < bufferSize; i++) {
                    this.windowValues[i] = (2 / bufferSize) * (bufferSize / 2 - Math.abs(i - (bufferSize - 1) / 2))
                }
                break
            default:
                throw Error("No such window function '" + windowFunc + "'")
        }
    }

    private calculateReverseTable(bufferSize: number) {
        this.reverseTable = new Uint32Array(bufferSize)
        let limit = 1
        let bit = bufferSize >> 1
        let i
        while (limit < bufferSize) {
            for (i = 0; i < limit; i++) {
                this.reverseTable[i + limit] = this.reverseTable[i] + bit
            }
            limit = limit << 1
            bit = bit >> 1
        }
    }

    private calculateSinCosTable(bufferSize: number) {
        this.sinTable = new Float32Array(bufferSize)
        this.cosTable = new Float32Array(bufferSize)
        for (let i = 0; i < bufferSize; i++) {
            this.sinTable[i] = Math.sin(-Math.PI / i)
            this.cosTable[i] = Math.cos(-Math.PI / i)
        }
    }

    public calculateSpectrum(buffer: Float32Array) {
        // Locally scope variables for speed up
        const bufferSize = this.bufferSize!,
            cosTable = this.cosTable!,
            sinTable = this.sinTable!,
            reverseTable = this.reverseTable!,
            windowValues = this.windowValues!,
            real = new Float32Array(bufferSize),
            imag = new Float32Array(bufferSize),
            bSi = 2 / this.bufferSize,
            sqrt = Math.sqrt

        let rval,
            ival,
            mag,
            spectrum = new Float32Array(bufferSize / 2)

        var k = Math.floor(Math.log(bufferSize) / Math.LN2)

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

        var halfSize = 1,
            phaseShiftStepReal,
            phaseShiftStepImag,
            currentPhaseShiftReal,
            currentPhaseShiftImag,
            off,
            tr,
            ti,
            tmpReal

        for (var i = 0; i < bufferSize; i++) {
            real[i] = buffer[reverseTable[i]] * windowValues[reverseTable[i]]
            imag[i] = 0
        }

        while (halfSize < bufferSize) {
            phaseShiftStepReal = cosTable[halfSize]
            phaseShiftStepImag = sinTable[halfSize]

            currentPhaseShiftReal = 1
            currentPhaseShiftImag = 0

            for (var fftStep = 0; fftStep < halfSize; fftStep++) {
                var i = fftStep

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

        for (var i = 0, N = bufferSize / 2; i < N; i++) {
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

export type FFTWindowFunction = | 'bartlett' | 'bartlettHann' | 'blackman' | 'cosine' | 'gauss' | 'hamming' | 'hann' | 'lanczoz' | 'rectangular' | 'triangular'
