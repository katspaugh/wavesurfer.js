import EventEmitter from './event-emitter.js'
import type WaveSurfer from './wavesurfer.js'

export type BasePluginEvents = {
  destroy: []
}

export type GenericPlugin = BasePlugin<BasePluginEvents, unknown>

/** Base class for wavesurfer plugins */
export class BasePlugin<EventTypes extends BasePluginEvents, Options> extends EventEmitter<EventTypes> {
  protected wavesurfer?: WaveSurfer
  protected subscriptions: (() => void)[] = []
  protected options: Options
  private isDestroyed = false

  /** Whether destroy() has been called. Subclasses use this to guard async work. */
  protected get destroyed(): boolean {
    return this.isDestroyed
  }

  /** Create a plugin instance */
  constructor(options: Options) {
    super()
    this.options = options
  }

  /** Called after this.wavesurfer is available */
  protected onInit() {
    return
  }

  /** Do not call directly, only called by WavesSurfer internally */
  public _init(wavesurfer: WaveSurfer) {
    this.isDestroyed = false
    this.wavesurfer = wavesurfer
    this.onInit()
  }

  /** Destroy the plugin and unsubscribe from all events */
  public destroy() {
    if (this.isDestroyed) return
    this.isDestroyed = true
    this.emit('destroy')
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.subscriptions = []
    // Clear listeners registered BY consumers ON this plugin — after the
    // destroy event so those consumers still receive it
    this.unAll()
    this.wavesurfer = undefined
  }
}

export default BasePlugin
