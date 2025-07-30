import EventEmitter from './event-emitter.js'
import type WaveSurfer from './wavesurfer.js'

export type BasePluginEvents = {
  destroy: []
}

export type GenericPlugin = BasePlugin<BasePluginEvents, unknown>

export type Unsubscribe = () => void

/** Base class for wavesurfer plugins */
export class BasePlugin<EventTypes extends BasePluginEvents, Options> extends EventEmitter<EventTypes> {
  protected wavesurfer?: WaveSurfer
  protected subscriptions: Unsubscribe[] = []
  protected options: Options
  private removeableSubscriptions: Set<Unsubscribe> = new Set()
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

  /** Do not call directly, only called by WavesSurfer internally */
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
    this.unAll()
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    this.subscriptions = []
    this.removeableSubscriptions.forEach((unsubscribe) => unsubscribe())
    this.removeableSubscriptions.clear()
    this.isDestroyed = true
    this.wavesurfer = undefined
  }

  /**
   * Add subscriptions that will be removed after the `remove()` is called.
   *
   * It should be used when you want to subscribe to one-time events.
   *
   * @example
   * ```ts
   * this.addRemoveableSubscriptions((remove) =>
   *   emitter.once('some-event', () => {
   *     remove()
   *     // Do something
   *   })
   * )
   * ```
   */
  protected addRemoveableSubscriptions(handler: (remove: () => void) => Unsubscribe | Unsubscribe[]) {
    const unsubscribes = castArray(
      handler(() => {
        unsubscribes.forEach((unsubscribe) => {
          this.removeableSubscriptions.delete(unsubscribe)
        })
      }),
    )
    unsubscribes.forEach((unsubscribe) => {
      this.removeableSubscriptions.add(unsubscribe)
    })
  }
}

function castArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export default BasePlugin
