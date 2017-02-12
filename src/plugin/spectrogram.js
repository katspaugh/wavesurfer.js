/**
 * Calculate FFT - Based on https://github.com/corbanbrook/dsp.js
 */
/* eslint-disable complexity, no-redeclare, no-var, one-var */
const FFT = function(bufferSize, sampleRate, windowFunc, alpha) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.bandwidth = 2 / bufferSize * sampleRate / 2;

    this.sinTable = new Float32Array(bufferSize);
    this.cosTable = new Float32Array(bufferSize);
    this.windowValues = new Float32Array(bufferSize);
    this.reverseTable = new Uint32Array(bufferSize);

    this.peakBand = 0;
    this.peak = 0;

    switch (windowFunc) {
        case 'bartlett' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = 2 / (bufferSize - 1) * ((bufferSize - 1) / 2 - Math.abs(i - (bufferSize - 1) / 2));
            }
            break;
        case 'bartlettHann' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = 0.62 - 0.48 * Math.abs(i / (bufferSize - 1) - 0.5) - 0.38 * Math.cos(Math.PI * 2 * i / (bufferSize - 1));
            }
            break;
        case 'blackman' :
            alpha = alpha || 0.16;
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = (1 - alpha)/2 - 0.5 * Math.cos(Math.PI * 2 * i / (bufferSize - 1)) + alpha/2 * Math.cos(4 * Math.PI * i / (bufferSize - 1));
            }
            break;
        case 'cosine' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = Math.cos(Math.PI * i / (bufferSize - 1) - Math.PI / 2);
            }
            break;
        case 'gauss' :
            alpha = alpha || 0.25;
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = Math.pow(Math.E, -0.5 * Math.pow((i - (bufferSize - 1) / 2) / (alpha * (bufferSize - 1) / 2), 2));
            }
            break;
        case 'hamming' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = 0.54 - 0.46 * Math.cos(Math.PI * 2 * i / (bufferSize - 1));
            }
            break;
        case 'hann' :
        case undefined :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = 0.5 * (1 - Math.cos(Math.PI * 2 * i / (bufferSize - 1)));
            }
            break;
        case 'lanczoz' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = Math.sin(Math.PI * (2 * i / (bufferSize - 1) - 1)) / (Math.PI * (2 * i / (bufferSize - 1) - 1));
            }
            break;
        case 'rectangular' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = 1;
            }
            break;
        case 'triangular' :
            for (var i = 0; i<bufferSize; i++) {
                this.windowValues[i] = 2 / bufferSize * (bufferSize / 2 - Math.abs(i - (bufferSize - 1) / 2));
            }
            break;
        default:
            throw Error('No such window function \'' + windowFunc + '\'');
    }

    var limit = 1;
    var bit = bufferSize >> 1;

    var i;

    while (limit < bufferSize) {
        for (i = 0; i < limit; i++) {
            this.reverseTable[i + limit] = this.reverseTable[i] + bit;
        }

        limit = limit << 1;
        bit = bit >> 1;
    }

    for (i = 0; i < bufferSize; i++) {
        this.sinTable[i] = Math.sin(-Math.PI/i);
        this.cosTable[i] = Math.cos(-Math.PI/i);
    }


    this.calculateSpectrum = function(buffer) {
        // Locally scope variables for speed up
        var bufferSize = this.bufferSize,
            cosTable = this.cosTable,
            sinTable = this.sinTable,
            reverseTable = this.reverseTable,
            real = new Float32Array(bufferSize),
            imag = new Float32Array(bufferSize),
            bSi = 2 / this.bufferSize,
            sqrt = Math.sqrt,
            rval,
            ival,
            mag,
            spectrum = new Float32Array(bufferSize / 2);

        var k = Math.floor(Math.log(bufferSize) / Math.LN2);

        if (Math.pow(2, k) !== bufferSize) {
            throw 'Invalid buffer size, must be a power of 2.';
        }
        if (bufferSize !== buffer.length) {
            throw 'Supplied buffer is not the same size as defined FFT. FFT Size: ' + bufferSize + ' Buffer Size: ' + buffer.length;
        }

        var halfSize = 1,
            phaseShiftStepReal,
            phaseShiftStepImag,
            currentPhaseShiftReal,
            currentPhaseShiftImag,
            off,
            tr,
            ti,
            tmpReal;

        for (var i = 0; i < bufferSize; i++) {
            real[i] = buffer[reverseTable[i]] * this.windowValues[reverseTable[i]];
            imag[i] = 0;
        }

        while (halfSize < bufferSize) {
            phaseShiftStepReal = cosTable[halfSize];
            phaseShiftStepImag = sinTable[halfSize];

            currentPhaseShiftReal = 1;
            currentPhaseShiftImag = 0;

            for (var fftStep = 0; fftStep < halfSize; fftStep++) {
                var i = fftStep;

                while (i < bufferSize) {
                    off = i + halfSize;
                    tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
                    ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

                    real[off] = real[i] - tr;
                    imag[off] = imag[i] - ti;
                    real[i] += tr;
                    imag[i] += ti;

                    i += halfSize << 1;
                }

                tmpReal = currentPhaseShiftReal;
                currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
                currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
            }

            halfSize = halfSize << 1;
        }

        for (var i = 0, N = bufferSize / 2; i < N; i++) {
            rval = real[i];
            ival = imag[i];
            mag = bSi * sqrt(rval * rval + ival * ival);

            if (mag > this.peak) {
                this.peakBand = i;
                this.peak = mag;
            }
            spectrum[i] = mag;
        }
        return spectrum;
    };
};
/* eslint-enable complexity, no-redeclare, no-var, one-var */

/**
 * spectrogram plugin
 *
 * @param  {Object} params - parameters use to initialise the plugin
 * @return {Object} plugin - an object representing the plugin
 */
export default function spectrogram(params = {}) {
    return {
        name: 'spectrogram',
        deferInit: params && params.deferInit ? params.deferInit : false,
        static: {
            FFT
        },
        extends: 'observer',
        instance: Observer => class SpectrogramPlugin extends Observer {
            /**
            * List of params:
            *   wavesurfer: wavesurfer object
            *   pixelRatio: to control the size of the spectrogram in relation with its canvas. 1=Draw on the whole canvas. 2 = draw on a quarter (1/2 the lenght and 1/2 the width)
            *   fftSamples: number of samples to fetch to FFT. Must be a pwer of 2. Default = 512
            *   windowFunc: the window function to be used. Default is 'hann'. Choose from the following:
            *               + 'bartlett'
            *               + 'bartlettHann'
            *               + 'blackman'
            *               + 'cosine'
            *               + 'gauss'
            *               + 'hamming'
            *               + 'hann'
            *               + 'lanczoz'
            *               + 'rectangular'
            *               + 'triangular'
            *   alpha: some window functions have this extra value (0<alpha<1);
            *   noverlap: size of the overlapping window. Must be < fftSamples. Auto deduced from canvas size by default.
            */
            constructor(wavesurfer) {
                super();
                this.params = params;
                this.wavesurfer = wavesurfer;

                this.frequenciesDataUrl = params.frequenciesDataUrl;
                this._onReady = () => {
                    const drawer = this.drawer = this.wavesurfer.drawer;

                    this.container = 'string' == typeof params.container ?
                    document.querySelector(params.container) : params.container;

                    if (!this.container) {
                        throw Error('No container for WaveSurfer spectrogram');
                    }

                    this.width = drawer.width;
                    this.pixelRatio = this.params.pixelRatio || wavesurfer.params.pixelRatio;
                    this.fftSamples = this.params.fftSamples || wavesurfer.params.fftSamples || 512;
                    this.height = this.fftSamples / 2;
                    this.noverlap = params.noverlap;
                    this.windowFunc = params.windowFunc;
                    this.alpha = params.alpha;

                    this.createWrapper();
                    this.createCanvas();
                    this.render();

                    drawer.wrapper.addEventListener('scroll', e => {
                        this.updateScroll(e);
                    });
                    wavesurfer.on('redraw', () => this.render());
                };
            }

            init() {
                // Check if ws is ready
                if (this.wavesurfer.isReady) {
                    this._onReady();
                }

                this.wavesurfer.on('ready', this._onReady);
            }

            destroy() {
                this.unAll();
                this.wavesurfer.un('ready', this._onReady);
                if (this.wrapper) {
                    this.wrapper.parentNode.removeChild(this.wrapper);
                    this.wrapper = null;
                }
            }

            createWrapper() {
                const prevSpectrogram = this.container.querySelector('spectrogram');
                if (prevSpectrogram) {
                    this.container.removeChild(prevSpectrogram);
                }

                const wsParams = this.wavesurfer.params;

                this.wrapper = this.container.appendChild(
                    document.createElement('spectrogram')
                );
                this.drawer.style(this.wrapper, {
                    display: 'block',
                    position: 'relative',
                    userSelect: 'none',
                    webkitUserSelect: 'none',
                    height: this.height + 'px'
                });

                if (wsParams.fillParent || wsParams.scrollParent) {
                    this.drawer.style(this.wrapper, {
                        width: '100%',
                        overflowX: 'hidden',
                        overflowY: 'hidden'
                    });
                }

                this.wrapper.addEventListener('click', e => {
                    e.preventDefault();
                    const relX = 'offsetX' in e ? e.offsetX : e.layerX;
                    this.fireEvent('click', (relX / this.scrollWidth) || 0);
                });
            }

            createCanvas() {
                const canvas = this.canvas = this.wrapper.appendChild(
                    document.createElement('canvas')
                );

                this.spectrCc = canvas.getContext('2d');

                this.wavesurfer.drawer.style(canvas, {
                    position: 'absolute',
                    zIndex: 4
                });
            }

            render() {
                this.updateCanvasStyle();

                if (this.frequenciesDataUrl) {
                    this.loadFrequenciesData(this.frequenciesDataUrl);
                } else {
                    this.getFrequencies(this.drawSpectrogram);
                }
            }

            updateCanvasStyle() {
                const width = Math.round(this.width / this.pixelRatio) + 'px';
                this.canvas.width = this.width;
                this.canvas.height = this.height;
                this.canvas.style.width = width;
            }

            drawSpectrogram(frequenciesData, my) {
                const spectrCc = my.spectrCc;
                const length = my.wavesurfer.backend.getDuration();
                const height = my.height;
                const pixels = my.resample(frequenciesData);
                const heightFactor = my.buffer ? 2 / my.buffer.numberOfChannels : 1;
                let i;
                let j;

                for (i = 0; i < pixels.length; i++) {
                    for (j = 0; j < pixels[i].length; j++) {
                        const colorValue = 255 - pixels[i][j];
                        my.spectrCc.fillStyle = 'rgb(' + colorValue + ', ' + colorValue + ', ' + colorValue + ')';
                        my.spectrCc.fillRect(i, height - j * heightFactor, 1, heightFactor);
                    }
                }
            }

            getFrequencies(callback) {
                const fftSamples = this.fftSamples;
                const buffer = this.buffer = this.wavesurfer.backend.buffer;
                const channelOne = buffer.getChannelData(0);
                const bufferLength = buffer.length;
                const sampleRate = buffer.sampleRate;
                const frequencies = [];

                if (!buffer) {
                    this.fireEvent('error', 'Web Audio buffer is not available');
                    return;
                }

                let noverlap = this.noverlap;
                if (!noverlap) {
                    const uniqueSamplesPerPx = buffer.length / this.canvas.width;
                    noverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx));
                }

                const fft = new FFT(fftSamples, sampleRate, this.windowFunc, this.alpha);
                const maxSlicesCount = Math.floor(bufferLength/ (fftSamples - noverlap));
                let currentOffset = 0;

                while (currentOffset + fftSamples < channelOne.length) {
                    const segment = channelOne.slice(currentOffset, currentOffset + fftSamples);
                    const spectrum = fft.calculateSpectrum(segment);
                    const array = new Uint8Array(fftSamples/2);
                    let j;
                    for (j = 0; j<fftSamples/2; j++) {
                        array[j] = Math.max(-255, Math.log10(spectrum[j])*45);
                    }
                    frequencies.push(array);
                    currentOffset += (fftSamples - noverlap);
                }
                callback(frequencies, this);
            }

            loadFrequenciesData(url) {
                const ajax = this.wavesurfer.util.ajax({ url: url });

                ajax.on('success', data => this.drawSpectrogram(JSON.parse(data), this));
                ajax.on('error', e => this.fireEvent('error', 'XHR error: ' + e.target.statusText));

                return ajax;
            }

            updateScroll(e) {
                this.wrapper.scrollLeft = e.target.scrollLeft;
            }

            resample(oldMatrix) {
                const columnsNumber = this.width;
                const newMatrix = [];

                const oldPiece = 1 / oldMatrix.length;
                const newPiece = 1 / columnsNumber;
                let i;

                for (i = 0; i < columnsNumber; i++) {
                    const column = new Array(oldMatrix[0].length);
                    let j;

                    for (j = 0; j < oldMatrix.length; j++) {
                        const oldStart = j * oldPiece;
                        const oldEnd = oldStart + oldPiece;
                        const newStart = i * newPiece;
                        const newEnd = newStart + newPiece;

                        const overlap = (oldEnd <= newStart || newEnd <= oldStart) ?
                        0 :
                        Math.min(Math.max(oldEnd, newStart), Math.max(newEnd, oldStart)) -
                        Math.max(Math.min(oldEnd, newStart), Math.min(newEnd, oldStart));
                        let k;
                        /* eslint-disable max-depth */
                        if (overlap > 0) {
                            for (k = 0; k < oldMatrix[0].length; k++) {
                                if (column[k] == null) {
                                    column[k] = 0;
                                }
                                column[k] += (overlap / newPiece) * oldMatrix[j][k];
                            }
                        }
                        /* eslint-enable max-depth */
                    }

                    const intColumn = new Uint8Array(oldMatrix[0].length);
                    let m;

                    for (m = 0; m < oldMatrix[0].length; m++) {
                        intColumn[m] = column[m];
                    }

                    newMatrix.push(intColumn);
                }

                return newMatrix;
            }
        }
    };
}
