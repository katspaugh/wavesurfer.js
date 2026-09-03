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
  `dist/reactive/state-event-emitter.js`, `dist/timer.js` (the internal `Timer`
  class was ported to the existing `FrameScheduler` primitive and deleted; no
  replacement export — `record.ts`, its only consumer, now uses
  `FrameScheduler` directly). These had zero call sites in `src/`; anyone
  importing one directly should drop the import or vendor the code.
- **`dist/fft.js` now exports only the `FFT` class.** The frequency-scale math,
  autoGain/color-mapping helpers, and colormap/UI helpers that used to live in
  the same file (under its blanket `@ts-nocheck`) moved to a new
  `dist/spectrogram-render-utils.js`. Anyone deep-importing e.g.
  `magnitudesToColorIndices`, `setupColorMap`, `hzToMel`/`scaleToHz`, or
  `createSparseFilterBankForScale` from `dist/fft.js` must import them from
  `dist/spectrogram-render-utils.js` instead. The dead, unused dense
  filter-bank functions `applyFilterBank` and `createFilterBankForScale` (the
  sparse equivalents were already the ones actually used) were deleted
  outright with no replacement.

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

### Changed

- **The playback engine is now a proper class hierarchy: an abstract `Player`
  (`dist/player.js`) with two implementations — `MediaElementPlayer`
  (`dist/media-element-player.js`, the HTML media element backend) and
  `WebAudioPlayer` (`dist/webaudio.js`, the AudioContext/AudioBufferSourceNode
  backend).** Previously the concrete `Player` wrapped a `WebAudioPlayer`
  duck-typed as an `HTMLMediaElement`; now `WaveSurfer` composes whichever
  implementation applies and every backend difference (scheduled stops,
  duration back-patching, error normalization, `getMediaElement()`
  nullability) is polymorphic. `WebAudioPlayer`'s public media-element-like
  surface (`src`, `currentTime`, `play()`/`pause()`, `addEventListener`,
  `getGainNode()`, `getChannelData()`, …) is unchanged, but it now `extends
  Player` instead of `EventEmitter` (its emitter is composed internally), so
  code relying on `webAudioPlayer instanceof EventEmitter` breaks; `on`/`un`/
  `once`/`unAll` still exist. A deep-importing consumer of `dist/player.js`
  (never a documented entry point) must switch to
  `dist/media-element-player.js` for the concrete media-element player.
- **`package.json`#`exports`' `"./dist/*"` deep-import wildcard is narrowed to
  `"./dist/*.js"`** (`types`/`import` only — no `require` condition, since
  there's no per-module `.cjs` build for internal `dist/` modules under
  `"type": "module"`). The old `"./dist/*"` pattern's `types`/`require`
  templates appended `.d.ts`/`.cjs` onto a subpath that already included
  `.js` (e.g. producing `./dist/webaudio.js.d.ts`, which never existed);
  besides fixing that, this also means a bare extensionless deep import like
  `wavesurfer.js/dist/webaudio` no longer resolves at all — only the
  `.js`-suffixed form does. `scripts/verify-exports.cjs` (new; also wired as
  `npm run verify-exports` and into `npm run build`) checks every export
  template against real post-build `dist/` files.
- **`dist/types.d.ts`** (a `rollup-plugin-dts` bundle of `wavesurfer.d.ts`) is
  no longer built. It was referenced by nothing — not `package.json`'s
  `types` field, not any export entry, not any doc — so the rollup config
  block and the now-unused `rollup-plugin-dts` devDependency were removed
  rather than wired in.
- **`createDragStream(element)`'s parameter type widened from `HTMLElement` to
  the base `Element`.** Every DOM API the function touches
  (`getBoundingClientRect`, add/removeEventListener) is declared on
  `Element`/`EventTarget`, not `HTMLElement` specifically; callers passing an
  `HTMLElement` (the overwhelmingly common case) are unaffected, but any
  reimplementation of the `ScrollStream`/drag-stream shape against the old,
  narrower parameter type should widen it too.
- **The `ScrollStream` interface (`src/reactive/scroll-stream.ts`) gained a
  `refresh()` method** — re-reads the element's current scroll metrics and
  writes them into `scrollData` without waiting for a DOM `scroll` event.
  Anyone structurally implementing `ScrollStream` (rather than only consuming
  `createScrollStream()`'s return value) needs to add it.

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

### Known limitations

- **Windowed spectrogram: a request-side segment-boundary rounding hazard.**
  `calculateFrequenciesWithWorkerRange`'s `startSample`/`endSample` are
  computed as `Math.floor(startTime * sampleRate)` /
  `Math.floor(endTime * sampleRate)` directly off the caller-supplied
  segment `startTime`/`endTime` (`src/spectrogram-setup.ts`). This is the
  same class of division/re-multiplication rounding hazard already fixed on
  the *response* side (the slice-length → `endTime` → worker
  reconstruction round-trip, fixed with a half-sample epsilon — see the
  "Fixed" entry above and `src/__tests__/spectrogram-worker-errors.test.ts`),
  but on the *request* side it remains unaddressed: for an adversarial
  `(startTime, sampleRate)` pair it can drop or duplicate a sample at a
  segment boundary. Deliberately deferred — currently documented only in a
  test comment (`spectrogram-worker-errors.test.ts`, the
  "reconstructs the exact slice length..." test); called out here so the gap
  is visible outside test source.
- **`dist/*.min.js` (the terser-minified UMD bundles) have no matching
  `.d.ts`.** `rollup.config.js` builds them with `declaration: false` — a
  `<script>`-tag UMD bundle has no realistic TypeScript consumer. The
  `"./dist/*.js"` exports wildcard (see Changed above) still nominally
  matches these paths and points `types` at a `.d.ts` that will never exist;
  `scripts/verify-exports.cjs` checks this explicitly and reports it as a
  known, accepted gap (`SKIP ... (known gap...)`) in `npm run build`'s
  verify-exports output, rather than either failing the build or silently
  passing.
