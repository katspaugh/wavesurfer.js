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

// `Record<string, never> extends Options` is true exactly when every
// property Options declares is optional (an index signature of `never`
// values satisfies any optional property, but can't satisfy a required
// one) — including `Options = {}`/`Record<string, never>` itself. That
// makes the constructor/`create()` parameter optional for all-optional
// options types (e.g. `HoverPluginOptions`) and required otherwise (e.g. an
// options type with a mandatory field), matching what a hand-written class
// with `constructor(options?: Options)` vs `constructor(options: Options)`
// would offer. See define-plugin.test.ts for the two-way compile-time
// check (a no-arg `create()` on a required-field Options type is rejected
// via `@ts-expect-error`).
type PluginCtorArgs<Options> = Record<string, never> extends Options ? [options?: Options] : [options: Options]

/** The constructor + factory produced by `definePlugin`. */
export type DefinedPlugin<Options, Events extends BasePluginEvents, Api extends object> = {
  new (...args: PluginCtorArgs<Options>): BasePlugin<Events, Options> & Api
  create(...args: PluginCtorArgs<Options>): BasePlugin<Events, Options> & Api
}

// Own-property names on the plugin chassis (BasePlugin + EventEmitter) that
// a setup()'s returned api must not shadow. Assigning over any of these via
// `Object.assign(this, api)` would silently disable core plugin machinery
// (e.g. an api key named `destroy` would shadow BasePlugin#destroy, making
// `plugin.destroy()` a no-op — a hard leak with no error). Checked
// unconditionally (not just in dev builds): failing fast beats a silent leak.
//
// Includes TS-`private` fields (`isDestroyed`, `listeners`) as well as
// `protected`/public ones: `private` is compile-time-only — it does not
// exist at runtime, and `Object.assign` does not respect it. An api key
// `isDestroyed` (truthy) would make `destroy()` a permanent no-op (the
// `if (this.isDestroyed) return` guard trips immediately); an api key
// `listeners` would replace EventEmitter's backing store and silently kill
// all event dispatch. (TS does catch precisely-typed collisions on these
// two at compile time too — the intersection type collapses to `never` —
// but that protection disappears the moment `Api` is `any`/untyped or the
// plugin is authored in plain JS, which is exactly what this runtime check
// is for.)
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
  'isDestroyed',
  'listeners',
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
 * undefined behavior. Symmetrically: calling an api method AFTER the
 * plugin has been destroyed is also undefined behavior — `ctx.wavesurfer`
 * is typed non-null, but `destroy()` sets the underlying field to
 * `undefined`, so a post-destroy read returns `undefined` at runtime
 * despite the type.
 *
 * `new Plugin(options)` / `Plugin.create(options)`: the `options` argument
 * is optional when (and only when) `Options` has no required properties
 * (see `PluginCtorArgs` below) — same ergonomics a hand-written
 * `constructor(options?: Options)` would give. When it's omitted, `setup`
 * is called with `options === undefined`, not `{}`; a `setup` for an
 * all-optional `Options` type must default it itself (e.g.
 * `Object.assign({}, defaultOptions, options)`), exactly as it already had
 * to for any individually-omitted field.
 */
export function definePlugin<Options, Events extends BasePluginEvents, Api extends object>(
  name: string,
  setup: PluginSetup<Options, Events, Api>,
): DefinedPlugin<Options, Events, Api> {
  class Defined extends BasePlugin<Events, Options> {
    // Runtime is permissive for both directions of PluginCtorArgs: a
    // missing arg is passed through as `undefined` (cast to `Options`).
    // For an all-optional Options type this is exactly what
    // `setup(ctx, options)` should see — setup is responsible for
    // defaulting (e.g. `Object.assign({}, defaultOptions, options)`), the
    // same way it always had to for any individually-omitted field.
    public static create(...args: PluginCtorArgs<Options>) {
      return new Defined(args[0] as Options) as Defined & Api
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
    // Consequence: scope-owned resources — including any root DOM element
    // removal registered via ctx.scope.add — are torn down BEFORE the
    // 'destroy' event reaches consumers (plugin.on('destroy', ...)).
    // This matches six of the eight original class-based plugins' destroy()
    // ordering (they tear down their own state before calling
    // super.destroy()). Two plugins — hover and regions — historically
    // removed their root DOM element AFTER super.destroy(), so a
    // 'destroy' listener could still observe an attached node.
    //
    // General rule for ports: default to tearing down the root element via
    // ctx.scope like everything else — that's simplest and matches most
    // plugins. Keep an element's removal OUT of ctx.scope (do it manually,
    // after the equivalent of super.destroy() has run) ONLY when a test or
    // documented consumer contract for that specific plugin actually pins
    // post-destroy attachment. This is a per-port decision, not a blanket
    // rule: hover's port (Task 5) checked its test suite, found nothing
    // pins the old ordering, and moved wrapper removal onto ctx.scope — a
    // deliberate, documented behavior change from the original hover.
    // Regions' port (Task 11) checked its own test suite (regions.test.ts +
    // memory-leaks.test.ts's #4243 cases) too, found nothing pins post-destroy
    // attachment of regionsContainer either, and likewise moved its removal
    // onto ctx.scope.
    public destroy(): void {
      this.scope.dispose() // always set (BasePlugin field initializer) — no `?.` needed
      super.destroy()
    }
  }
  Object.defineProperty(Defined, 'name', { value: name })
  return Defined as unknown as DefinedPlugin<Options, Events, Api>
}
