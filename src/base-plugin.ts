import EventEmitter from './event-emitter.js'
import type WaveSurfer from './wavesurfer.js'

export type BasePluginEvents = {
  destroy: []
}

export type GenericPlugin = BasePlugin<BasePluginEvents, unknown>

export class BasePlugin<EventTypes extends BasePluginEvents, Options> extends EventEmitter<EventTypes> {
  protected wavesurfer?: WaveSurfer
  protected subscriptions: (() => void)[] = []
  protected options: Options

  constructor(options: Options) {
    super()
    this.options = options
  }

  onInit() {
    // Overridden in plugin definition
    return
  }

  init(wavesurfer: WaveSurfer) {
    this.wavesurfer = wavesurfer
    this.onInit()
  }

  destroy() {
    this.emit('destroy')
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export default BasePlugin
