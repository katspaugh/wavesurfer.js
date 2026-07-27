import BasePlugin, { type BasePluginEvents } from './base-plugin.js'
import { Scope } from './scope.js'
import type WaveSurfer from './wavesurfer.js'
import type { WaveSurferState } from './state/wavesurfer-state.js'

/** Everything a plugin's setup function needs, handed in fresh on every (re-)init. */
export interface PluginContext<Events extends BasePluginEvents> {
  wavesurfer: WaveSurfer
  scope: Scope // disposed (and replaced) on plugin destroy
  state: WaveSurferState // wavesurfer.getState()
  // `Events[K] extends unknown[] ? Events[K] : never` (rather than a bare
  // `Events[K]`) is required because `Events` is only constrained to
  // `BasePluginEvents` (no index signature), so TS can't otherwise prove
  // `Events[K]` is array-shaped for a rest parameter. For any real event
  // map (all values are tuples) this resolves to the same effective type.
  emit: <K extends keyof Events>(event: K, ...args: Events[K] extends unknown[] ? Events[K] : never) => void
}

/** A plugin's setup function: receives the context and options, returns its public API. */
export type PluginSetup<Options, Events extends BasePluginEvents, Api extends object> = (
  ctx: PluginContext<Events>,
  options: Options,
) => Api

/** The constructor + factory produced by `definePlugin`. */
export type DefinedPlugin<Options, Events extends BasePluginEvents, Api extends object> = {
  new (options: Options): BasePlugin<Events, Options> & Api
  create(options: Options): BasePlugin<Events, Options> & Api
}

// Own-property names on the plugin chassis (BasePlugin + EventEmitter) that
// a setup()'s returned api must not shadow. Assigning over any of these via
// `Object.assign(this, api)` would silently disable core plugin machinery
// (e.g. an api key named `destroy` would shadow BasePlugin#destroy, making
// `plugin.destroy()` a no-op — a hard leak with no error). Checked
// unconditionally (not just in dev builds): failing fast beats a silent leak.
const RESERVED_CHASSIS_KEYS = new Set([
  'destroy',
  '_init',
  'emit',
  'on',
  'un',
  'once',
  'unAll',
  'options',
  'wavesurfer',
  'subscriptions',
  'scope',
  'destroyed',
])

/**
 * Define a functional wavesurfer plugin from a setup function.
 *
 * `setup` runs once per (re-)init on a fresh Scope; whatever it returns is
 * merged onto the plugin instance as its public API. Resources registered
 * via `ctx.scope.add(...)` are torn down when the plugin is destroyed.
 *
 * Api methods only exist on the instance after `_init()` has run (i.e.
 * after `wavesurfer.registerPlugin(...)`); accessing them beforehand is
 * undefined behavior.
 */
export function definePlugin<Options, Events extends BasePluginEvents, Api extends object>(
  name: string,
  setup: PluginSetup<Options, Events, Api>,
): DefinedPlugin<Options, Events, Api> {
  class Defined extends BasePlugin<Events, Options> {
    public static create(options: Options) {
      return new Defined(options) as Defined & Api
    }

    protected onInit(): void {
      // Self-healing: if onInit somehow runs twice without an intervening
      // destroy(), dispose the stale scope first rather than leaking it.
      this.scope.dispose()
      // Fresh scope per (re-)init so a destroy -> _init -> destroy cycle
      // starts each run with clean, undisposed resources.
      this.scope = new Scope()
      const plugin = this
      const ctx: PluginContext<Events> = {
        // Lazy getters (not values captured at setup time): api closures
        // that read ctx.wavesurfer/ctx.state later see the CURRENT plugin
        // state, not a snapshot from init. This also means an api closure
        // can't pin a destroyed plugin's WaveSurfer alive — destroy() nulls
        // `this.wavesurfer`, and the getter reads that live field. It also
        // means test stubs that don't implement getState() only need to if
        // the setup/api actually calls ctx.state.
        get wavesurfer() {
          return plugin.wavesurfer as WaveSurfer
        },
        get state() {
          return (plugin.wavesurfer as WaveSurfer).getState()
        },
        scope: this.scope,
        emit: (event, ...args) => this.emit(event, ...args),
      }
      const api = setup(ctx, this.options)
      for (const key of Object.keys(api)) {
        if (RESERVED_CHASSIS_KEYS.has(key)) {
          throw new Error(`definePlugin('${name}'): api key "${key}" collides with the plugin chassis`)
        }
      }
      Object.assign(this, api)
    }

    // Decided order: dispose the scope FIRST, then call super.destroy()
    // LAST (as everywhere else). super.destroy() emits 'destroy', drains
    // `subscriptions`, then unAll()s listeners registered on this plugin.
    // Consequence: scope-owned resources are torn down BEFORE the
    // 'destroy' event reaches consumers (plugin.on('destroy', ...)).
    // This matches six of the eight current class-based plugins' destroy()
    // ordering (they tear down their own state before calling
    // super.destroy()). Two plugins — hover and regions — intentionally
    // remove their root DOM element AFTER super.destroy() so 'destroy'
    // listeners still observe an attached node; ports of those plugins
    // should keep that specific element removal OUT of ctx.scope (do it
    // manually, after super.destroy(), instead of via ctx.scope.add) to
    // preserve that behavior.
    public destroy(): void {
      this.scope.dispose() // always set (BasePlugin field initializer) — no `?.` needed
      super.destroy()
    }
  }
  Object.defineProperty(Defined, 'name', { value: name })
  return Defined as unknown as DefinedPlugin<Options, Events, Api>
}
