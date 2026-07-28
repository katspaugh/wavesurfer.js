# Release notes: `refactor/scope-and-leak-fixes`

Draft release-note bullets for the PR that merges this branch (based on `main` @ `ae8d3cd`,
current package version `7.12.11`). Copy/trim into the changelog as needed.

## Breaking changes

- **`WaveSurfer` no longer exposes `protected subscriptions` / `protected mediaSubscriptions`.**
  These per-instance disposer arrays were replaced by the new `Scope` disposal-tree primitive
  (`this.scope`). Any subclass that pushed its own cleanup callbacks onto
  `this.subscriptions`/`this.mediaSubscriptions` will fail to compile against this version's
  TypeScript types (the fields no longer exist) and must migrate to `this.scope.add(disposer)`
  instead. This is a source-level break for TypeScript subclasses; there is no runtime shim.

- **Several internal modules are no longer emitted to `dist/`,** so deep imports through the
  package's `./dist/*` wildcard export will now 404 / fail to resolve:
  - `dist/draggable.js`
  - `dist/reactive/event-stream-emitter.js`
  - `dist/reactive/media-event-bridge.js`
  - `dist/reactive/render-scheduler.js`
  - `dist/reactive/state-event-emitter.js`

  These were internal, unreferenced-in-source modules (verified via repo-wide grep before
  deletion) that happened to be reachable only because `./dist/*` mechanically wildcard-matches
  every file `tsc` compiles from `src/`, not because they were a curated public API. Anyone
  importing one of these paths directly (outside the documented `.` and `./plugins/*` entry
  points) needs to drop the import or reimplement the functionality locally.

## Fixes

- **`Spectrogram`'s `maxCanvasWidth` is now tracked per-instance instead of on a shared static.**
  Previously, setting `maxCanvasWidth` on one Spectrogram instance mutated a class-level static
  shared by every instance, so multiple spectrograms on a page (or a spectrogram created after
  another with different options) could silently pick up the wrong value. Each instance now owns
  its own value.

- **Several events are now emitted exactly once instead of twice.** A previous internal
  state -> event bridge caused `pause`, `seeking`, `finish`, and `timeupdate` (among others) to
  double-fire under certain conditions; that bridge has been removed and events are now emitted
  directly, exactly once per underlying occurrence. If application code was compensating for
  double emission (e.g. dividing counts by two, deduplicating manually), that workaround is no
  longer needed and should be removed.

- **The WebAudio backend now emits an `error` event on load failure** instead of silently
  swallowing it. Code using `backend: 'WebAudio'` that previously had no visibility into decode/
  load failures can now listen for `wavesurfer.on('error', ...)`.

- Various destroy-time and async-continuation leak fixes across plugins (record, spectrogram,
  spectrogram-windowed, regions, envelope, timeline/hover, minimap) so that: recordings emit
  their final blob even if `onstop` fires after `destroy()` returns without leaking a blob URL,
  in-flight async work no longer touches DOM state after destroy, and duplicate/leftover event
  listeners are cleaned up correctly. See individual commit messages on this branch for the
  fix-by-fix detail.

## New / documented internals

- **New `Scope` primitive** (`src/scope.ts`): a disposal-tree ownership primitive used
  throughout the codebase for listeners, timers, observers, signal subscriptions, and child
  lifetimes. Disposing a `Scope` is idempotent, disposes children before its own disposers (LIFO
  for its own), and any disposer added after disposal runs immediately instead of leaking. Every
  `destroy()` in the codebase is now expressed as disposing a `Scope`. This replaced the old
  per-class `subscriptions`/`mediaSubscriptions` disposer-array pattern (see breaking change
  above).

- **`computed()` in the reactive store is now always disposable.** Calling `.dispose()` on a
  computed unsubscribes it from its dependencies so it stops recomputing; this is documented in
  `src/reactive/README.md` alongside the `Scope` primitive and general reactive-system usage
  guidance (subscribe/dispose discipline, `batch()`, auto-tracked vs. explicit dependencies).

## Not breaking, but worth calling out for reviewers

- `WaveSurfer.getState()`'s derived computeds (`isReady`, `progress`, `isPaused`, etc.) are
  intentionally instance-lifetime-owned and are **not** disposed by `destroy()`/reused-`Scope`
  cycles, so `getState()` keeps working correctly across a `destroy()` -> `load()` reuse (a
  previously-supported pattern per issue #3637). See the comment at the
  `createWaveSurferState()` call site in `src/wavesurfer.ts` for the reasoning.

## Phase 2 — Declarative load & viewport (branch: `refactor/declarative-load-and-viewport`)

Adds declarative load-state signals and viewport derivation (canvas rendering plan, visible time range),
replacing hand-rolled window tracking and load-version guards. No event-timing or behavior changes, except:

- **Superseded loads no longer spuriously emit `error`.** Previously, if `load()` was called
  again while a fetch/decode from a prior `load()` call was still in flight, the stale call's
  rejection (e.g. its aborted fetch throwing `AbortError`) had no dedicated handling and
  propagated straight through to `load()`'s `catch`, which unconditionally emitted `error` and
  rejected -- even though a newer load had already superseded it and was progressing normally.
  That rejection is now recognized as supersession and swallowed; only a destroy-triggered abort
  or a genuine failure of the *current* load still emits `error`.
- **The timeline plugin's scroll-driven visible window is now padding-consistent.** Its
  scroll-position notch updates now derive the visible-right bound from
  `getWidth()` (container width minus inline padding), matching the same padding-adjusted width
  `virtualAppend()` already used for the initial-visibility check. The previous scroll handler
  used unpadded bounds (`scrollLeft + clientWidth`), so with non-zero container padding the
  visible window during scroll differed slightly (by the padding amount) from the initial-render
  window; the two now agree.

### Breaking changes

- **`WaveSurfer` no longer exposes `protected abortController`.** It was replaced by the
  per-load `loadScope`/`AbortSignal` pattern described under Internal improvements below. This
  is a source-level break for TypeScript subclasses that referenced `this.abortController`
  directly; the runtime load/abort API (`load()`, `loadBlob()`, cancellation-on-new-load
  behavior) is unaffected.

### New API

- **`WaveSurferState.loadPhase` signal** — emits `'idle' | 'fetching' | 'decoding' | 'ready' | 'error'`.
  Replaces polling `isReady` for exact load-state awareness without event-timing coupling.

- **`Renderer.getVisibleRange()` derived signal** — returns `{startTime, endTime}` of the visible time range
  in the current viewport, computed per-render cycle (frozen post-destroy until next render).
  Consumed by canvas rendering and timeline plugin for synchronized windowing.

- **`FrameScheduler` utility** — new per-frame coalescing scheduler for progress rendering callbacks,
  replacing direct Timer wiring in WaveSurfer (Timer class retained for Record plugin).

### Internal improvements

- **Per-load `Scope` pattern in `loadAudio()`** — replaces `_loadVersion` counters and
  post-await `_isDestroyed` / `abortController` guards with a unified per-load child `Scope`
  (`this.loadScope`, a child of `this.scope`) created fresh on each `loadAudio` call. Starting a
  new load disposes the previous `loadScope`, which fires that load's `AbortSignal` and cancels
  its in-flight fetch; a `supersededLoadScopes` `WeakSet` records which disposed scopes were
  superseded (as opposed to torn down by `destroy()`) so that only their rejections are swallowed
  when they surface later -- a destroy-triggered abort or a genuine failure of the still-current
  load still propagates.

- **Pure canvas-plan computation** — `computeCanvasPlan()` returns `{numCanvases, singleCanvasWidth, slots}`.
  Renderer interprets plan as data instead of imperative rendering, enabling offline testing and
  layout reuse. Deleted 40+ lines of hand-coded canvas windowing from `renderMultiCanvas`.

- Deferred-minor cleanup sweep: webaudio stale-source guard, envelope polyline null checks,
  duplicate drag-stream tests, computed subscriber disposal on destroy.

## Phase 3 — definePlugin + plugin ports (branch: `refactor/define-plugin`)

Adds a functional plugin API, `definePlugin(name, (ctx, options) => api)`, whose teardown is a
single `Scope` disposal instead of a hand-rolled `destroy()` override, and rebuilds six of the
seven remaining first-party plugins on it. This is an **additive** API — `BasePlugin`
class-based plugins (first-party and third-party) keep working unchanged. `definePlugin` is
exposed as a static on the `WaveSurfer` class rather than a named export from the main entry
point — the main-entry rollup outputs (CJS/UMD) use `output.exports: 'default'`, which hard-errors
on a runtime named export alongside the default export. Its supporting types (`PluginContext`,
`PluginSetup`, `DefinedPlugin`) are still re-exported by name from the main entry, since types are
erased before bundling and don't hit that restriction:

```ts
import WaveSurfer, { type PluginContext, type PluginSetup, type DefinedPlugin } from 'wavesurfer.js'

const MyPlugin = WaveSurfer.definePlugin('MyPlugin', (ctx, options) => ({ ... }))
```

If you need `definePlugin` without importing all of `wavesurfer.js`, it's also available directly
from its dist subpath: `import { definePlugin } from 'wavesurfer.js/dist/define-plugin.js'` (that
module has no default export, so it's unaffected by the `exports: 'default'` restriction above).

### New API

- **`definePlugin()`** (`src/define-plugin.ts`) — builds a plugin as `setup(ctx, options) => api`
  where `ctx = { wavesurfer, scope, state, emit }`. `ctx.scope` is a fresh `Scope` per (re-)init;
  every listener/timer/child-scope registered on it is torn down automatically on `destroy()` —
  no manual `subscriptions` array or `destroy()` override needed. `BasePlugin` gained a
  `protected scope: Scope` field so both `definePlugin` and hand-written class-based plugins
  (including `RecordPlugin`, see below) can use the same disposal primitive.
- **`resolveContainer`, `overlayElement`, `bridgeEvents`** (`src/plugin-utils.ts`) — shared
  helpers extracted from four/six/one copy-paste implementations respectively that previously
  lived duplicated across plugins.

### Plugins ported (public surface unchanged; internals rebuilt on `definePlugin`)

`hover`, `zoom`, `timeline`, `minimap`, `envelope`, `regions`. Every exported class name, default
export, `Plugin.create(options)` / `new Plugin(options)` constructor form, public method/field,
and event name+payload is preserved — including each class's runtime `Function.name` (`HoverPlugin`,
`ZoomPlugin`, `TimelinePlugin`, `MinimapPlugin`, `EnvelopePlugin`, `RegionsPlugin`), which
`definePlugin`'s internal `Defined` class takes on via the first argument passed to
`definePlugin(name, setup)`; this keeps devtools/stack-trace display names stable across the port.
`record` and the spectrogram plugins were **not** ported (see below); `spectrogram-*` unification is
scheduled for a later phase.

- **`RecordPlugin` stays class-based.** It's usable standalone (construct → `startMic()`/
  `record()` → `destroy()`, without ever calling `registerPlugin()`), which `definePlugin`'s
  setup-at-init model can't express. It now adopts the chassis's `protected scope` internally for
  its own resources, but its public surface and its `destroy()` override are unchanged.

### Behavior changes worth calling out

- **`SingleRegion.subscriptions` (public field) has been removed.** It was a hand-rolled disposer
  array (`public subscriptions: (() => void)[]`); region teardown is now expressed as disposing a
  per-region child `Scope` owned by the plugin. Code that read or pushed onto
  `region.subscriptions` directly will fail to compile against this version's types.
- **Calling a ported plugin's public API method before the plugin has been initialized (i.e.
  before `wavesurfer.registerPlugin(...)` has run `_init()`) now throws a bare `TypeError`
  (`... is not a function`) instead of the previous descriptive `Error('WaveSurfer is not
  initialized')`.** This is a `definePlugin`-wide semantic: a plugin's api methods (e.g.
  `envelope.addPoint()`, `regions.addRegion()`) only exist on the instance once `setup()` has run
  and `Object.assign`ed its return value on — calling one beforehand hits a missing method, not a
  guarded field. (`regions.addRegion()` itself still throws the descriptive
  `'WaveSurfer is not initialized'` error for the narrower case where `ctx.wavesurfer` reads
  `undefined` post-destroy while the method still exists on the instance.)
- **`zoom`'s `maxZoom` default is now recomputed on every (re-)init** instead of being derived
  once. When the caller doesn't pass `maxZoom`, it's derived from the container's `clientWidth`
  at setup time; a destroy → re-init cycle (e.g. after a container resize) now picks up the
  current width rather than the value computed at the plugin's first init.
- **`hover` and `regions` now remove their root DOM element (wrapper / `regionsContainer`) as
  part of scope disposal, which runs BEFORE the `'destroy'` event is emitted**
  (`definePlugin`'s destroy order is: dispose `ctx.scope`, then `super.destroy()` — which emits
  `'destroy'` last). Previously these two plugins removed their root element AFTER the
  `'destroy'` event, so a `plugin.on('destroy', ...)` listener could still observe the element
  attached to the DOM; it can no longer do so. Each port's test suite (plus the regions
  memory-leak suite) was checked and found nothing pinned the old ordering. (`minimap` also
  removes its wrapper via scope disposal now, but its pre-port `destroy()` already removed the
  wrapper before `super.destroy()`, so this is not an ordering change for minimap.)
- **The timeline plugin's "container not found" error message wording changed**, from
  `` `No Timeline container found matching ${container}` `` to
  `` `timeline: container not found: ${container}` `` (now produced by the shared
  `resolveContainer()` helper, consistent with every other plugin's container-resolution error).
- **`minimap` and `envelope`'s `create(options)` / `new Plugin(options)` argument is now
  optional** (`MinimapPlugin.create()` and `EnvelopePlugin.create()` are both valid with no
  argument now, as is `new MinimapPlugin()` / `new EnvelopePlugin()`). Previously the hand-written
  classes declared `constructor(options: MinimapPluginOptions)` /
  `constructor(options: EnvelopePluginOptions)` — a required parameter — even though every field on
  both options types was already optional. `definePlugin`'s `PluginCtorArgs` derives
  optionality structurally (an all-optional `Options` type gets an optional `create()`/constructor
  parameter), so this falls out automatically from the port. It's a pure type widening, not a
  runtime behavior change: both setups already handled an omitted/`undefined` `options` correctly
  via `Object.assign({}, defaultOptions, options)`.

## Phase 4 — Spectrogram unification + leak harness + lint bans (branch: `refactor/spectrogram-unification`)

Merges the two spectrogram plugins onto one implementation and one shared frequency-computation
kernel, adds a GC-level leak-regression harness, and adds ESLint bans on raw resource acquisition
outside `Scope`. Public surface (`SpectrogramPlugin`/`WindowedSpectrogramPlugin` default exports,
`create()` signatures, option fields, events) is unchanged.

### New API

- **`computeFrequencies(channels, params)`** (`src/spectrogram-frequencies.ts`) — the single,
  fully-typed implementation of the frame/FFT/filter-bank/dB-scaling/autoGain loop that
  previously existed as three near-identical ~130-line copies (the main-thread `spectrogram.ts`
  path, `spectrogram-windowed.ts`'s main-thread fallback, and `spectrogram-worker.ts`). The
  worker's version — the most complete of the three, the only one with both autoGain budget
  strategies and the noverlap re-fallback quirk — was chosen as the behavioral reference; both
  other call sites now route through it, and `spectrogram-worker.ts` imports it instead of
  carrying its own copy (the worker bundling pipeline still inlines it correctly — verified in
  `dist/plugins/spectrogram*.js` post-build).
- **`Scope.createResizeObserver(el, fn)`** (`src/scope.ts`) — constructs a `ResizeObserver`,
  calls `.observe(el)` immediately, and registers `.disconnect()` on the scope's disposal, in one
  call — the `ResizeObserver` analog of `scope.listen`/`scope.timeout`. Added because the ESLint
  resource-acquisition ban (below) caught `src/renderer.ts`'s raw `new ResizeObserver(...)` with
  a manual `disconnect()` in `destroy()`; that call site now uses the primitive instead.
- **`yarn test:leaks`** (`NODE_OPTIONS=--expose-gc jest --selectProjects leaks --runInBand`) — a
  second Jest project (`src/__tests__/gc-leaks.test.ts`) that asserts, via `WeakRef` +
  `global.gc()` polling, that destroyed instances and their heavyweight retainees (decoded
  `AudioBuffer`s, region objects, a `definePlugin`-captured array) actually become collectible.
  Not part of the default `yarn test:unit`/CI run (requires `--expose-gc`); run manually as an
  additional gate. One case (detached-container DOM node collection) documents a known jsdom
  caveat and is asserted with that caveat inline rather than silently passed.
- **ESLint `no-restricted-syntax` resource-acquisition bans** (`eslint.config.js`) — raw
  `addEventListener`/`setTimeout`/`setInterval`/`requestAnimationFrame`/`new ResizeObserver`/
  `new Worker` in `src/**` (tests exempt) now fail lint with a message pointing at the `Scope`
  alternative, except in a curated primitive-file allowlist where raw acquisition *is* the
  primitive being implemented: `src/scope.ts`, `src/timer.ts`, `src/frame-scheduler.ts`,
  `src/reactive/event-streams.ts`, `src/reactive/drag-stream.ts`, `src/reactive/scroll-stream.ts`,
  a single line-scoped exemption in `src/player.ts` (`onMediaEvent()`), and `src/fetcher.ts`
  (`watchProgress()`'s abort listener — no owning `Scope` in reach, but removed deterministically
  in a `finally` before the function returns, so it can't outlive the fetch regardless of any
  component's destroy timing; flagged in the task report as the one judgment call in the audit).
  Every rule hit was individually adjudicated (see the task 5 report); the only genuine violation
  found was `renderer.ts`'s `new ResizeObserver`, fixed via the new primitive above.

### Deprecated

- **`spectrogram-windowed.ts` / `WindowedSpectrogramPlugin`** is now a thin deprecated shim: its
  own `definePlugin('WindowedSpectrogramPlugin', ...)` call that delegates into the same
  `spectrogramSetup()` implementation `SpectrogramPlugin` uses, with `rendering: 'windowed'`
  forced. Equivalent to (and going forward, prefer) `SpectrogramPlugin.create({ ...options,
  rendering: 'windowed' })`. Kept fully functional, including its private test-poke surface, for
  backward compatibility — no removal planned yet.

### Behavior changes worth calling out

- **`SpectrogramPlugin` now accepts `rendering?: 'full' | 'windowed'`** directly (previously only
  reachable via the separate `WindowedSpectrogramPlugin`), plus the windowed-only options.
  `progressiveLoading` is a real option and takes effect (gates background segment loading beyond
  the visible viewport). `windowSize`/`bufferSize` are accepted for `WindowedSpectrogramPlugin`
  compatibility but not read by the windowing algorithm — segment sizing is driven by zoom level
  and container width instead; this is pre-existing behavior, carried over unchanged by the merge.
- **Windowed mode's configurable `workerTimeout` unification.** Previously windowed mode had a
  worker timeout hard-coded to 30000ms regardless of the `workerTimeout` option; it now honors
  the same configurable value full mode always did, in both rendering modes uniformly.
- **Windowed mode's noverlap re-fallback quirk now applies uniformly on the main-thread path.**
  `computeFrequencies` treats a *derived* (pixel-density-computed, not user-supplied) noverlap of
  exactly 0 as "unset" and re-overrides it to `round(fftSamples * 0.5)` — this was always true of
  windowed mode's *worker* path (it already shared the worker's logic) but NOT of its bespoke
  main-thread fallback, which clamped the derived value directly and respected a computed 0.
  Post-unification both paths agree with the worker's pre-existing behavior. This only affects
  the edge case where pixel density pushes the derived noverlap to exactly 0, and only for
  windowed segments computed on the main thread (worker path and full mode were already this way).
  autoGain remains unavailable in windowed mode (unchanged — windowed segments are computed
  lazily/independently with no whole-buffer maximum to scale against).
- **Container-selector fallback now warns instead of failing silently.** If `options.container` is
  a string that doesn't match any element, both plugins have always fallen back to the wavesurfer
  wrapper rather than throwing (pre-existing behavior, unchanged by this merge) — but that fallback
  used to be silent. `spectrogram-setup.ts`'s shared setup now emits a `console.warn` naming the
  unmatched selector when this happens, so a typo'd `container` option is discoverable instead of
  quietly rendering the spectrogram somewhere the caller didn't expect.
- **Both spectrogram plugins' `@ts-nocheck` headers are gone** — the ~390 duplicated lines they
  hid, and the undeclared-field bugs those lines carried, are fixed or deleted in the merge. (The
  unrelated pre-existing `@ts-nocheck` in `src/fft.ts` is untouched — outside this phase's scope.)
- **Fixed: `getFrequenciesData()` could silently repopulate its cache after `destroy()`.** Its
  cache write (`cachedBuffer`/`cachedFrequencies` assignment) ran after an unguarded
  `await getFrequencies(...)`, unlike every other post-await continuation in the same file. A
  caller firing it without awaiting (`void plugin.getFrequenciesData()`) and destroying
  immediately after could see the cache land *after* `destroy()` had already nulled it — a narrow
  but real post-teardown state leak, found during Phase 4's GC-leak harness work and fixed with a
  post-await `ctx.scope.disposed` guard, mirroring `render()`'s own pattern. Covered by a new
  failing-first regression test in `spectrogram-destroy.test.ts`.
- **`loadFrequenciesData()`/`getFrequenciesData()`/`clearCache()` are now explicit no-ops (with a
  `console.warn`) in windowed rendering mode**, instead of silently operating on whole-buffer
  cache state windowed mode's render path never reads. These are full-mode-only APIs — calling
  them in windowed mode would fight the segment renderer, which owns its own per-segment cache
  through `segmentManager` instead. `loadFrequenciesData`/`getFrequenciesData` resolve to
  `undefined`/`null` respectively; `clearCache` simply returns. Documented on each method's `Api`
  doc comment.
- **`tsconfig.json` now sets `"stripInternal": true`.** The `__*ForTests`/`__spectrogramInternalsForTests`
  test-only introspection hatches (tagged `@internal`) are stripped from the emitted `dist/*.d.ts`
  files, so they no longer appear as part of the published TypeScript surface, while remaining
  fully usable from `src/__tests__/*` (ts-jest type-checks against `src/*.ts` directly, never
  `dist/*.d.ts`, so this has zero effect on test compilation — verified by a full build and a full
  test suite run with the flag enabled). Chosen over the documented-instability alternative because it
  achieves the stronger guarantee (not just "please don't rely on this" but "it isn't there")
  with no compilation-breaking downside found.
