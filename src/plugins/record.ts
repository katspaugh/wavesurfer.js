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
}

export type RecordPluginDeviceOptions = {
  /** The device ID of the microphone to use */
  deviceId?: string | { exact: string }
}

export type RecordPluginEvents = BasePluginEvents & {
  'record-start': []
  'record-pause': []
  'record-resume': []
  'record-end': [blob: Blob]
}

const DEFAULT_BITS_PER_SECOND = 128000

const MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3']
const findSupportedMimeType = () => MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))

class RecordPlugin extends BasePlugin<RecordPluginEvents, RecordPluginOptions> {
  private stream: MediaStream | null = null
  private mediaRecorder: MediaRecorder | null = null

  /** Create an instance of the Record plugin */
  constructor(options: RecordPluginOptions) {
    super({
      ...options,
      audioBitsPerSecond: options.audioBitsPerSecond ?? DEFAULT_BITS_PER_SECOND,
    })
  }

  /** Create an instance of the Record plugin */
  public static create(options?: RecordPluginOptions) {
    return new RecordPlugin(options || {})
  }

  private renderMicStream(stream: MediaStream): () => void {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    const sampleDuration = bufferLength / audioContext.sampleRate

    let animationId: number

    const drawWaveform = () => {
      analyser.getFloatTimeDomainData(dataArray)
      if (this.wavesurfer) {
        this.wavesurfer.options.cursorWidth = 0
        this.wavesurfer.options.interact = false
        this.wavesurfer.load('', [dataArray], sampleDuration)
      }
      animationId = requestAnimationFrame(drawWaveform)
    }

    drawWaveform()

    return () => {
      cancelAnimationFrame(animationId)
      source?.disconnect()
      audioContext?.close()
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

    const onDestroy = this.renderMicStream(stream)

    this.subscriptions.push(this.once('destroy', onDestroy))

    this.stream = stream

    return stream
  }

  /** Stop monitoring incoming audio */
  public stopMic() {
    if (!this.stream) return
    this.stream.getTracks().forEach((track) => track.stop())
    this.stream = null
  }

  /** Start recording audio from the microphone */
  public async startRecording(options?: RecordPluginDeviceOptions) {
    const stream = this.stream || (await this.startMic(options))

    const mediaRecorder =
      this.mediaRecorder ||
      new MediaRecorder(stream, {
        mimeType: this.options.mimeType || findSupportedMimeType(),
        audioBitsPerSecond: this.options.audioBitsPerSecond,
      })
    this.mediaRecorder = mediaRecorder
    this.stopRecording()

    const recordedChunks: Blob[] = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType })

      this.emit('record-end', blob)

      if (this.options.renderRecordedAudio !== false) {
        this.wavesurfer?.load(URL.createObjectURL(blob))
      }
    }

    mediaRecorder.start()

    this.emit('record-start')
  }

  /** Check if the audio is being recorded */
  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  public isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused'
  }

  /** Stop the recording */
  public stopRecording() {
    if (this.isRecording()) {
      this.mediaRecorder?.stop()
      this.stream?.getTracks().forEach((track) => track.stop())
    }
  }

  /** Pause the recording */
  public pauseRecording() {
    if (this.isRecording()) {
      this.mediaRecorder?.pause()
      this.emit('record-pause')
    }
  }

  /** Resume the recording */
  public resumeRecording() {
    if (this.isPaused()) {
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
    super.destroy()
    this.stopRecording()
    this.stopMic()
  }
}

export default RecordPlugin
