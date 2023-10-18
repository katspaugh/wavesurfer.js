import EventEmitter from './event-emitter.js'

type WebAudioPlayerEvents = {
  loadedmetadata: []
  canplay: []
  play: []
  pause: []
  seeking: []
  timeupdate: []
  volumechange: []
  emptied: []
  ended: []
}

/**
 * A Web Audio buffer player emulating the behavior of an HTML5 Audio element.
 */
class WebAudioPlayer extends EventEmitter<WebAudioPlayerEvents> {
  private audioContext: AudioContext
  private gainNode: GainNode
  private bufferNode: AudioBufferSourceNode | null = null
  private autoplay = false
  private playStartTime = 0
  private playedDuration = 0
  private _src = ''
  private _muted = false
  private buffer: AudioBuffer | null = null
  public paused = true
  public crossOrigin: string | null = null

  constructor(audioContext = new AudioContext()) {
    super()
    this.audioContext = audioContext
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
  }

  async load() {
    return
  }

  get src() {
    return this._src
  }

  set src(value: string) {
    this._src = value

    fetch(value)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => this.audioContext.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        this.buffer = audioBuffer

        this.emit('loadedmetadata')
        this.emit('canplay')

        if (this.autoplay) {
          this.play()
        }
      })
  }

  async play() {
    if (!this.paused) return
    this.paused = false

    this.bufferNode?.disconnect()
    this.bufferNode = this.audioContext.createBufferSource()
    this.bufferNode.buffer = this.buffer
    this.bufferNode.connect(this.gainNode)

    const offset = this.playedDuration > 0 ? this.playedDuration : 0
    const start =
      this.playedDuration > 0 ? this.audioContext.currentTime : this.audioContext.currentTime - this.playedDuration

    this.bufferNode.start(start, offset)
    this.playStartTime = this.audioContext.currentTime
    this.emit('play')

    this.bufferNode.onended = () => {
      if (this.currentTime >= this.duration) {
        this.emit('pause')
        this.emit('ended')
      }
    }
  }

  pause() {
    if (this.paused) return
    this.paused = true
    this.bufferNode?.stop()
    this.playedDuration += this.audioContext.currentTime - this.playStartTime
    this.emit('pause')
  }

  async setSinkId(deviceId: string) {
    const ac = this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> }
    return ac.setSinkId(deviceId)
  }

  get playbackRate() {
    return this.bufferNode?.playbackRate.value ?? 1
  }
  set playbackRate(value) {
    if (this.bufferNode) {
      this.bufferNode.playbackRate.value = value
    }
  }

  get currentTime() {
    return this.paused ? this.playedDuration : this.playedDuration + this.audioContext.currentTime - this.playStartTime
  }
  set currentTime(value) {
    this.emit('seeking')

    if (this.paused) {
      this.playedDuration = value
    } else {
      this.pause()
      this.playedDuration = value
      this.play()
    }

    this.emit('timeupdate')
  }

  get duration() {
    return this.buffer?.duration || 0
  }

  get volume() {
    return this.gainNode.gain.value
  }
  set volume(value) {
    this.gainNode.gain.value = value
    this.emit('volumechange')
  }

  get muted() {
    return this._muted
  }
  set muted(value: boolean) {
    if (this._muted === value) return
    this._muted = value

    if (this._muted) {
      this.gainNode.disconnect()
    } else {
      this.gainNode.connect(this.audioContext.destination)
    }
  }
}

export default WebAudioPlayer
