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

export type RecordPluginEvents = BasePluginEvents & {
  'record-start': []
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
  public async startMic(): Promise<MediaStream> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
  public async startRecording() {
    const stream = this.stream || (await this.startMic())

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

  /** Stop the recording */
  public stopRecording() {
    if (this.isRecording()) {
      this.mediaRecorder?.stop()
    }
  }

  /** Destroy the plugin */
  public destroy() {
    super.destroy()
    this.stopRecording()
    this.stopMic()
  }
}

export default RecordPlugin
