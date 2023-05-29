/**
 * Record audio from the microphone, render a waveform and download the audio.
 */

import BasePlugin from '../base-plugin.js'

export type RecordPluginOptions = {
  realtimeWaveColor?: string
  lineWidth?: number
}

export type RecordPluginEvents = {
  startRecording: []
  stopRecording: []
}

class RecordPlugin extends BasePlugin<RecordPluginEvents, RecordPluginOptions> {
  private mediaRecorder: MediaRecorder | null = null
  private recordedUrl = ''

  public static create(options?: RecordPluginOptions) {
    return new RecordPlugin(options || {})
  }

  private loadBlob(data: Blob[]) {
    const blob = new Blob(data, { type: 'audio/webm' })
    this.recordedUrl = URL.createObjectURL(blob)
    this.wavesurfer?.load(this.recordedUrl)
  }

  render(stream: MediaStream): () => void {
    if (!this.wavesurfer) return () => undefined

    const container = this.wavesurfer.getWrapper()
    const canvas = document.createElement('canvas')
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    canvas.style.zIndex = '10'
    container.appendChild(canvas)

    const canvasCtx = canvas.getContext('2d')
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    source.connect(analyser)
    let animationId: number

    const drawWaveform = () => {
      if (!canvasCtx) return

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteTimeDomainData(dataArray)

      canvasCtx.lineWidth = this.options.lineWidth || 2
      const color = this.options.realtimeWaveColor || this.wavesurfer?.options.waveColor || ''
      canvasCtx.strokeStyle = Array.isArray(color) ? color[0] : color
      canvasCtx.beginPath()

      const sliceWidth = (canvas.width * 1.0) / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2

        if (i === 0) {
          canvasCtx.moveTo(x, y)
        } else {
          canvasCtx.lineTo(x, y)
        }

        x += sliceWidth
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2)
      canvasCtx.stroke()
      animationId = requestAnimationFrame(drawWaveform)
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

      canvas?.remove()
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
    this.cleanUp()

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      throw new Error('Error accessing the microphone: ' + (err as Error).message)
    }

    const onStop = this.render(stream)
    const mediaRecorder = new MediaRecorder(stream)
    const recordedChunks: Blob[] = []

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    })

    mediaRecorder.addEventListener('stop', () => {
      onStop()
      this.loadBlob(recordedChunks)
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
