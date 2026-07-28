# wavesurfer.js Declarative Refactor — Roadmap (post-PR #4340)

Status after PR #4340 (`refactor/scope-and-leak-fixes`, 26 signed commits):
leak fixes across core+plugins landed; `Scope` disposal tree owns all core
cleanup; signal store v2 (disposable computed, batch, auto-tracking); state
writes truthful; events emitted exactly once. Baseline: 420 jest tests,
tsc+eslint clean.

Three sub-projects remain, in execution order. Each produces working,
releasable software on its own; each gets its own full plan document when
its turn comes (Plan 2 is written now; 3 and 4 depend on interfaces Plan 2
lands, so they are specified here and planned in detail later).

## Plan 2 — Declarative load & viewport (DONE ✓, full plan in 2026-07-27-declarative-load-and-viewport.md)

Implemented in branch `refactor/declarative-load-and-viewport` (7 tasks, all passing). Produced interfaces (for Plans 3/4 authors):

**Types & signals:**
- `LoadPhase = 'idle'|'fetching'|'decoding'|'ready'|'error'`
- `WaveSurferState.loadPhase: Signal<LoadPhase>` — replaces polling `isReady`, provides exact load state
- `Renderer.getVisibleRange(): Signal<{startTime: number; endTime: number}>` — computed per-render, freezes post-destroy

**Utilities:**
- `computeCanvasPlan({totalWidth, clientWidth, options})` returning `{numCanvases, singleCanvasWidth, slots: CanvasSlot[]}` where `CanvasSlot = {index, offset, width}`
- `FrameScheduler(scope)` constructor; synchronous first tick on `start()`

**Patterns:**
- Per-load `loadScope: Scope` + `supersededLoadScopes: WeakSet<Scope>` in `WaveSurfer.ts` for abort-on-new-load
- Load lifecycle on child `Scope` + `AbortSignal`: replaces `_loadVersion`, `_isDestroyed` post-await guards, and `abortController`
- Deferred-minor cleanup sweep completed (webaudio stale-src guard, envelope polyline null, duplicate drag-stream tests, computed subscriber clearing on dispose).

## Plan 3 — definePlugin + plugin ports (DONE ✓, full plan in 2026-07-27-define-plugin.md)

Implemented in branch `refactor/define-plugin` (12 tasks, all passing:
465 jest tests, tsc+eslint clean). `definePlugin` is re-exported from the
main entry (`wavesurfer.ts`) alongside `PluginContext`/`PluginSetup`/
`DefinedPlugin`. Six plugins ported (hover, zoom, timeline, minimap,
envelope, regions); record deliberately NOT ported (see ruling below);
spectrograms deliberately NOT ported (Plan 4). Produced interfaces (for
Plan 4's author):

**`definePlugin` / `PluginContext` (src/define-plugin.ts):**
```typescript
export interface PluginContext<Events extends BasePluginEvents> {
  wavesurfer: WaveSurfer   // lazy getter — reads the CURRENT plugin.wavesurfer,
                           // not a snapshot; undefined after destroy() despite the type
  scope: Scope             // fresh per (re-)init; disposed on destroy, BEFORE super.destroy()
  state: WaveSurferState   // lazy getter — wavesurfer.getState() read live, not cached
  emit: <K extends keyof Events>(event: K, ...args: Events[K] extends unknown[] ? Events[K] : never) => void
}
export type PluginSetup<Options, Events extends BasePluginEvents, Api extends object> =
  (ctx: PluginContext<Events>, options: Options) => Api
export type DefinedPlugin<Options, Events extends BasePluginEvents, Api extends object> = {
  new (...args: PluginCtorArgs<Options>): BasePlugin<Events, Options> & Api
  create(...args: PluginCtorArgs<Options>): BasePlugin<Events, Options> & Api
}
export function definePlugin<Options, Events extends BasePluginEvents, Api extends object>(
  name: string,
  setup: PluginSetup<Options, Events, Api>,
): DefinedPlugin<Options, Events, Api>
```
- `ctx.wavesurfer`/`ctx.state` are **lazy getters**, not values captured at
  setup time — api closures always see current plugin state and can't pin a
  destroyed WaveSurfer alive.
- **API collision guard**: every key returned by `setup()` is checked at
  init time against a `RESERVED_CHASSIS_KEYS` set (`destroy`, `_init`,
  `emit`, `on`, `un`, `once`, `unAll`, `options`, `wavesurfer`,
  `subscriptions`, `scope`, `destroyed`, `isDestroyed`, `listeners` —
  includes TS-`private` chassis fields, which `Object.assign` doesn't
  respect at runtime); a collision throws
  `definePlugin('<name>'): api key "<key>" collides with the plugin chassis`
  instead of silently disabling core plugin machinery.
- **`PluginCtorArgs<Options>` optionality rule**: `new Plugin(options)` /
  `Plugin.create(options)` takes the options argument as *optional* iff
  every property of `Options` is optional (`Record<string, never> extends
  Options`), otherwise required — matching what a hand-written
  `constructor(options?: Options)` vs `constructor(options: Options)` would
  offer. When omitted, `setup` receives `options === undefined` (not `{}`)
  — setup must default it itself.
- **Destroy order**: `ctx.scope.dispose()` runs FIRST, `super.destroy()`
  (emits `'destroy'`, drains legacy `subscriptions`, then `unAll()`s
  listeners) runs LAST. Scope-owned root-DOM-element removal is therefore
  torn down BEFORE the `'destroy'` event reaches consumers. Two plugins
  (hover, regions) historically removed their root element AFTER
  `super.destroy()` so a `'destroy'` listener could still observe an
  attached node; both ports checked their test suites, found nothing pins
  that ordering, and moved removal onto `ctx.scope` (documented, deliberate
  behavior change — see RELEASE_NOTES-scope-refactor.md).

**`plugin-utils.ts` (consumed by every port):**
```typescript
export function resolveContainer(
  option: HTMLElement | string | undefined,
  fallback: HTMLElement,
  pluginName: string,
): HTMLElement
// string → querySelector, throws `${pluginName}: container not found: ${option}` on miss;
// HTMLElement → itself; undefined → fallback.

export function overlayElement(
  scope: Scope,
  parent: HTMLElement,
  style?: Partial<CSSStyleDeclaration>,
): HTMLElement
// position:absolute div appended to parent; scope.add(() => el.remove()).

export function bridgeEvents<Events extends Record<string, unknown[]>>(
  scope: Scope,
  from: { on: (e: never, cb: never) => () => void },
  to: { emit: (e: never, ...args: never[]) => void },
  names: Array<keyof Events & string>,
): void
// Forwards each named event from `from` to `to.emit`; each subscription is scope.add()'d.
```

**Per-region child-scope pattern (regions.ts, Task 11):** each `SingleRegion`
owns a private `scope: Scope` handed to it by the plugin — `const
regionScope = ctx.scope.child()` — tracked in a `WeakMap<Region, Scope>` on
the plugin side. `region.remove()` disposes `regionScope` (cascading
through `ctx.scope`'s child-scope tree) instead of draining a hand-rolled
`subscriptions` array; drag-selection's in-progress region gets its own
`regionScope` too, disposed and re-created per drag. Same pattern name
(`regionScope`, `.child()`) used consistently; minimap's Task 8 nested-
wavesurfer scope uses the identical `ctx.scope.child()` primitive (there
called `miniScope`) for the same drain-before-recreate need.

**RECORD stays class-based (ruling, Task 10):** `RecordPlugin` is usable
standalone (construct → `startMic`/`record` → `destroy`, without ever
calling `registerPlugin`), which `definePlugin`'s setup-at-init model
cannot express — its constructor builds a `Timer` and its destroy path
must work pre-init. `RecordPlugin` remains a `BasePlugin` subclass with an
explicit `destroy()` override, but internally adopts the chassis's
`protected scope: Scope` for its resources. Its public surface, and the
`destroy()` override itself, are unchanged. Any future consolidation
(e.g. if `definePlugin` grows a pre-init-usable variant) is out of scope
for Plan 3/4.

Shared utilities killed the copy-paste classes found in review:
`resolveContainer()` (one error behavior, replaced 4 divergent copies),
`overlayElement()` (replaced ~6 hand-rolled copies), `bridgeEvents()`
(replaced minimap's 64 forwarder lines with one call). `BasePlugin` stays
exported and functional — both as the chassis `definePlugin` builds on
and, unchanged, for third-party class-based plugins and `record.ts`.

## Plan 4 — Spectrogram unification + leak harness + lint bans (DONE ✓, full plan in 2026-07-28-spectrogram-and-hardening.md)

Implemented in branch `refactor/spectrogram-unification` (6 tasks, all passing: 537 jest
tests + 7/7 GC-leak tests, tsc+eslint clean, full build clean). One spectrogram plugin
(`SpectrogramPlugin`) with `rendering: 'full' | 'windowed'` as a strategy; single shared
`computeFrequencies` kernel (`src/spectrogram-frequencies.ts`) imported by both the worker and
main thread, replacing three near-identical ~130-line copies; one options type + validation
block; configurable `workerTimeout` unified across both rendering modes; both spectrogram
`@ts-nocheck` headers removed (the pre-existing one in `src/fft.ts` is untouched — out of this
phase's scope, unrelated to the spectrogram plugins). `spectrogram-windowed.ts` survives as a
thin deprecated shim (`WindowedSpectrogramPlugin` = its own `definePlugin` call that delegates
into the same `spectrogramSetup()` with `rendering: 'windowed'` forced), keeping its dist entry
and full test surface (including private-poke tests) working. Plus a `FinalizationRegistry`/
`WeakRef` GC-leak harness (`src/__tests__/gc-leaks.test.ts`, run via `yarn test:leaks` under
`node --expose-gc`, excluded from the default jest project) and ESLint `no-restricted-syntax`
bans on raw `addEventListener`/`setTimeout`/`setInterval`/`requestAnimationFrame`/
`new ResizeObserver`/`new Worker` outside a curated primitive-file allowlist (`src/scope.ts`,
`src/timer.ts`, `src/frame-scheduler.ts`, the `src/reactive/*-stream.ts` files, `src/player.ts`
line-scoped, `src/fetcher.ts`) — every hit adjudicated, one real violation fixed
(`src/renderer.ts`'s raw `new ResizeObserver` moved onto a new `Scope.createResizeObserver()`
primitive). See `docs/RELEASE_NOTES-scope-refactor.md`'s Phase 4 section for the full behavior-
delta list and the `getFrequenciesData()` post-destroy cache-write race found and fixed in the
final task.

## REFACTOR COMPLETE

All four sub-projects of the declarative refactor (Plan 1 — Scope/leak fixes and PR #4340
groundwork predating this roadmap's Plan 2 numbering, Plan 2 — declarative load & viewport,
Plan 3 — `definePlugin` + plugin ports, Plan 4 — spectrogram unification + leak harness + lint
bans) are done and merged onto `refactor/spectrogram-unification`'s lineage. Closing summary:

- **Leak-safety primitive**: `Scope`, a disposal tree every core/plugin resource (listeners,
  timers, RAF loops, resize/intersection observers, workers, child scopes) is now registered on,
  torn down in one `dispose()` call, and — as of Plan 4 — regression-tested at the GC level
  (`FinalizationRegistry`/`WeakRef` harness under `node --expose-gc`), not just via manual
  reference-counting review.
- **Declarative load/viewport state**: `loadPhase`/`getVisibleRange()` signals and a pure
  `computeCanvasPlan()` replaced ad hoc polling/flags for load and render-viewport state (Plan 2).
- **Functional plugin chassis**: `definePlugin(name, (ctx, options) => api)` is the now-preferred
  way to write a first-party plugin; seven of eight first-party plugins (`hover`, `zoom`,
  `timeline`, `minimap`, `envelope`, `regions`, and now `spectrogram`/`spectrogram-windowed`) are
  built on it. `record` remains class-based by deliberate ruling (needs pre-`registerPlugin()`
  usability that `definePlugin`'s setup-at-init model can't express).
- **Spectrogram unification**: one plugin, one shared frequency-computation kernel, a
  `rendering: 'full' | 'windowed'` strategy instead of two divergent implementations, and a
  deprecated-but-functional shim for the old `WindowedSpectrogramPlugin` entry point.
- **Hardening**: ESLint now structurally prevents new raw `addEventListener`/timer/observer/
  worker acquisitions outside `Scope`'s own primitive files, and the GC-leak harness gives that
  guarantee a runtime regression test, not just a lint-time one.
- Public API surface (exported plugin classes, `create()` signatures, option fields, event
  names/payloads) is preserved throughout; every intentional behavior change is called out in
  `docs/RELEASE_NOTES-scope-refactor.md`'s Phase 2/3/4 sections.

## Deliberately deferred (recommendation, not scheduled)

Deriving the public events from state (the original proposal's "events as
a projection") is deferred indefinitely: the double-emission bug it
targeted is fixed, event timing is contractual for v7 consumers, and the
migration risk now outweighs the architectural win. Revisit only at a
major version boundary.
