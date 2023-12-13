/**
 * Record audio from the microphone with a real-time waveform preview
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'

export type RecordPluginOptions = {
  /** The MIME type to use when recording audio */
  mimeType?: MediaRecorderOptions['mimeType']
  /** The audio bitrate to use when recording audio, defaults to 128000 to avoid a VBR encoding. */
  audioBitsPerSecond?: MediaRecorderOptions['audioBitsPerSecond']
  /** Whether to render the recorded audio, true by default */
  renderRecordedAudio?: boolean
  /** Whether to render the scrolling waveform, false by default */
  scrollingWaveform?: boolean
  /** The duration of the scrolling waveform window, defaults to 5 seconds */
  scrollingWaveformWindow?: number
}

export type RecordPluginDeviceOptions = {
  /** The device ID of the microphone to use */
  deviceId?: string | { exact: string }
}

export type RecordPluginEvents = BasePluginEvents & {
  'record-start': []
  'record-pause': [blob: Blob]
  'record-resume': []
  'record-end': [blob: Blob]
}

type MicStream = {
  onDestroy: () => void
  onEnd: () => void
}

const DEFAULT_BITS_PER_SECOND = 128000
const DEFAULT_SCROLLING_WAVEFORM_WINDOW = 5

const MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3']
const findSupportedMimeType = () => MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))

class RecordPlugin extends BasePlugin<RecordPluginEvents, RecordPluginOptions> {
  private stream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null
  private dataWindow: Float32Array | null = null
  private isWaveformPaused = false
  private originalOptions = { cursorWidth: 1, interact: true }

  /** Create an instance of the Record plugin */
  constructor(options: RecordPluginOptions) {
    super({
      ...options,
      audioBitsPerSecond: options.audioBitsPerSecond ?? DEFAULT_BITS_PER_SECOND,
      scrollingWaveform: options.scrollingWaveform ?? false,
      scrollingWaveformWindow: options.scrollingWaveformWindow ?? DEFAULT_SCROLLING_WAVEFORM_WINDOW,
      renderRecordedAudio: options.renderRecordedAudio ?? true,
    })
  }

  /** Create an instance of the Record plugin */
  public static create(options?: RecordPluginOptions) {
    return new RecordPlugin(options || {})
  }

  public renderMicStream(stream: MediaStream): MicStream {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)

    let animationId: number

    const windowSize = Math.floor((this.options.scrollingWaveformWindow || 0) * audioContext.sampleRate)

    const drawWaveform = () => {
      if (this.isWaveformPaused) {
        animationId = requestAnimationFrame(drawWaveform)
        return
      }

      analyser.getFloatTimeDomainData(dataArray)

      if (this.options.scrollingWaveform) {
        const newLength = Math.min(windowSize, this.dataWindow ? this.dataWindow.length + bufferLength : bufferLength)
        const tempArray = new Float32Array(windowSize) // Always make it the size of the window, filling with zeros by default

        if (this.dataWindow) {
          const startIdx = Math.max(0, windowSize - this.dataWindow.length)
          tempArray.set(this.dataWindow.slice(-newLength + bufferLength), startIdx)
        }

        tempArray.set(dataArray, windowSize - bufferLength)
        this.dataWindow = tempArray
      } else {
        this.dataWindow = dataArray
      }

      const duration = this.options.scrollingWaveformWindow

      if (this.wavesurfer) {
        this.originalOptions = {
          cursorWidth: this.wavesurfer.options.cursorWidth,
          interact: this.wavesurfer.options.interact,
        }
        this.wavesurfer.options.cursorWidth = 0
        this.wavesurfer.options.interact = false
        this.wavesurfer.load('', [this.dataWindow], duration)
      }

      animationId = requestAnimationFrame(drawWaveform)
    }

    drawWaveform()

    return {
      onDestroy: () => {
        cancelAnimationFrame(animationId)
        source?.disconnect()
        audioContext?.close()
      },
      onEnd: () => {
        this.isWaveformPaused = true
        cancelAnimationFrame(animationId)
        this.stopMic()
      },
    }
  }

  /** Request access to the microphone and start monitoring incoming audio */
  public async startMic(options?: RecordPluginDeviceOptions): Promise<MediaStream> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: options?.deviceId ? { deviceId: options.deviceId } : true,
      })
    } catch (err) {
      throw new Error('Error accessing the microphone: ' + (err as Error).message)
    }

    const { onDestroy, onEnd } = this.renderMicStream(stream)
    this.subscriptions.push(this.once('destroy', onDestroy))
    this.subscriptions.push(this.once('record-end', onEnd))
    this.stream = stream

    return stream
  }

  /** Stop monitoring incoming audio */
  public stopMic() {
    if (!this.stream) return
    this.stream.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.mediaRecorder = null
  }

  /** Start recording audio from the microphone */
  public async startRecording(options?: RecordPluginDeviceOptions) {
    const stream = this.stream || (await this.startMic(options))
    this.dataWindow = null
    const mediaRecorder =
      this.mediaRecorder ||
      new MediaRecorder(stream, {
        mimeType: this.options.mimeType || findSupportedMimeType(),
        audioBitsPerSecond: this.options.audioBitsPerSecond,
      })
    this.mediaRecorder = mediaRecorder
    this.stopRecording()

    const recordedChunks: BlobPart[] = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    const emitWithBlob = (ev: 'record-pause' | 'record-end') => {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType })
      this.emit(ev, blob)
      if (this.options.renderRecordedAudio) {
        this.wavesurfer?.load(URL.createObjectURL(blob))
      }
    };

    mediaRecorder.onpause = () => emitWithBlob('record-pause')

    mediaRecorder.onstop = () => emitWithBlob('record-end')

    mediaRecorder.start()
    this.isWaveformPaused = false

    this.emit('record-start')
  }

  /** Check if the audio is being recorded */
  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  public isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused'
  }

  public isActive(): boolean {
    return this.mediaRecorder?.state !== 'inactive'
  }

  /** Stop the recording */
  public stopRecording() {
    if (this.isActive()) {
      this.mediaRecorder?.stop()
    }
  }

  /** Pause the recording */
  public pauseRecording() {
    if (this.isRecording()) {
      this.isWaveformPaused = true
      this.mediaRecorder?.requestData()
      this.mediaRecorder?.pause()
    }
  }

  /** Resume the recording */
  public resumeRecording() {
    if (this.isPaused()) {
      this.isWaveformPaused = false
      this.mediaRecorder?.resume()
      this.emit('record-resume')
    }
  }

  /** Get a list of available audio devices
   * You can use this to get the device ID of the microphone to use with the startMic and startRecording methods
   * Will return an empty array if the browser doesn't support the MediaDevices API or if the user has not granted access to the microphone
   * You can ask for permission to the microphone by calling startMic
   */
  public static async getAvailableAudioDevices() {
    return navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => devices.filter((device) => device.kind === 'audioinput'))
  }

  /** Destroy the plugin */
  public destroy() {
    if (this.wavesurfer) {
      this.wavesurfer.options.cursorWidth = this.originalOptions.cursorWidth
      this.wavesurfer.options.interact = this.originalOptions.interact
    }

    super.destroy()
    this.stopRecording()
    this.stopMic()
  }
}

export default RecordPlugin
