/**
 * BasePlugin - Legacy v7 plugin system for backward compatibility
 * Provides class-based plugin inheritance for existing plugins
 */

import EventEmitter from './event-emitter.js'
import type WaveSurfer from './wavesurfer.js'

export type BasePluginEvents = {
  destroy: []
}

export type GenericPlugin = BasePlugin<BasePluginEvents, unknown>

/**
 * Base class for wavesurfer plugins
 * @deprecated Use the new composition-based plugin system (createPlugin) for new plugins
 */
export class BasePlugin<EventTypes extends BasePluginEvents, Options> extends EventEmitter<EventTypes> {
  protected wavesurfer?: WaveSurfer
  protected subscriptions: (() => void)[] = []
  protected options: Options
  private isDestroyed = false

  /** Create a plugin instance */
  constructor(options: Options) {
    super()
    this.options = options
  }

  /** Called after this.wavesurfer is available */
  protected onInit() {
    return
  }

  /** Do not call directly, only called by WaveSurfer internally */
  public _init(wavesurfer: WaveSurfer) {
    // Reset state if plugin was previously destroyed
    if (this.isDestroyed) {
      this.subscriptions = []
      this.isDestroyed = false
    }

    this.wavesurfer = wavesurfer
    this.onInit()
  }

  /** Destroy the plugin and unsubscribe from all events */
  public destroy() {
    this.emit('destroy')
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.subscriptions = []
    this.isDestroyed = true
    this.wavesurfer = undefined
  }
}

export default BasePlugin
