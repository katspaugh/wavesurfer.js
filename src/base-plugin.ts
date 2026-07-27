import EventEmitter from './event-emitter.js'
import { Scope } from './scope.js'
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
  /**
   * A disposal scope owned by the plugin chassis. `definePlugin` (see
   * define-plugin.ts) replaces this with a fresh Scope on every (re-)init
   * and disposes it on destroy. BasePlugin itself does NOT dispose this —
   * class-based plugins that don't opt in are unaffected.
   */
  protected scope: Scope = new Scope()
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
