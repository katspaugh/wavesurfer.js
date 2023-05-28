import EventEmitter, { type GeneralEventTypes } from './event-emitter.js'
import type WaveSurfer from './wavesurfer.js'

export type GenericPlugin = BasePlugin<GeneralEventTypes, unknown>

export class BasePlugin<EventTypes extends GeneralEventTypes, Options> extends EventEmitter<EventTypes> {
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
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

export default BasePlugin
