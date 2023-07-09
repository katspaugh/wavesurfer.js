/**
 * Record audio from the microphone, render a waveform and download the audio.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'

export type RecordPluginOptions = {
  mimeType?: MediaRecorderOptions['mimeType']
  audioBitsPerSecond?: MediaRecorderOptions['audioBitsPerSecond']
}

export type RecordPluginEvents = BasePluginEvents & {
  startRecording: []
  stopRecording: []
}

const MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3']
const findSupportedMimeType = () => MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))

class RecordPlugin extends BasePlugin<RecordPluginEvents, RecordPluginOptions> {
  private mediaRecorder: MediaRecorder | null = null
  private recordedUrl = ''
  private cursorWidth = 0

  public static create(options?: RecordPluginOptions) {
    return new RecordPlugin(options || {})
  }

  private hideCursor() {
    if (this.wavesurfer) {
      this.cursorWidth = this.wavesurfer.options.cursorWidth || 1
      this.wavesurfer.options.cursorWidth = 0
    }
  }

  onInit() {
    this.hideCursor()
  }

  private loadBlob(data: Blob[], type: string) {
    const blob = new Blob(data, { type })
    this.recordedUrl = URL.createObjectURL(blob)
    if (this.wavesurfer) {
      this.wavesurfer.options.cursorWidth = this.cursorWidth
      this.wavesurfer.load(this.recordedUrl)
    }
  }

  render(stream: MediaStream): () => void {
    const audioContext = new AudioContext({ sampleRate: 8000 })
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    source.connect(analyser)

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    const sampleDuration = bufferLength / audioContext.sampleRate

    let animationId: number

    const drawWaveform = () => {
      analyser.getFloatTimeDomainData(dataArray)
      this.wavesurfer?.load('', [dataArray], sampleDuration)
      animationId = requestAnimationFrame(drawWaveform)
    }

    if (this.wavesurfer) {
      this.cursorWidth = this.wavesurfer.options.cursorWidth || 1
      this.wavesurfer.options.cursorWidth = 0
    }

    drawWaveform()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }

      if (source) {
        source.disconnect()
        source.mediaStream.getTracks().forEach((track) => track.stop())
      }

      if (audioContext) {
        audioContext.close()
      }
    }
  }

  private cleanUp() {
    this.stopRecording()
    this.wavesurfer?.empty()
    if (this.recordedUrl) {
      URL.revokeObjectURL(this.recordedUrl)
      this.recordedUrl = ''
    }
  }

  public async startRecording() {
    this.hideCursor()
    this.cleanUp()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      throw new Error('Error accessing the microphone: ' + (err as Error).message)
    }

    const onStop = this.render(stream)
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: this.options.mimeType || findSupportedMimeType(),
      audioBitsPerSecond: this.options.audioBitsPerSecond,
    })
    const recordedChunks: Blob[] = []

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    })

    mediaRecorder.addEventListener('stop', () => {
      onStop()
      this.loadBlob(recordedChunks, mediaRecorder.mimeType)
      this.emit('stopRecording')
    })

    mediaRecorder.start()

    this.emit('startRecording')

    this.mediaRecorder = mediaRecorder
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  public stopRecording() {
    if (this.isRecording()) {
      this.mediaRecorder?.stop()
    }
  }

  public getRecordedUrl(): string {
    return this.recordedUrl
  }

  public destroy() {
    super.destroy()
    this.cleanUp()
  }
}

export default RecordPlugin
