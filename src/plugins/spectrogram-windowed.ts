/**
 * Windowed Spectrogram plugin - Optimized for very long audio files
 * 
 * Only renders frequency data in a sliding window around the current viewport,
 * keeping memory usage constant regardless of audio length.
 */

// @ts-nocheck

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import createElement from '../dom.js'

// Reuse FFT function from original spectrogram
function FFT(bufferSize: number, sampleRate: number, windowFunc: string, alpha: number) {
  this.bufferSize = bufferSize
  this.sampleRate = sampleRate
  this.bandwidth = (2 / bufferSize) * (sampleRate / 2)

  this.sinTable = new Float32Array(bufferSize)
  this.cosTable = new Float32Array(bufferSize)
  this.windowValues = new Float32Array(bufferSize)
  this.reverseTable = new Uint32Array(bufferSize)

  this.peakBand = 0
  this.peak = 0

  var i
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

  var limit = 1
  var bit = bufferSize >> 1
  var i

  while (limit < bufferSize) {
    for (i = 0; i < limit; i++) {
      this.reverseTable[i + limit] = this.reverseTable[i] + bit
    }

    limit = limit << 1
    bit = bit >> 1
  }

  for (i = 0; i < bufferSize; i++) {
    this.sinTable[i] = Math.sin(-Math.PI / i)
    this.cosTable[i] = Math.cos(-Math.PI / i)
  }

  this.calculateSpectrum = function (buffer: Float32Array): Float32Array {
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
      real[i] = buffer[reverseTable[i]] * this.windowValues[reverseTable[i]]
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

declare class FFT {
  constructor(bufferSize: number, sampleRate: number, windowFunc: string, alpha: number)
  calculateSpectrum(buffer: Float32Array): Float32Array
}

const ERB_A = (1000 * Math.log(10)) / (24.7 * 4.37)

export type WindowedSpectrogramPluginOptions = {
  /** Selector of element or element in which to render */
  container?: string | HTMLElement
  /** Number of samples to fetch to FFT. Must be a power of 2. */
  fftSamples?: number
  /** Height of the spectrogram view in CSS pixels */
  height?: number
  /** Set to true to display frequency labels. */
  labels?: boolean
  labelsBackground?: string
  labelsColor?: string
  labelsHzColor?: string
  /** Size of the overlapping window. Must be < fftSamples. */
  noverlap?: number
  /** The window function to be used. */
  windowFunc?:
    | 'bartlett'
    | 'bartlettHann'
    | 'blackman'
    | 'cosine'
    | 'gauss'
    | 'hamming'
    | 'hann'
    | 'lanczoz'
    | 'rectangular'
    | 'triangular'
  /** Some window functions have this extra value. (Between 0 and 1) */
  alpha?: number
  /** Min frequency to scale spectrogram. */
  frequencyMin?: number
  /** Max frequency to scale spectrogram. */
  frequencyMax?: number
  /** Sample rate of the audio when using pre-computed spectrogram data. */
  sampleRate?: number
  /** Frequency scale type */
  scale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'
  /** Gain in dB */
  gainDB?: number
  /** Range in dB */
  rangeDB?: number
  /** Color map */
  colorMap?: number[][] | 'gray' | 'igray' | 'roseus'
  /** Render a spectrogram for each channel independently when true. */
  splitChannels?: boolean
  /** Window size in seconds (how much data to keep in memory) */
  windowSize?: number
  /** Buffer size in pixels (how much extra to render beyond viewport) */
  bufferSize?: number
}

export type WindowedSpectrogramPluginEvents = BasePluginEvents & {
  ready: []
  click: [relativeX: number]
}

/**
 * Represents a segment of frequency data in the sliding window
 */
interface FrequencySegment {
  startTime: number
  endTime: number
  startPixel: number
  endPixel: number
  frequencies: Uint8Array[][]
  canvas?: HTMLCanvasElement
}

class WindowedSpectrogramPlugin extends BasePlugin<WindowedSpectrogramPluginEvents, WindowedSpectrogramPluginOptions> {
  private container: HTMLElement
  private wrapper: HTMLElement
  private labelsEl: HTMLCanvasElement
  private canvasContainer: HTMLElement
  private colorMap: WindowedSpectrogramPluginOptions['colorMap']
  private fftSamples: WindowedSpectrogramPluginOptions['fftSamples']
  private height: WindowedSpectrogramPluginOptions['height']
  private noverlap: WindowedSpectrogramPluginOptions['noverlap']
  private windowFunc: WindowedSpectrogramPluginOptions['windowFunc']
  private alpha: WindowedSpectrogramPluginOptions['alpha']
  private frequencyMin: WindowedSpectrogramPluginOptions['frequencyMin']
  private frequencyMax: WindowedSpectrogramPluginOptions['frequencyMax']
  private gainDB: WindowedSpectrogramPluginOptions['gainDB']
  private rangeDB: WindowedSpectrogramPluginOptions['rangeDB']
  private scale: WindowedSpectrogramPluginOptions['scale']
  
  // Windowing properties
  private windowSize: number // seconds
  private bufferSize: number // pixels
  private segments: Map<string, FrequencySegment> = new Map()
  private buffer: AudioBuffer | null = null
  private currentPosition = 0 // current playback position in seconds
  private pixelsPerSecond = 0
  private isRendering = false
  private renderTimeout: number | null = null
  
  // FFT and processing
  private fft: FFT | null = null
  private numMelFilters: number
  private numLogFilters: number
  private numBarkFilters: number
  private numErbFilters: number

  static create(options?: WindowedSpectrogramPluginOptions) {
    return new WindowedSpectrogramPlugin(options || {})
  }

  constructor(options: WindowedSpectrogramPluginOptions) {
    super(options)

    this.container =
      'string' == typeof options.container ? document.querySelector(options.container) : options.container

    // Set up color map
    this.setupColorMap(options.colorMap)
    
    // FFT and processing options
    this.fftSamples = options.fftSamples || 512
    this.height = options.height || 200
    this.noverlap = options.noverlap || null // Will be calculated later based on canvas size, like normal plugin
    this.windowFunc = options.windowFunc || 'hann'
    this.alpha = options.alpha
    this.frequencyMin = options.frequencyMin || 0
    this.frequencyMax = options.frequencyMax || 0
    this.gainDB = options.gainDB ?? 20
    this.rangeDB = options.rangeDB ?? 80
    this.scale = options.scale || 'mel'

    // Windowing options
    this.windowSize = options.windowSize || 30 // 30 seconds window
    this.bufferSize = options.bufferSize || 5000 // 5000 pixels buffer

    // Filter banks
    this.numMelFilters = this.fftSamples / 2
    this.numLogFilters = this.fftSamples / 2
    this.numBarkFilters = this.fftSamples / 2
    this.numErbFilters = this.fftSamples / 2

    this.createWrapper()
    this.createCanvas()
  }

  private setupColorMap(colorMap?: WindowedSpectrogramPluginOptions['colorMap']) {
    if (colorMap && typeof colorMap !== 'string') {
      if (colorMap.length < 256) {
        throw new Error('Colormap must contain 256 elements')
      }
      this.colorMap = colorMap
    } else {
      const mapType = colorMap || 'roseus'
      switch (mapType) {
        case 'gray':
          this.colorMap = []
          for (let i = 0; i < 256; i++) {
            const val = (255 - i) / 256
            this.colorMap.push([val, val, val, 1])
          }
          break
        case 'igray':
          this.colorMap = []
          for (let i = 0; i < 256; i++) {
            const val = i / 256
            this.colorMap.push([val, val, val, 1])
          }
          break
        case 'roseus':
          // Full roseus colormap
          this.colorMap = [[0.004528, 0.004341, 0.004307, 1],[0.005625, 0.006156, 0.006010, 1],[0.006628, 0.008293, 0.008161, 1],[0.007551, 0.010738, 0.010790, 1],[0.008382, 0.013482, 0.013941, 1],[0.009111, 0.016520, 0.017662, 1],[0.009727, 0.019846, 0.022009, 1],[0.010223, 0.023452, 0.027035, 1],[0.010593, 0.027331, 0.032799, 1],[0.010833, 0.031475, 0.039361, 1],[0.010941, 0.035875, 0.046415, 1],[0.010918, 0.040520, 0.053597, 1],[0.010768, 0.045158, 0.060914, 1],[0.010492, 0.049708, 0.068367, 1],[0.010098, 0.054171, 0.075954, 1],[0.009594, 0.058549, 0.083672, 1],[0.008989, 0.062840, 0.091521, 1],[0.008297, 0.067046, 0.099499, 1],[0.007530, 0.071165, 0.107603, 1],[0.006704, 0.075196, 0.115830, 1],[0.005838, 0.079140, 0.124178, 1],[0.004949, 0.082994, 0.132643, 1],[0.004062, 0.086758, 0.141223, 1],[0.003198, 0.090430, 0.149913, 1],[0.002382, 0.094010, 0.158711, 1],[0.001643, 0.097494, 0.167612, 1],[0.001009, 0.100883, 0.176612, 1],[0.000514, 0.104174, 0.185704, 1],[0.000187, 0.107366, 0.194886, 1],[0.000066, 0.110457, 0.204151, 1],[0.000186, 0.113445, 0.213496, 1],[0.000587, 0.116329, 0.222914, 1],[0.001309, 0.119106, 0.232397, 1],[0.002394, 0.121776, 0.241942, 1],[0.003886, 0.124336, 0.251542, 1],[0.005831, 0.126784, 0.261189, 1],[0.008276, 0.129120, 0.270876, 1],[0.011268, 0.131342, 0.280598, 1],[0.014859, 0.133447, 0.290345, 1],[0.019100, 0.135435, 0.300111, 1],[0.024043, 0.137305, 0.309888, 1],[0.029742, 0.139054, 0.319669, 1],[0.036252, 0.140683, 0.329441, 1],[0.043507, 0.142189, 0.339203, 1],[0.050922, 0.143571, 0.348942, 1],[0.058432, 0.144831, 0.358649, 1],[0.066041, 0.145965, 0.368319, 1],[0.073744, 0.146974, 0.377938, 1],[0.081541, 0.147858, 0.387501, 1],[0.089431, 0.148616, 0.396998, 1],[0.097411, 0.149248, 0.406419, 1],[0.105479, 0.149754, 0.415755, 1],[0.113634, 0.150134, 0.424998, 1],[0.121873, 0.150389, 0.434139, 1],[0.130192, 0.150521, 0.443167, 1],[0.138591, 0.150528, 0.452075, 1],[0.147065, 0.150413, 0.460852, 1],[0.155614, 0.150175, 0.469493, 1],[0.164232, 0.149818, 0.477985, 1],[0.172917, 0.149343, 0.486322, 1],[0.181666, 0.148751, 0.494494, 1],[0.190476, 0.148046, 0.502493, 1],[0.199344, 0.147229, 0.510313, 1],[0.208267, 0.146302, 0.517944, 1],[0.217242, 0.145267, 0.525380, 1],[0.226264, 0.144131, 0.532613, 1],[0.235331, 0.142894, 0.539635, 1],[0.244440, 0.141559, 0.546442, 1],[0.253587, 0.140131, 0.553026, 1],[0.262769, 0.138615, 0.559381, 1],[0.271981, 0.137016, 0.565500, 1],[0.281222, 0.135335, 0.571381, 1],[0.290487, 0.133581, 0.577017, 1],[0.299774, 0.131757, 0.582404, 1],[0.309080, 0.129867, 0.587538, 1],[0.318399, 0.127920, 0.592415, 1],[0.327730, 0.125921, 0.597032, 1],[0.337069, 0.123877, 0.601385, 1],[0.346413, 0.121793, 0.605474, 1],[0.355758, 0.119678, 0.609295, 1],[0.365102, 0.117540, 0.612846, 1],[0.374443, 0.115386, 0.616127, 1],[0.383774, 0.113226, 0.619138, 1],[0.393096, 0.111066, 0.621876, 1],[0.402404, 0.108918, 0.624343, 1],[0.411694, 0.106794, 0.626540, 1],[0.420967, 0.104698, 0.628466, 1],[0.430217, 0.102645, 0.630123, 1],[0.439442, 0.100647, 0.631513, 1],[0.448637, 0.098717, 0.632638, 1],[0.457805, 0.096861, 0.633499, 1],[0.466940, 0.095095, 0.634100, 1],[0.476040, 0.093433, 0.634443, 1],[0.485102, 0.091885, 0.634532, 1],[0.494125, 0.090466, 0.634370, 1],[0.503104, 0.089190, 0.633962, 1],[0.512041, 0.088067, 0.633311, 1],[0.520931, 0.087108, 0.632420, 1],[0.529773, 0.086329, 0.631297, 1],[0.538564, 0.085738, 0.629944, 1],[0.547302, 0.085346, 0.628367, 1],[0.555986, 0.085162, 0.626572, 1],[0.564615, 0.085190, 0.624563, 1],[0.573187, 0.085439, 0.622345, 1],[0.581698, 0.085913, 0.619926, 1],[0.590149, 0.086615, 0.617311, 1],[0.598538, 0.087543, 0.614503, 1],[0.606862, 0.088700, 0.611511, 1],[0.615120, 0.090084, 0.608343, 1],[0.623312, 0.091690, 0.605001, 1],[0.631438, 0.093511, 0.601489, 1],[0.639492, 0.095546, 0.597821, 1],[0.647476, 0.097787, 0.593999, 1],[0.655389, 0.100226, 0.590028, 1],[0.663230, 0.102856, 0.585914, 1],[0.670995, 0.105669, 0.581667, 1],[0.678686, 0.108658, 0.577291, 1],[0.686302, 0.111813, 0.572790, 1],[0.693840, 0.115129, 0.568175, 1],[0.701300, 0.118597, 0.563449, 1],[0.708682, 0.122209, 0.558616, 1],[0.715984, 0.125959, 0.553687, 1],[0.723206, 0.129840, 0.548666, 1],[0.730346, 0.133846, 0.543558, 1],[0.737406, 0.137970, 0.538366, 1],[0.744382, 0.142209, 0.533101, 1],[0.751274, 0.146556, 0.527767, 1],[0.758082, 0.151008, 0.522369, 1],[0.764805, 0.155559, 0.516912, 1],[0.771443, 0.160206, 0.511402, 1],[0.777995, 0.164946, 0.505845, 1],[0.784459, 0.169774, 0.500246, 1],[0.790836, 0.174689, 0.494607, 1],[0.797125, 0.179688, 0.488935, 1],[0.803325, 0.184767, 0.483238, 1],[0.809435, 0.189925, 0.477518, 1],[0.815455, 0.195160, 0.471781, 1],[0.821384, 0.200471, 0.466028, 1],[0.827222, 0.205854, 0.460267, 1],[0.832968, 0.211308, 0.454505, 1],[0.838621, 0.216834, 0.448738, 1],[0.844181, 0.222428, 0.442979, 1],[0.849647, 0.228090, 0.437230, 1],[0.855019, 0.233819, 0.431491, 1],[0.860295, 0.239613, 0.425771, 1],[0.865475, 0.245471, 0.420074, 1],[0.870558, 0.251393, 0.414403, 1],[0.875545, 0.257380, 0.408759, 1],[0.880433, 0.263427, 0.403152, 1],[0.885223, 0.269535, 0.397585, 1],[0.889913, 0.275705, 0.392058, 1],[0.894503, 0.281934, 0.386578, 1],[0.898993, 0.288222, 0.381152, 1],[0.903381, 0.294569, 0.375781, 1],[0.907667, 0.300974, 0.370469, 1],[0.911849, 0.307435, 0.365223, 1],[0.915928, 0.313953, 0.360048, 1],[0.919902, 0.320527, 0.354948, 1],[0.923771, 0.327155, 0.349928, 1],[0.927533, 0.333838, 0.344994, 1],[0.931188, 0.340576, 0.340149, 1],[0.934736, 0.347366, 0.335403, 1],[0.938175, 0.354207, 0.330762, 1],[0.941504, 0.361101, 0.326229, 1],[0.944723, 0.368045, 0.321814, 1],[0.947831, 0.375039, 0.317523, 1],[0.950826, 0.382083, 0.313364, 1],[0.953709, 0.389175, 0.309345, 1],[0.956478, 0.396314, 0.305477, 1],[0.959133, 0.403499, 0.301766, 1],[0.961671, 0.410731, 0.298221, 1],[0.964093, 0.418008, 0.294853, 1],[0.966399, 0.425327, 0.291676, 1],[0.968586, 0.432690, 0.288696, 1],[0.970654, 0.440095, 0.285926, 1],[0.972603, 0.447540, 0.283380, 1],[0.974431, 0.455025, 0.281067, 1],[0.976139, 0.462547, 0.279003, 1],[0.977725, 0.470107, 0.277198, 1],[0.979188, 0.477703, 0.275666, 1],[0.980529, 0.485332, 0.274422, 1],[0.981747, 0.492995, 0.273476, 1],[0.982840, 0.500690, 0.272842, 1],[0.983808, 0.508415, 0.272532, 1],[0.984653, 0.516168, 0.272560, 1],[0.985373, 0.523948, 0.272937, 1],[0.985966, 0.531754, 0.273673, 1],[0.986436, 0.539582, 0.274779, 1],[0.986780, 0.547434, 0.276264, 1],[0.986998, 0.555305, 0.278135, 1],[0.987091, 0.563195, 0.280401, 1],[0.987061, 0.571100, 0.283066, 1],[0.986907, 0.579019, 0.286137, 1],[0.986629, 0.586950, 0.289615, 1],[0.986229, 0.594891, 0.293503, 1],[0.985709, 0.602839, 0.297802, 1],[0.985069, 0.610792, 0.302512, 1],[0.984310, 0.618748, 0.307632, 1],[0.983435, 0.626704, 0.313159, 1],[0.982445, 0.634657, 0.319089, 1],[0.981341, 0.642606, 0.325420, 1],[0.980130, 0.650546, 0.332144, 1],[0.978812, 0.658475, 0.339257, 1],[0.977392, 0.666391, 0.346753, 1],[0.975870, 0.674290, 0.354625, 1],[0.974252, 0.682170, 0.362865, 1],[0.972545, 0.690026, 0.371466, 1],[0.970750, 0.697856, 0.380419, 1],[0.968873, 0.705658, 0.389718, 1],[0.966921, 0.713426, 0.399353, 1],[0.964901, 0.721157, 0.409313, 1],[0.962815, 0.728851, 0.419594, 1],[0.960677, 0.736500, 0.430181, 1],[0.958490, 0.744103, 0.441070, 1],[0.956263, 0.751656, 0.452248, 1],[0.954009, 0.759153, 0.463702, 1],[0.951732, 0.766595, 0.475429, 1],[0.949445, 0.773974, 0.487414, 1],[0.947158, 0.781289, 0.499647, 1],[0.944885, 0.788535, 0.512116, 1],[0.942634, 0.795709, 0.524811, 1],[0.940423, 0.802807, 0.537717, 1],[0.938261, 0.809825, 0.550825, 1],[0.936163, 0.816760, 0.564121, 1],[0.934146, 0.823608, 0.577591, 1],[0.932224, 0.830366, 0.591220, 1],[0.930412, 0.837031, 0.604997, 1],[0.928727, 0.843599, 0.618904, 1],[0.927187, 0.850066, 0.632926, 1],[0.925809, 0.856432, 0.647047, 1],[0.924610, 0.862691, 0.661249, 1],[0.923607, 0.868843, 0.675517, 1],[0.922820, 0.874884, 0.689832, 1],[0.922265, 0.880812, 0.704174, 1],[0.921962, 0.886626, 0.718523, 1],[0.921930, 0.892323, 0.732859, 1],[0.922183, 0.897903, 0.747163, 1],[0.922741, 0.903364, 0.761410, 1],[0.923620, 0.908706, 0.775580, 1],[0.924837, 0.913928, 0.789648, 1],[0.926405, 0.919031, 0.803590, 1],[0.928340, 0.924015, 0.817381, 1],[0.930655, 0.928881, 0.830995, 1],[0.933360, 0.933631, 0.844405, 1],[0.936466, 0.938267, 0.857583, 1],[0.939982, 0.942791, 0.870499, 1],[0.943914, 0.947207, 0.883122, 1],[0.948267, 0.951519, 0.895421, 1],[0.953044, 0.955732, 0.907359, 1],[0.958246, 0.959852, 0.918901, 1],[0.963869, 0.963887, 0.930004, 1],[0.969909, 0.967845, 0.940623, 1],[0.976355, 0.971737, 0.950704, 1],[0.983195, 0.975580, 0.960181, 1],[0.990402, 0.979395, 0.968966, 1],[0.997930, 0.983217, 0.976920, 1]]
          break
        default:
          throw Error("No such colormap '" + mapType + "'")
      }
    }
  }

  onInit() {
    // Recreate DOM elements if they were destroyed
    if (!this.wrapper) {
      this.createWrapper()
    }
    if (!this.canvasContainer) {
      this.createCanvas()
    }

    // Always get fresh container reference to avoid stale references
    this.container = this.wavesurfer.getWrapper()
    this.container.appendChild(this.wrapper)

    // Set up styling
    if (this.wavesurfer.options.fillParent) {
      Object.assign(this.wrapper.style, {
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'hidden',
      })
    }

    // Listen for playback position changes
    this.subscriptions.push(
      this.wavesurfer.on('timeupdate', (currentTime) => {
        this.updatePosition(currentTime)
      })
    )

    // Listen for scroll events
    this.subscriptions.push(
      this.wavesurfer.on('scroll', () => {
        this.handleScroll()
      })
    )

    // Listen for zoom changes
    this.subscriptions.push(this.wavesurfer.on('redraw', () => this.handleRedraw()))

    // Listen for audio data ready
    this.subscriptions.push(this.wavesurfer.on('ready', () => {
      const decodedData = this.wavesurfer.getDecodedData()
      if (decodedData) {
        this.render(decodedData)
      }
    }))

    // Trigger initial render after re-initialization
    // This ensures the spectrogram appears even if no redraw event is fired
    if (this.wavesurfer.getDecodedData()) {
      // Use setTimeout to ensure DOM is fully ready
      setTimeout(() => {
        this.render(this.wavesurfer.getDecodedData())
      }, 0)
    }
  }

  private createWrapper() {
    this.wrapper = createElement('div', {
      style: {
        display: 'block',
        position: 'relative',
        userSelect: 'none',
      },
    })

    // Labels canvas
    if (this.options.labels) {
      this.labelsEl = createElement(
        'canvas',
        {
          part: 'spec-labels',
          style: {
            position: 'absolute',
            zIndex: 9,
            width: '55px',
            height: '100%',
          },
        },
        this.wrapper,
      )
    }

    // Click handler
    this.wrapper.addEventListener('click', this._onWrapperClick)
  }

  private createCanvas() {
    this.canvasContainer = createElement(
      'div',
      {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          zIndex: 4,
        },
      },
      this.wrapper,
    )
  }

  private handleRedraw() {
    const oldPixelsPerSecond = this.pixelsPerSecond
    this.pixelsPerSecond = this.getPixelsPerSecond()
    
    // Only update canvas positions if zoom changed, keep frequency data!
    if (oldPixelsPerSecond !== this.pixelsPerSecond && this.segments.size > 0) {
      this.updateSegmentPositions(oldPixelsPerSecond, this.pixelsPerSecond)
    }
    
    this.scheduleRender()
  }

  private updateSegmentPositions(oldPxPerSec: number, newPxPerSec: number) {
    for (const segment of this.segments.values()) {
      // Update pixel positions based on new zoom level
      segment.startPixel = segment.startTime * newPxPerSec
      segment.endPixel = segment.endTime * newPxPerSec
      
      // Update canvas positioning and size
      if (segment.canvas) {
        const segmentWidth = segment.endPixel - segment.startPixel
        segment.canvas.style.left = `${segment.startPixel}px`
        segment.canvas.style.width = `${segmentWidth}px`
        segment.canvas.width = Math.round(segmentWidth)
        
        // Redraw the canvas content at the new size
        this.redrawSegmentCanvas(segment)
      }
    }
  }

  private async redrawSegmentCanvas(segment: FrequencySegment) {
    if (!segment.canvas) return
    
    const ctx = segment.canvas.getContext('2d')
    if (!ctx) return
    
    const segmentWidth = segment.endPixel - segment.startPixel
    const totalHeight = this.height * segment.frequencies.length
    
    // Clear and redraw at new size
    ctx.clearRect(0, 0, segment.canvas.width, segment.canvas.height)
    
    // Get frequency scaling parameters like the normal plugin
    const freqFrom = this.buffer?.sampleRate ? this.buffer.sampleRate / 2 : 0
    const freqMin = this.frequencyMin
    const freqMax = this.frequencyMax || freqFrom
    
    // Render frequency data to canvas at new size with proper scaling
    for (let c = 0; c < segment.frequencies.length; c++) {
      await this.renderChannelToCanvas(
        segment.frequencies[c], 
        ctx, 
        segmentWidth, 
        this.height, 
        c * this.height,
        freqFrom,
        freqMin,
        freqMax
      )
    }
  }

  private handleScroll() {
    this.scheduleRender()
  }

  private updatePosition(currentTime: number) {
    this.currentPosition = currentTime
    this.scheduleRender()
  }

  private scheduleRender() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
    }
    this.renderTimeout = window.setTimeout(() => {
      this.renderVisibleWindow()
    }, 16) // 60fps
  }

  private async renderVisibleWindow() {
    if (this.isRendering || !this.buffer) return
    this.isRendering = true

    try {
      const wrapper = this.wavesurfer?.getWrapper()
      if (!wrapper) return

      // Calculate visible time range
      const scrollLeft = wrapper.scrollLeft || 0
      const containerWidth = wrapper.clientWidth || 0
      const pixelsPerSec = this.getPixelsPerSecond()

      const visibleStartTime = scrollLeft / pixelsPerSec
      const visibleEndTime = (scrollLeft + containerWidth) / pixelsPerSec

      // Add buffer around visible area
      const bufferTime = this.bufferSize / pixelsPerSec
      const windowStartTime = Math.max(0, visibleStartTime - bufferTime)
      const windowEndTime = Math.min(this.buffer.duration, visibleEndTime + bufferTime)

      // Generate segments for this window
      await this.generateSegments(windowStartTime, windowEndTime)

      // Clean up old segments outside window
      this.cleanupOldSegments(windowStartTime, windowEndTime)

    } finally {
      this.isRendering = false
    }
  }

  private async generateSegments(startTime: number, endTime: number) {
    if (!this.buffer) return

    const segmentDuration = 5 // 5 second segments
    const pixelsPerSec = this.getPixelsPerSecond()

    // Create segments covering the time range
    for (let time = startTime; time < endTime; time += segmentDuration) {
      const segmentStart = time
      const segmentEnd = Math.min(time + segmentDuration, endTime, this.buffer.duration)
      const segmentKey = `${Math.floor(segmentStart * 10)}_${Math.floor(segmentEnd * 10)}`

      // Skip if segment already exists
      if (this.segments.has(segmentKey)) continue

      // Calculate frequency data for this segment
      const frequencies = await this.calculateFrequencies(segmentStart, segmentEnd)
      
      if (frequencies && frequencies.length > 0) {
        const segment: FrequencySegment = {
          startTime: segmentStart,
          endTime: segmentEnd,
          startPixel: segmentStart * pixelsPerSec,
          endPixel: segmentEnd * pixelsPerSec,
          frequencies: frequencies
        }

        this.segments.set(segmentKey, segment)
        
        // Render this segment
        await this.renderSegment(segment)
      }
    }
  }

  private async calculateFrequencies(startTime: number, endTime: number): Promise<Uint8Array[][]> {
    if (!this.buffer) return []

    const sampleRate = this.buffer.sampleRate
    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.floor(endTime * sampleRate)
    const channels = this.options.splitChannels ? this.buffer.numberOfChannels : 1

    // Initialize FFT if needed
    if (!this.fft) {
      this.fft = new FFT(this.fftSamples, sampleRate, this.windowFunc, this.alpha)
    }

    // Calculate noverlap like the normal plugin
    let noverlap = this.noverlap
    if (!noverlap) {
      const segmentDuration = endTime - startTime
      const pixelsPerSec = this.getPixelsPerSecond()
      const segmentWidth = segmentDuration * pixelsPerSec
      const uniqueSamplesPerPx = (endSample - startSample) / segmentWidth
      noverlap = Math.max(0, Math.round(this.fftSamples - uniqueSamplesPerPx))
    }

    const frequencies: Uint8Array[][] = []
    const hopSize = this.fftSamples - noverlap

    for (let c = 0; c < channels; c++) {
      const channelData = this.buffer.getChannelData(c)
      const channelFreq: Uint8Array[] = []

      for (let sample = startSample; sample + this.fftSamples < endSample; sample += hopSize) {
        const segment = channelData.slice(sample, sample + this.fftSamples)
        let spectrum = this.fft.calculateSpectrum(segment)

        // Apply filter bank if needed
        const filterBank = this.getFilterBank(sampleRate)
        if (filterBank) {
          spectrum = this.applyFilterBank(spectrum, filterBank)
        }

        // Convert to uint8 color indices
        const freqBins = new Uint8Array(spectrum.length)
        for (let j = 0; j < spectrum.length; j++) {
          const magnitude = spectrum[j] > 1e-12 ? spectrum[j] : 1e-12
          const valueDB = 20 * Math.log10(magnitude)
          
          if (valueDB < -this.gainDB - this.rangeDB) {
            freqBins[j] = 0
          } else if (valueDB > -this.gainDB) {
            freqBins[j] = 255
          } else {
            freqBins[j] = ((valueDB + this.gainDB) / this.rangeDB) * 255 + 256
          }
        }
        channelFreq.push(freqBins)
      }
      frequencies.push(channelFreq)
    }

    return frequencies
  }

  private async renderSegment(segment: FrequencySegment) {
    const segmentWidth = segment.endPixel - segment.startPixel
    const totalHeight = this.height * segment.frequencies.length

    // Create canvas for this segment
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(segmentWidth)
    canvas.height = Math.round(totalHeight)
    canvas.style.position = 'absolute'
    canvas.style.left = `${segment.startPixel}px`
    canvas.style.top = '0'
    canvas.style.width = `${segmentWidth}px`
    canvas.style.height = `${totalHeight}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get frequency scaling parameters like the normal plugin
    const freqFrom = this.buffer?.sampleRate ? this.buffer.sampleRate / 2 : 0
    const freqMin = this.frequencyMin
    const freqMax = this.frequencyMax || freqFrom

    // Render frequency data to canvas with proper scaling
    for (let c = 0; c < segment.frequencies.length; c++) {
      await this.renderChannelToCanvas(
        segment.frequencies[c], 
        ctx, 
        segmentWidth, 
        this.height, 
        c * this.height,
        freqFrom,
        freqMin,
        freqMax
      )
    }

    // Add canvas to container
    segment.canvas = canvas
    this.canvasContainer.appendChild(canvas)
  }

  private async renderChannelToCanvas(
    channelFreq: Uint8Array[], 
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    yOffset: number,
    freqFrom: number,
    freqMin: number,
    freqMax: number
  ) {
    if (channelFreq.length === 0) return

    const freqBins = channelFreq[0].length
    const imageData = new ImageData(channelFreq.length, freqBins)
    const data = imageData.data

    // Fill image data
    for (let i = 0; i < channelFreq.length; i++) {
      const column = channelFreq[i]
      for (let j = 0; j < freqBins; j++) {
        const colorIndex = Math.min(255, Math.max(0, column[j]))
        const color = this.colorMap[colorIndex]
        const pixelIndex = ((freqBins - j - 1) * channelFreq.length + i) * 4
        
        data[pixelIndex] = color[0] * 255
        data[pixelIndex + 1] = color[1] * 255
        data[pixelIndex + 2] = color[2] * 255
        data[pixelIndex + 3] = color[3] * 255
      }
    }

    // Calculate frequency scaling like the normal plugin
    const rMin = this.hzToScale(freqMin) / this.hzToScale(freqFrom)
    const rMax = this.hzToScale(freqMax) / this.hzToScale(freqFrom)
    const rMax1 = Math.min(1, rMax)

    // Create and draw bitmap with proper frequency scaling
    const bitmap = await createImageBitmap(
      imageData,
      0,
      Math.round(freqBins * (1 - rMax1)),
      channelFreq.length,
      Math.round(freqBins * (rMax1 - rMin))
    )
    
    // Draw with proper height scaling
    const drawHeight = (height * rMax1) / rMax
    const drawY = yOffset + height * (1 - rMax1 / rMax)
    
    ctx.drawImage(bitmap, 0, drawY, width, drawHeight)
    
    // Clean up
    if ('close' in bitmap) {
      bitmap.close()
    }
  }

  private cleanupOldSegments(windowStartTime: number, windowEndTime: number) {
    for (const [key, segment] of this.segments) {
      // Remove segments outside the window
      if (segment.endTime < windowStartTime || segment.startTime > windowEndTime) {
        if (segment.canvas) {
          segment.canvas.remove()
        }
        this.segments.delete(key)
      }
    }
  }

  private clearAllSegments() {
    for (const segment of this.segments.values()) {
      if (segment.canvas) {
        segment.canvas.remove()
      }
    }
    this.segments.clear()
  }

  private getFilterBank(sampleRate: number): number[][] | null {
    switch (this.scale) {
      case 'mel':
        return this.createFilterBank(this.numMelFilters, sampleRate, this.hzToMel, this.melToHz)
      case 'logarithmic':
        return this.createFilterBank(this.numLogFilters, sampleRate, this.hzToLog, this.logToHz)
      case 'bark':
        return this.createFilterBank(this.numBarkFilters, sampleRate, this.hzToBark, this.barkToHz)
      case 'erb':
        return this.createFilterBank(this.numErbFilters, sampleRate, this.hzToErb, this.erbToHz)
      default:
        return null
    }
  }

  // Frequency scaling methods (same as original)
  private hzToMel(hz: number) { return 2595 * Math.log10(1 + hz / 700) }
  private melToHz(mel: number) { return 700 * (Math.pow(10, mel / 2595) - 1) }
  private hzToLog(hz: number) { return Math.log10(Math.max(1, hz)) }
  private logToHz(log: number) { return Math.pow(10, log) }
  private hzToBark(hz: number) {
    let bark = (26.81 * hz) / (1960 + hz) - 0.53
    if (bark < 2) bark += 0.15 * (2 - bark)
    if (bark > 20.1) bark += 0.22 * (bark - 20.1)
    return bark
  }
  private barkToHz(bark: number) {
    if (bark < 2) bark = (bark - 0.3) / 0.85
    if (bark > 20.1) bark = (bark + 4.422) / 1.22
    return 1960 * ((bark + 0.53) / (26.28 - bark))
  }
  private hzToErb(hz: number) { return ERB_A * Math.log10(1 + hz * 0.00437) }
  private erbToHz(erb: number) { return (Math.pow(10, erb / ERB_A) - 1) / 0.00437 }

  private createFilterBank(
    numFilters: number,
    sampleRate: number,
    hzToScale: (hz: number) => number,
    scaleToHz: (scale: number) => number,
  ): number[][] {
    const filterMin = hzToScale(0)
    const filterMax = hzToScale(sampleRate / 2)
    const filterBank = Array.from({ length: numFilters }, () => Array(this.fftSamples / 2 + 1).fill(0))
    const scale = sampleRate / this.fftSamples
    
    for (let i = 0; i < numFilters; i++) {
      let hz = scaleToHz(filterMin + (i / numFilters) * (filterMax - filterMin))
      let j = Math.floor(hz / scale)
      let hzLow = j * scale
      let hzHigh = (j + 1) * scale
      let r = (hz - hzLow) / (hzHigh - hzLow)
      filterBank[i][j] = 1 - r
      filterBank[i][j + 1] = r
    }
    return filterBank
  }

  private applyFilterBank(fftPoints: Float32Array, filterBank: number[][]): Float32Array {
    const numFilters = filterBank.length
    const logSpectrum = Float32Array.from({ length: numFilters }, () => 0)
    for (let i = 0; i < numFilters; i++) {
      for (let j = 0; j < fftPoints.length; j++) {
        logSpectrum[i] += fftPoints[j] * filterBank[i][j]
      }
    }
    return logSpectrum
  }

  private _onWrapperClick = (e: MouseEvent) => {
    const rect = this.wrapper.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const relativeWidth = rect.width
    const relativePosition = relativeX / relativeWidth
    this.emit('click', relativePosition)
  }

  private freqType(freq: number) {
    return freq >= 1000 ? (freq / 1000).toFixed(1) : Math.round(freq)
  }

  private unitType(freq: number) {
    return freq >= 1000 ? 'kHz' : 'Hz'
  }

  private hzToScale(hz: number) {
    switch (this.scale) {
      case 'mel':
        return this.hzToMel(hz)
      case 'logarithmic':
        return this.hzToLog(hz)
      case 'bark':
        return this.hzToBark(hz)
      case 'erb':
        return this.hzToErb(hz)
    }
    return hz
  }

  private scaleToHz(scale: number) {
    switch (this.scale) {
      case 'mel':
        return this.melToHz(scale)
      case 'logarithmic':
        return this.logToHz(scale)
      case 'bark':
        return this.barkToHz(scale)
      case 'erb':
        return this.erbToHz(scale)
    }
    return scale
  }

  private getLabelFrequency(index: number, labelIndex: number) {
    const scaleMin = this.hzToScale(this.frequencyMin)
    const scaleMax = this.hzToScale(this.frequencyMax)
    return this.scaleToHz(scaleMin + (index / labelIndex) * (scaleMax - scaleMin))
  }

  private loadLabels(
    bgFill?: string,
    fontSizeFreq?: string,
    fontSizeUnit?: string,
    fontType?: string,
    textColorFreq?: string,
    textColorUnit?: string,
    textAlign?: string,
    container?: string,
    channels?: number,
  ) {
    const frequenciesHeight = this.height
    bgFill = bgFill || 'rgba(68,68,68,0)'
    fontSizeFreq = fontSizeFreq || '12px'
    fontSizeUnit = fontSizeUnit || '12px'
    fontType = fontType || 'Helvetica'
    textColorFreq = textColorFreq || '#fff'
    textColorUnit = textColorUnit || '#fff'
    textAlign = textAlign || 'center'
    container = container || '#specLabels'
    const bgWidth = 55
    const getMaxY = frequenciesHeight || 512
    const labelIndex = 5 * (getMaxY / 256)
    const freqStart = this.frequencyMin
    const step = (this.frequencyMax - freqStart) / labelIndex

    // prepare canvas element for labels
    const ctx = this.labelsEl.getContext('2d')
    const dispScale = window.devicePixelRatio
    this.labelsEl.height = this.height * channels * dispScale
    this.labelsEl.width = bgWidth * dispScale
    ctx.scale(dispScale, dispScale)

    if (!ctx) {
      return
    }

    for (let c = 0; c < channels; c++) {
      // for each channel
      // fill background
      ctx.fillStyle = bgFill
      ctx.fillRect(0, c * getMaxY, bgWidth, (1 + c) * getMaxY)
      ctx.fill()
      let i

      // render labels
      for (i = 0; i <= labelIndex; i++) {
        ctx.textAlign = textAlign as CanvasTextAlign
        ctx.textBaseline = 'middle'

        const freq = this.getLabelFrequency(i, labelIndex)
        const label = this.freqType(freq)
        const units = this.unitType(freq)
        const x = 16
        let y = (1 + c) * getMaxY - (i / labelIndex) * getMaxY

        // Make sure label remains in view
        y = Math.min(Math.max(y, c * getMaxY + 10), (1 + c) * getMaxY - 10)

        // unit label
        ctx.fillStyle = textColorUnit
        ctx.font = fontSizeUnit + ' ' + fontType
        ctx.fillText(units, x + 24, y)
        // freq label
        ctx.fillStyle = textColorFreq
        ctx.font = fontSizeFreq + ' ' + fontType
        ctx.fillText(label.toString(), x, y)
      }
    }
  }

  async render(audioData: AudioBuffer) {
    this.buffer = audioData
    this.pixelsPerSecond = this.getPixelsPerSecond()
    this.frequencyMax = this.frequencyMax || audioData.sampleRate / 2

    // Set wrapper height
    const channels = this.options.splitChannels ? audioData.numberOfChannels : 1
    this.wrapper.style.height = this.height * channels + 'px'

    // Clear existing data
    this.clearAllSegments()

    // Render frequency labels if enabled
    if (this.options.labels) {
      this.loadLabels(
        this.options.labelsBackground,
        '12px',
        '12px',
        '',
        this.options.labelsColor,
        this.options.labelsHzColor || this.options.labelsColor,
        'center',
        '#specLabels',
        channels,
      )
    }

    // Start initial render
    this.scheduleRender()
    this.emit('ready')
  }

  destroy() {
    this.unAll()
    
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout)
      this.renderTimeout = null
    }
    
    this.clearAllSegments()
    
    // Clean up DOM elements properly
    if (this.canvasContainer) {
      this.canvasContainer.remove()
      this.canvasContainer = null
    }
    if (this.wrapper) {
      this.wrapper.remove()
      this.wrapper = null
    }
    if (this.labelsEl) {
      this.labelsEl.remove()
      this.labelsEl = null
    }
    
    // Reset state for potential re-initialization
    this.container = null
    this.buffer = null
    this.fft = null
    this.isRendering = false
    this.currentPosition = 0
    this.pixelsPerSecond = 0
    
    super.destroy()
  }

  // Add width calculation methods like the normal plugin
  private getWidth() {
    return this.wavesurfer?.getWrapper()?.offsetWidth || 0
  }

  private getWrapperWidth() {
    return this.wavesurfer?.getWrapper()?.clientWidth || 0
  }

  private getPixelsPerSecond() {
    // Handle default case when no zoom is specified
    const minPxPerSec = this.wavesurfer?.options.minPxPerSec
    if (minPxPerSec && minPxPerSec > 0) {
      return minPxPerSec
    }
    
    // Fallback: calculate based on wrapper width and audio duration
    if (this.buffer) {
      const wrapperWidth = this.getWidth()
      return wrapperWidth > 0 ? wrapperWidth / this.buffer.duration : 100 // Default fallback
    }
    
    return 100 // Default fallback
  }
}

export default WindowedSpectrogramPlugin 