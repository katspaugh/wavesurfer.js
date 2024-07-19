import BasePlugin, { BasePluginEvents } from "../base-plugin";
import createElement from "../dom";
import FFT, { FFTWindowFunction } from "../libs/fft";

const defaultOptions: SpectrogramFFTPluginOptions = {
    fftSamples: 512,
    frequencyMin: 0,
    frequencyMax: 1400,
    colorMap: [],
    windowFunc: 'hann',
    labels: true,
    labelsBackground: 'rgba(68,68,68,0)',
    labelsFont: 'Helvetica',
    labelsAlign: 'center',
    labelsFontSize: '12px',
    labelsHzFontSize: '12px',
    labelsColor: '#fff',
    labelsHzColor: '#fff',
}

export default class SpectrogramFFTPlugin extends BasePlugin<BasePluginEvents & { ready: [] }, SpectrogramFFTPluginOptions> {
    /** Selector of element or element in which to render */
    container?: HTMLElement

    /** Height of the spectrogram view in CSS pixels */
    width = 300;
    height = 300;
    buffer?: AudioBuffer

    wrapper = createElement('div', {
        style: {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
        },
    });
    canvas = createElement(
        'canvas',
        {
            style: {
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: '100%',
                height: '100%',
                zIndex: '4',
            },
        },
        this.wrapper,
    );

    spectrCc = this.canvas.getContext('2d')!
    // colorMap: number[][];
    labelsEl?: HTMLCanvasElement;

    static create(options: Partial<SpectrogramFFTPluginOptions>) {
        return new SpectrogramFFTPlugin(options)
    }

    constructor(options: Partial<SpectrogramFFTPluginOptions>) {
        super({ ...defaultOptions, ...options })
        this.validateColorMap()
        this.setupLabel()
    }

    private setupLabel() {
        if (!this.options.labels) return
        // if labels are active
        this.labelsEl = createElement(
            'canvas',
            {
                part: 'spec-labels',
                style: {
                    position: 'absolute',
                    zIndex: '9',
                    width: '55px',
                    height: '100%',
                },
            },
            this.wrapper,
        )

    }
    private validateColorMap() {
        let colorMap: number[][] = this.options.colorMap || [];
        let isColorMapValid = true

        if (colorMap.length == 0) {
            isColorMapValid = false
        } else if (colorMap.length < 256) {
            console.warn('Colormap must contain 256 elements')
            isColorMapValid = false
        } else {
            for (let i = 0; i < colorMap.length; i++) {
                if (colorMap[i].length !== 4) {
                    console.warn('ColorMap entries must contain 4 values')
                    isColorMapValid = false
                    break;
                }
            }
        }
        if (!isColorMapValid) {

            if (this.options.colorSets == 'light-grayscale') {
                for (let i = 0; i < 256; i++) {
                    const val = (255 - i) / 256
                    colorMap.push([val, val, val, 1])
                }
            } else {
                let R = 0, G = 0, B = 0
                // dark-yellow
                for (let i = 0; i < 256; i++) {
                    R = i / (256)
                    if (i > 63)
                        G = R - 0.25
                    colorMap.push([R, G, B, 1])
                }
            }
            this.options.colorMap = colorMap
        }
    }
    protected onInit(): void {
        if (!this.wavesurfer)
            throw new Error('Wavesurfer not ready')

        const container = this.container || this.wavesurfer.getWrapper()
        container.appendChild(this.wrapper)
        if (this.wavesurfer.options.fillParent) {
            Object.assign(this.wrapper.style, {
                width: '100%',
                overflowX: 'hidden',
                overflowY: 'hidden',
            })
        }
        this.subscriptions.push(this.wavesurfer.on('redraw', () => this.render()))
    }

    public destroy(): void {
        this.canvas.remove()
        this.wrapper.remove()
        this.container?.remove()
        this.labelsEl?.remove()
        super.destroy()
    }
    render() {
        const decodedData = this.wavesurfer?.getDecodedData()
        if (!decodedData) {
            return;
        }
        const freqs = this.getFrequencies(decodedData)
        console.debug('Freqs', freqs)
        this.drawSpectrogram(
            freqs
        )
    }

    private drawSpectrogram(frequenciesData: Uint8Array[][]) {
        // Set the height to fit all channels
        this.wrapper.style.height = this.height * frequenciesData.length + 'px'

        this.width = this.wavesurfer!.getWrapper().offsetWidth
        this.canvas.width = this.width
        this.canvas.height = this.height * frequenciesData.length

        const spectrCc = this.spectrCc
        const height = this.height
        const width = this.width
        const freqFrom = this.buffer!.sampleRate / 2
        const freqMin = this.options.frequencyMin
        const freqMax = this.options.frequencyMax

        if (!spectrCc) {
            return
        }

        for (let c = 0; c < frequenciesData.length; c++) {
            // for each channel
            const pixels = this.resample(frequenciesData[c])
            const imageData = new ImageData(width, height)

            for (let i = 0; i < pixels.length; i++) {
                for (let j = 0; j < pixels[i].length; j++) {
                    const colorMap = this.options.colorMap[pixels[i][j]]
                    const redIndex = ((height - j) * width + i) * 4
                    imageData.data[redIndex] = colorMap[0] * 255
                    imageData.data[redIndex + 1] = colorMap[1] * 255
                    imageData.data[redIndex + 2] = colorMap[2] * 255
                    imageData.data[redIndex + 3] = colorMap[3] * 255
                }
            }

            // scale and stack spectrograms
            createImageBitmap(imageData).then((renderer) => {
                spectrCc.drawImage(
                    renderer,
                    0,
                    height * (1 - freqMax / freqFrom), // source x, y
                    width,
                    (height * (freqMax - freqMin)) / freqFrom, // source width, height
                    0,
                    height * c, // destination x, y
                    width,
                    height, // destination width, height
                )
            })
        }

        if (this.options.labels) {
            this.drawLabels(frequenciesData.length)
        }

        this.emit('ready')
    }

    private resample(oldMatrix: Uint8Array[]) {
        const columnsNumber = this.width
        const newMatrix = []

        const oldPiece = 1 / oldMatrix.length
        const newPiece = 1 / columnsNumber
        let i

        for (i = 0; i < columnsNumber; i++) {
            const column = new Array(oldMatrix[0].length)
            let j

            for (j = 0; j < oldMatrix.length; j++) {
                const oldStart = j * oldPiece
                const oldEnd = oldStart + oldPiece
                const newStart = i * newPiece
                const newEnd = newStart + newPiece

                const overlap =
                    oldEnd <= newStart || newEnd <= oldStart
                        ? 0
                        : Math.min(Math.max(oldEnd, newStart), Math.max(newEnd, oldStart)) -
                        Math.max(Math.min(oldEnd, newStart), Math.min(newEnd, oldStart))
                let k
                /* eslint-disable max-depth */
                if (overlap > 0) {
                    for (k = 0; k < oldMatrix[0].length; k++) {
                        if (column[k] == null) {
                            column[k] = 0
                        }
                        column[k] += (overlap / newPiece) * oldMatrix[j][k]
                    }
                }
                /* eslint-enable max-depth */
            }

            const intColumn = new Uint8Array(oldMatrix[0].length)
            let m

            for (m = 0; m < oldMatrix[0].length; m++) {
                intColumn[m] = column[m]
            }

            newMatrix.push(intColumn)
        }

        return newMatrix
    }
    private freqType(freq: number) {
        return freq >= 1000 ? (freq / 1000).toFixed(1) : Math.round(freq).toString()
    }

    private unitType(freq: number) {
        return freq >= 1000 ? 'KHz' : 'Hz'
    }

    private getFrequencies(buffer: AudioBuffer): Uint8Array[][] {
        const fftSamples = this.options.fftSamples
        const channels = this.options.splitChannels ?? this.wavesurfer?.options.splitChannels ? buffer.numberOfChannels : 1

        const frequencyMax = this.options.frequencyMax || buffer.sampleRate / 2

        if (!buffer) return []

        this.buffer = buffer

        // This may differ from file samplerate. Browser resamples audio.
        const sampleRate = buffer.sampleRate
        const frequencies: Uint8Array[][] = []

        let noverlap = this.options.noverlap
        if (!noverlap) {
            const uniqueSamplesPerPx = buffer.length / this.canvas.width
            noverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx))
        }

        const fft = new FFT(fftSamples, sampleRate, this.options.windowFunc, this.options.alpha)

        for (let c = 0; c < channels; c++) {
            // for each channel
            const channelData = buffer.getChannelData(c)
            const channelFreq: Uint8Array[] = []
            let currentOffset = 0

            while (currentOffset + fftSamples < channelData.length) {
                const segment = channelData.slice(currentOffset, currentOffset + fftSamples)
                const spectrum = fft.calculateSpectrum(segment)
                const array = new Uint8Array(fftSamples / 2)
                for (let j = 0; j < fftSamples / 2; j++) {
                    array[j] = Math.max(-255, Math.log10(spectrum[j]) * 45)
                }
                channelFreq.push(array)
                // channelFreq: [sample, freq]

                currentOffset += fftSamples - noverlap
            }
            frequencies.push(channelFreq)
            // frequencies: [channel, sample, freq]
        }

        return frequencies
    }

    private drawLabels(numberOfChannels = 1) {
        if (!this.labelsEl) return

        const frequenciesHeight = this.height
        const bgWidth = 55
        const getMaxY = frequenciesHeight || 512
        const labelIndex = 5 * (getMaxY / 256)
        const freqStart = this.options.frequencyMin
        const step = (this.options.frequencyMax - freqStart) / labelIndex

        // prepare canvas element for labels
        const ctx = this.labelsEl.getContext('2d')!
        const dispScale = window.devicePixelRatio
        this.labelsEl.height = this.height * numberOfChannels * dispScale
        this.labelsEl.width = bgWidth * dispScale
        if (!ctx) {
            return
        }
        ctx.scale(dispScale, dispScale)

        for (let c = 0; c < numberOfChannels; c++) {
            // for each channel
            // fill background
            ctx.fillStyle = this.options.labelsBackground
            ctx.fillRect(0, c * getMaxY, bgWidth, (1 + c) * getMaxY)
            ctx.fill()
            let i

            // render labels
            for (i = 0; i <= labelIndex; i++) {
                ctx.textAlign = this.options.labelsAlign
                ctx.textBaseline = 'middle'

                const freq = freqStart + step * i
                const label = this.freqType(freq)
                const units = this.unitType(freq)
                const yLabelOffset = 2
                const x = 16
                let y

                if (i == 0) {
                    y = (1 + c) * getMaxY + i - 10
                } else {
                    y = (1 + c) * getMaxY - i * 50 + yLabelOffset
                }
                // unit label
                ctx.fillStyle = this.options.labelsHzColor
                ctx.font = this.options.labelsHzFontSize + ' ' + this.options.labelsFont
                ctx.fillText(units, x + 24, y)
                // freq label
                ctx.fillStyle = this.options.labelsColor
                ctx.font = this.options.labelsFontSize + ' ' + this.options.labelsFont
                ctx.fillText(label, x, y)
            }
        }
    }

}

export interface SpectrogramFFTPluginOptions {
    container?: string | HTMLElement
    /** Number of samples to fetch to FFT. Must be a power of 2. */
    fftSamples: number
    /** Min frequency to scale spectrogram. */
    frequencyMin: number
    /** Max frequency to scale spectrogram. Set this to samplerate/2 to draw whole range of spectrogram. */
    frequencyMax: number
    /**
     * A 256 long array of 4-element arrays. Each entry should contain a float between 0 and 1 and specify r, g, b, and alpha.
     * Each entry should contain a float between 0 and 1 and specify r, g, b, and alpha.
     */
    colorMap: number[][]
    colorSets?: 'dark-yellow' | 'light-grayscale'
    /** Size of the overlapping window. Must be < fftSamples. Auto deduced from canvas size by default. */
    noverlap?: number
    /** The window function to be used. */
    windowFunc: FFTWindowFunction
    /** Some window functions have this extra value. (Between 0 and 1) */
    alpha?: number
    /** Render a spectrogram for each channel independently when true. */
    splitChannels?: boolean
    labels: boolean
    labelsBackground: string
    labelsFont: string
    labelsAlign: CanvasTextAlign

    labelsFontSize: string
    labelsHzFontSize: string
    labelsColor: string
    labelsHzColor: string
}
