/**
 * The Pitch plugin adjusts pitch without affecting playback speed
 * using SoundTouchJS AudioWorklet.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'

type SoundTouchNodeLike = AudioNode & {
  pitchSemitones: AudioParam
  playbackRate: AudioParam
}

type SoundTouchNodeCtor = {
  register: (audioContext: AudioContext, processorUrl: string) => Promise<void>
  new (options: { context: AudioContext }): SoundTouchNodeLike
}

type SoundTouchModule = {
  SoundTouchNode: SoundTouchNodeCtor
}

export type PitchPluginOptions = {
  /** Initial pitch offset in semitones. Positive = higher pitch, negative = lower pitch. */
  semitones?: number
  /** Minimum semitones allowed. */
  minSemitones?: number
  /** Maximum semitones allowed. */
  maxSemitones?: number
  /** Smoothing time for pitch transitions in seconds. */
  smoothingTimeConstant?: number
  /** URL to the SoundTouchJS ESM module export containing `SoundTouchNode`. */
  soundTouchModuleUrl?: string
  /** URL to SoundTouchJS processor script used by `SoundTouchNode.register`. */
  soundTouchProcessorUrl?: string
  /** Optional injected module for tests or custom bundling. */
  soundTouchModule?: SoundTouchModule
}

const defaultOptions = {
  semitones: 0,
  minSemitones: -24,
  maxSemitones: 24,
  smoothingTimeConstant: 0.02,
  soundTouchModuleUrl: 'https://unpkg.com/@soundtouchjs/audio-worklet?module',
  soundTouchProcessorUrl: 'https://unpkg.com/@soundtouchjs/audio-worklet/.dist/soundtouch-processor.js',
}

type WebAudioLikeMedia = {
  getGainNode: () => GainNode
}

const registeredProcessorUrls = new WeakMap<AudioContext, Set<string>>()

export type PitchPluginEvents = BasePluginEvents & {
  /** Fired when the DSP node is connected and ready */
  ready: []
  /** Fired when DSP initialization fails */
  error: [error: Error]
  /** Fired after pitch is applied */
  'pitch-change': [semitones: number, rate: number]
}

export class PitchPlugin extends BasePlugin<PitchPluginEvents, PitchPluginOptions> {
  protected options: PitchPluginOptions & typeof defaultOptions
  private semitones: number
  private gainNode: GainNode | null = null
  private audioContext: AudioContext | null = null
  private soundTouchNode: SoundTouchNodeLike | null = null
  private isReady = false

  constructor(options?: PitchPluginOptions) {
    super(options || {})
    this.options = Object.assign({}, defaultOptions, options)
    this.semitones = this.clampSemitones(this.options.semitones)
  }

  public static create(options?: PitchPluginOptions) {
    return new PitchPlugin(options)
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    this.initDsp().catch((err) => {
      this.emit('error', err instanceof Error ? err : new Error(String(err)))
    })
  }

  /** Set pitch in semitones */
  public setSemitones(semitones: number) {
    const nextSemitones = this.clampSemitones(semitones)
    if (nextSemitones === this.semitones) return
    this.semitones = nextSemitones
    this.applyPitch()
  }

  /** Get current pitch in semitones */
  public getSemitones(): number {
    return this.semitones
  }

  /** Set pitch in cents (100 cents = 1 semitone) */
  public setCents(cents: number) {
    this.setSemitones(cents / 100)
  }

  /** Get current pitch in cents */
  public getCents(): number {
    return this.semitones * 100
  }

  /** Set target playback rate directly and convert it to semitones */
  public setRate(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('rate must be a positive finite number')
    }
    this.setSemitones(12 * Math.log2(rate))
  }

  /** Get the playback rate derived from the current semitone shift */
  public getRate(): number {
    return Math.pow(2, this.semitones / 12)
  }

  private clampSemitones(value: number | undefined): number {
    const semitones = value ?? 0
    return Math.max(this.options.minSemitones, Math.min(this.options.maxSemitones, semitones))
  }

  private async initDsp() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    const media = this.wavesurfer.getMediaElement() as unknown as Partial<WebAudioLikeMedia>
    if (!media.getGainNode) {
      throw new Error('PitchPlugin requires backend: "WebAudio"')
    }

    this.gainNode = media.getGainNode()
    this.audioContext = this.gainNode.context as AudioContext

    if (!this.audioContext.audioWorklet) {
      throw new Error('AudioWorklet is not supported in this browser')
    }

    const soundTouchModule = await this.getSoundTouchModule()
    await this.ensureSoundTouchRegistered(this.audioContext, soundTouchModule.SoundTouchNode)
    this.soundTouchNode = new soundTouchModule.SoundTouchNode({ context: this.audioContext })

    this.gainNode.disconnect()
    this.gainNode.connect(this.soundTouchNode)
    this.soundTouchNode.connect(this.audioContext.destination)

    this.isReady = true
    this.applyPitch()
    this.emit('ready')
  }

  private async getSoundTouchModule(): Promise<SoundTouchModule> {
    if (this.options.soundTouchModule) {
      return this.options.soundTouchModule
    }

    const moduleUrl = this.options.soundTouchModuleUrl
    const dynamicImporter = new Function('url', 'return import(url)') as (url: string) => Promise<SoundTouchModule>
    return dynamicImporter(moduleUrl)
  }

  private async ensureSoundTouchRegistered(audioContext: AudioContext, SoundTouchNode: SoundTouchNodeCtor) {
    const processorUrl = this.options.soundTouchProcessorUrl
    const registered = registeredProcessorUrls.get(audioContext)
    if (registered?.has(processorUrl)) return

    await SoundTouchNode.register(audioContext, processorUrl)

    const nextRegistered = registered ?? new Set<string>()
    nextRegistered.add(processorUrl)
    registeredProcessorUrls.set(audioContext, nextRegistered)
  }

  private applyPitch() {
    if (!this.wavesurfer || !this.soundTouchNode || !this.isReady || !this.audioContext) return

    const now = this.audioContext.currentTime
    this.soundTouchNode.pitchSemitones.cancelScheduledValues(now)
    this.soundTouchNode.playbackRate.cancelScheduledValues(now)

    this.soundTouchNode.pitchSemitones.setTargetAtTime(this.semitones, now, this.options.smoothingTimeConstant)
    this.soundTouchNode.playbackRate.setTargetAtTime(1, now, this.options.smoothingTimeConstant)

    // Keep playback speed constant while shifting pitch in DSP.
    this.wavesurfer.setPlaybackRate(1)
    this.emit('pitch-change', this.semitones, this.getRate())
  }

  /** Unmount */
  public destroy() {
    if (this.gainNode && this.audioContext) {
      this.gainNode.disconnect()
      this.soundTouchNode?.disconnect()
      this.gainNode.connect(this.audioContext.destination)
    }

    this.soundTouchNode = null
    this.gainNode = null
    this.audioContext = null
    this.isReady = false
    super.destroy()
  }
}

export default PitchPlugin