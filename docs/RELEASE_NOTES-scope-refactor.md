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
