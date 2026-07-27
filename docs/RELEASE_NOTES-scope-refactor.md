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
