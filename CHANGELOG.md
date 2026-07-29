# Changelog

All notable changes to wavesurfer.js are documented here. This project follows
[semantic versioning](https://semver.org/).

## [8.0.0-beta.1]

A structural refactor of the core and plugins around a new `Scope` disposal-tree
primitive, fixing a large batch of memory leaks and double-emitted events, plus a
declarative load/viewport layer, a functional plugin API (`definePlugin`), and a
unified spectrogram implementation. Runtime behavior is unchanged for the vast
majority of apps; the breaking changes below are source-level TypeScript breaks
and a couple of narrow, intentionally-fixed behaviors.

### Breaking changes

- **`WaveSurfer` no longer exposes `protected subscriptions` / `protected mediaSubscriptions` / `protected abortController`.**
  These were replaced by the new `Scope` primitive (`this.scope`). Subclasses that
  pushed cleanup callbacks onto `this.subscriptions`/`this.mediaSubscriptions`, or
  read `this.abortController`, will fail to compile against this version's types
  and should migrate to `this.scope.add(disposer)`. Source-level only — no runtime
  shim, and nothing changes for apps that only use the public API.
- **`SingleRegion.subscriptions` (public field) has been removed** from the
  Regions plugin. Region teardown is now an internal `Scope`; code that read or
  pushed onto `region.subscriptions` directly will fail to compile.
- **Several internal, never-part-of-the-public-API modules are no longer emitted
  to `dist/`**, so deep imports through `./dist/*` for these specific paths will
  404: `dist/draggable.js`, `dist/reactive/event-stream-emitter.js`,
  `dist/reactive/media-event-bridge.js`, `dist/reactive/render-scheduler.js`,
  `dist/reactive/state-event-emitter.js`. These had zero call sites in `src/`;
  anyone importing one directly should drop the import or vendor the code.

### Added

- **`Scope`** (`src/scope.ts`) — the disposal-tree primitive now used throughout
  the codebase for listeners, timers, observers, signal subscriptions, and child
  lifetimes; documented for plugin authors that build on `definePlugin`.
- **`WaveSurfer.definePlugin(name, (ctx, options) => api)`** — a functional
  plugin API whose teardown is a single `Scope` disposal instead of a hand-rolled
  `destroy()` override. Purely additive: `BasePlugin` class-based plugins keep
  working unchanged. Six first-party plugins (`hover`, `zoom`, `timeline`,
  `minimap`, `envelope`, `regions`) are now built on it, with their public
  surface (exports, constructors, methods, events) unchanged.
- **`wavesurfer.getState()`** gains `loadPhase` (`'idle' | 'fetching' | 'decoding' | 'ready' | 'error'`)
  and `scrollPosition` signals, and composes a `muted` signal alongside `volume`.
- **`wavesurfer.getRenderer().getVisibleRange()`** — a derived signal returning
  the currently visible `{startTime, endTime}` of the viewport, recomputed every
  render cycle and kept accurate on scroll/zoom without needing a DOM `scroll`
  event first.
- **`SpectrogramPlugin` accepts `rendering?: 'full' | 'windowed'`** directly,
  merging what previously required the separate `WindowedSpectrogramPlugin`. See
  Deprecated below.
- **`yarn test:leaks`** — a GC-level regression harness (`--expose-gc`, not part
  of the default test run) asserting that destroyed instances and their
  heavyweight retainees actually become collectible.

### Fixed

- Events (`pause`, `seeking`, `finish`, `timeupdate`, and others) are now emitted
  exactly once instead of twice.
- The WebAudio backend now emits an `error` event on load failure instead of
  silently swallowing it.
- `dragToSeek`'s object form (`{ debounceTime }`) can now be toggled on and off
  at runtime via `setOptions()` — previously a one-token bug meant the object
  form never actually enabled drag-to-seek.
- A full destroy() → load() reuse cycle (no explicit `setMediaElement()` call)
  now correctly revives every event bridge — `timeupdate`, renderer click-to-seek,
  `play`/`pause` forwarding, and reactive state tracking all resume; previously
  they stayed dead after the first destroy.
- Windowed spectrogram: an overlapping render call that got dropped while a prior
  one was in flight is now re-run once the in-flight call finishes, instead of
  silently losing that segment.
- Windowed spectrogram's worker path now slices each channel to the segment's
  own sample range before `postMessage`, instead of structured-cloning the
  entire decoded channel buffer on every segment request.
- Various destroy-time and async-continuation leak fixes across the core and
  plugins (record, spectrogram, regions, envelope, timeline/hover, minimap) —
  recordings emit their final blob even if `onstop` fires after `destroy()`
  returns, in-flight async work no longer touches DOM state post-destroy, and
  duplicate/leftover listeners are cleaned up correctly.
- `Spectrogram`'s `maxCanvasWidth` is now tracked per-instance instead of on a
  shared static (setting it on one instance no longer affects every other
  spectrogram on the page).

### Deprecated

- **`spectrogram-windowed.js` / `WindowedSpectrogramPlugin`** — prefer
  `SpectrogramPlugin.create({ ...options, rendering: 'windowed' })`. The old
  entry point is kept fully functional as a thin shim; no removal planned yet.

### Known inconsistencies

- A handful of small stylistic inconsistencies (the regions plugin's `.subscribe`
  style vs. the rest of the codebase, the minimap's hand-rolled overlay, some
  duplicated drag-toggle logic) were flagged in review as cosmetic drift and
  intentionally left as-is rather than churned for their own sake.
