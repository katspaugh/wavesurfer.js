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

/**
 * Define a functional wavesurfer plugin from a setup function.
 *
 * `setup` runs once per (re-)init on a fresh Scope; whatever it returns is
 * merged onto the plugin instance as its public API. Resources registered
 * via `ctx.scope.add(...)` are torn down when the plugin is destroyed.
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
      // Fresh scope per (re-)init so a destroy -> _init -> destroy cycle
      // starts each run with clean, undisposed resources.
      this.scope = new Scope()
      const api = setup(
        {
          wavesurfer: this.wavesurfer as WaveSurfer,
          scope: this.scope,
          state: (this.wavesurfer as WaveSurfer).getState(),
          emit: (event, ...args) => this.emit(event, ...args),
        },
        this.options,
      )
      Object.assign(this, api)
    }

    // Decided order: dispose the scope FIRST, then call super.destroy()
    // LAST (as everywhere else). super.destroy() emits 'destroy', drains
    // `subscriptions`, then unAll()s listeners registered on this plugin.
    // Consequence: scope teardown runs BEFORE the 'destroy' event is
    // delivered to consumers. That mirrors how previously-ported
    // class-based plugins tore down their own resources in destroy()
    // before calling super.destroy() — same relative order, so this is
    // consistent with existing plugin behavior.
    public destroy(): void {
      this.scope?.dispose()
      super.destroy()
    }
  }
  Object.defineProperty(Defined, 'name', { value: name })
  return Defined as unknown as DefinedPlugin<Options, Events, Api>
}
