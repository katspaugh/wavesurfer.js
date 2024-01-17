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
    this.wavesurfer = wavesurfer
    this.onInit()
  }

  /** Destroy the plugin and unsubscribe from all events */
  public destroy() {
    this.emit('destroy')
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export default BasePlugin
