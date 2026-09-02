import EventEmitter from './event-emitter.js'
import { Scope } from './scope.js'
import type WaveSurfer from './wavesurfer.js'

export type BasePluginEvents = {
  destroy: []
}

export type GenericPlugin = BasePlugin<BasePluginEvents, unknown>

/**
 * Base class for wavesurfer plugins.
 *
 * @deprecated Authoring plugins as `BasePlugin` subclasses is deprecated and
 * will be removed in v9 -- use `definePlugin` instead (see
 * `src/define-plugin.ts`, and any of the first-party plugins as a reference).
 * `BasePlugin` remains the runtime chassis `definePlugin` builds on, so
 * defined plugins are still `BasePlugin` instances and existing class-based
 * plugins keep working throughout v8.
 */
export class BasePlugin<EventTypes extends BasePluginEvents, Options> extends EventEmitter<EventTypes> {
  protected wavesurfer?: WaveSurfer
  protected subscriptions: (() => void)[] = []
  protected options: Options
  /**
   * A disposal scope owned by the plugin chassis, disposed by destroy().
   * `definePlugin` (see define-plugin.ts) replaces this with a fresh Scope
   * on every (re-)init; class-based plugins that support destroy() ->
   * _init() re-init must do the same in onInit().
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
    // Dispose the chassis scope: a class-based plugin using the inviting
    // `this.scope.listen(...)` and relying on inherited destroy() must not
    // leak every registered resource. Idempotent for definePlugin's subclass
    // (which disposes it first, before super.destroy()); subclasses that
    // support re-init recreate the scope in onInit().
    this.scope.dispose()
    this.wavesurfer = undefined
  }
}

export default BasePlugin
