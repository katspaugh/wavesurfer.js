# Changelog

All notable changes to wavesurfer.js are documented here. This project follows
[semantic versioning](https://semver.org/).

## [8.0.0]

The first stable v8 release, consolidating 8.0.0-beta.1 through beta.5. The
"Breaking changes" list below collects every breaking change across all the
betas, so it doubles as the v7 → v8 migration guide; the [8.0.0-beta.1] section
further down has the full background on the `Scope`/`definePlugin`
architecture that most of the runtime fixes build on.

### Breaking changes

Everything in this list is breaking relative to v7. The first five entries
landed after beta.1; the rest are recapped from the beta.1 section.

- **`destroy()` is terminal.** A destroyed instance is not reusable: `load()`
  and `loadBlob()` reject (catchably) and emit `error`, `registerPlugin()`
  throws, and every other mutating method (`play`, `pause`, `setTime`,
  `setVolume`, `setMuted`, `setPlaybackRate`, `setSinkId`, `setOptions`,
  `setScroll`, `setMediaElement`) is a silent no-op. `destroy()` is idempotent
  and now also releases the decoded `AudioBuffer`. Create a new instance instead
  of reusing one. The v7 revival path was already broken in practice (it
  rendered into a detached container); a scan of public code found no project
  relying on it. This supersedes the beta.1 "destroy() → load() reuse cycle"
  entry, which has been removed below. The two abort contracts are unchanged:
  `destroy()` mid-load still rejects that load with an `AbortError` and emits
  `error`.
- **`getMediaElement()` returns `HTMLMediaElement | null`** — `null` under the
  WebAudio backend, which has no HTML media element (v7 returned the
  `WebAudioPlayer` itself, mistyped as an `HTMLAudioElement`). To keep a
  reference to the WebAudio player (e.g. for `getGainNode()`), create the
  `WebAudioPlayer` yourself and pass it via the `media` option
  (`examples/phase-vocoder.js`). Relatedly, `WaveSurfer` now owns its playback
  engine by composition, so `wavesurfer instanceof Player` is no longer true;
  the public playback methods are unchanged.
- **A `load()`/`loadBlob()` superseded by a newer `load()`/`loadBlob()` now
  rejects with a canonical `AbortError`** instead of silently resolving. No
  `error` event is emitted for it, and fire-and-forget callers see no
  unhandled-rejection noise (the returned promise carries an internal no-op
  catch). Code that `await`s an older load must expect the rejection.
- **The `error` event payload is always a real `Error`.** A media element's
  `MediaError` (which is not an `Error`) is wrapped, with its `code` preserved.
- **`wavesurfer.getRenderer()` no longer exposes `.on()`/`.emit()`.** The
  renderer is not an event emitter anymore; its outward surface is reactive
  signals (`clickSignal`, `dblclickSignal`, `dragEventsSignal`, the
  `renderEpoch`/`renderedEpoch`/`resizeEpoch` counters, `getScrollSignals()`,
  `getVisibleRange()`). The public `WaveSurfer` events are unchanged, and
  `wavesurfer.getWrapper()` remains the supported way to reach the wrapper
  element (`examples/pitch.js`).
- **Spectrogram `noverlap` honors its documented contract.** It is clamped only
  to `fftSamples - 1` (hop ≥ 1 sample); the previous silent 50% cap and
  64-sample hop floor are gone. A spectrogram configured with a large
  `noverlap` now renders with the finer hop it asked for, i.e. more columns and
  more compute.
- *(beta.1)* `WaveSurfer` no longer exposes `protected subscriptions` /
  `mediaSubscriptions` / `abortController`; subclasses use `this.scope`.
- *(beta.1)* The public `SingleRegion.subscriptions` field is gone.
- *(beta.1)* Internal-only modules (`dist/draggable.js`, `dist/timer.js`,
  `dist/reactive/*`) are no longer emitted; `dist/fft.js` exports only `FFT`,
  with the spectrogram math helpers moved to `dist/spectrogram-render-utils.js`.
- *(beta.1)* The `"./dist/*"` deep-import wildcard in `package.json#exports` is
  narrowed to `"./dist/*.js"` (`types`/`import` only).

### Deprecated

- **`BasePlugin` class-based plugin authoring.** `definePlugin` is the plugin
  API from v8 on; removal of `BasePlugin` is targeted for v9. It stays as the
  runtime chassis, so existing class-based plugins keep working throughout v8.
  `yarn make-plugin` now generates a `definePlugin` skeleton. One behavior
  change while it lasts: `BasePlugin.destroy()` now disposes `this.scope`, so
  a third-party class plugin that used `this.scope.listen()` with the
  inherited `destroy()` no longer leaks every registered resource.
- *(beta.1)* `WindowedSpectrogramPlugin` / `spectrogram-windowed.js` — use
  `SpectrogramPlugin.create({ rendering: 'windowed' })`.

### Added

- **Regions: auto-scroll while dragging, resizing, or drag-creating a region**
  (#4358, resolves #4159; v8 port of #4181). Holding a region, a resize handle,
  or a drag-created edge at the edge of the scroll container keeps the
  waveform scrolling. The region `update` event gains an optional trailing
  `autoScrollDirection` argument (`'left' | 'right' | 'both' | 'none'`), drags
  now survive the container scrolling under a stationary pointer, and
  virtualization no longer detaches a region mid-drag.
- **Regions: `region-double-clicked` on touch devices** — two taps within
  300 ms synthesize the event on browsers that never fire `dblclick` for touch
  input, deduplicated against those that do (#3927).
- **Record: `record-ended-externally` event.** When the capture device
  disappears mid-recording (Bluetooth headset off, dock unplugged) the plugin
  emits it, then stops through the normal path so the final blob still arrives
  via `record-end`; a preview-only mic session tears down instead of freezing
  (#4285).
- **Record: `mediaRecorderTimeslice` defaults to 200 ms**, so
  `record-data-available` fires continuously out of the box (#4349).
- **Record: `startRecording()` while already recording restarts cleanly**, with
  a fresh `MediaRecorder` per session and no chunk or `record-end` leaking
  from the previous one.
- **Windowed spectrogram: a byte-based segment cache budget** (256 MB by
  default, farthest-first eviction, the nearest segment never evicted)
  replaces the segment-count cap, and the `progress` event now reports real
  fractions and reaches 1.
- **A Cypress regression test** that drives real playback in a browser and
  asserts `play`/`pause`/`finish` fire exactly once per transition (#4361,
  guarding #4360).

### Fixed

Core and WebAudio:

- The `WebAudioPlayer` created for `backend: 'WebAudio'` is now destroyed on
  `destroy()`; audio used to keep playing to the end of the buffer with the
  `AudioContext` left open forever.
- The WebAudio backend emits `seeked` after `seeking`, so `state.isSeeking` no
  longer sticks at `true` after the first seek; `play()` resumes a suspended
  `AudioContext`; stale `src` fetches (including A → B → A) are aborted.
- `stopAt()` no longer jumps the playhead to the range end when pausing or
  seeking during `play(start, end)` / `region.play(true)`, while a stop that
  fired on schedule still finalizes the position exactly (#4365, #4366).
- `timeupdate` under WebAudio reported a wrong time after pausing (#4348).
- `play(start, end)` now enforces its stop position in background tabs, where
  `requestAnimationFrame` is suspended but media `timeupdate` keeps firing.
- Seeks issued before the media element has metadata are deferred until
  `canplay` instead of being lost (#4353); `setTime()` only clamps against a
  finite duration.
- An in-flight `load()`'s unknown-duration promise is settled when
  `setMediaElement()` tears down the media bridge, instead of hanging.
- Decoder: `normalize` scales by the global maximum across all channels and no
  longer mutates caller-owned peak arrays; `createBuffer` gets real
  `copyFromChannel`/`copyToChannel` implementations.
- `FrameScheduler` schedules the next frame before invoking the callback, so a
  throwing subscriber cannot kill the loop.

Renderer:

- `getVisibleRange()`/lazy rendering froze (blank canvases on scroll) when the
  first render was not scrollable and a later zoom made it so.
- `normalize: true` scaled each canvas slice by its own peak, producing
  amplitude discontinuities at canvas seams; the global peak is now used.
- Bar-grid clamping and bar spacing share one computation, removing clipped
  bars and irregular gaps at canvas seams at `devicePixelRatio: 1`.
- The lazy render window is computed from the actual canvas width at both
  viewport edges, eliminating undrawn strips.
- Repeated wheel-zoom no longer drifts the cursor outward (the rounding helper
  ceiled instead of rounding).
- `setOptions({ width: undefined })` reverts to fill-the-container behavior.
- Pointer math on a zero-size (hidden) container no longer produces `NaN`
  seeks.
- Gradient resolution reuses a single scratch canvas instead of one per draw.

Regions:

- Seeking to `region.start` (what `region.play()` does) could land the next
  `timeupdate` slightly before the start and fire a spurious `region-out`,
  causing in/out ping-pong when jumping between regions; the start boundary
  now has a 0.05 s tolerance (#3631, #3658, #3781, #3866).
- Dragging a region against the container edge translated it rigidly instead
  of compressing it.
- `maxLength` is enforced during drag-creation and `minLength` on its
  finalization; `setOptions({ start, end })` re-renders marker/range styling
  and handles when the shape flips; `addRegion()` after destroy returns an
  inert region instead of throwing.

Record:

- The microphone is released if the plugin is destroyed while a
  `getUserMedia` prompt is pending; previously the tab's recording indicator
  stayed on forever.
- `stopMic()` restores the wavesurfer options (`interact`, `cursorWidth`,
  `normalize`, `maxPeak`) that the live preview overrides.
- `isActive()` no longer reports `true` before any recorder exists.
- Paused time is excluded from the reported duration (#4352).
- A pending `getUserMedia` grant or a queued `MediaRecorder` `onstop` from a
  previous lifecycle can no longer leak a stream or a `record-end` into a
  re-initialized plugin.

Other plugins:

- Timeline: the `duration` option works before audio is loaded, and label
  culling actually works (notch width is measured while connected).
- Envelope: a last point at the very end of the track no longer produces a
  `NaN` volume that throws out of `timeupdate` (#4350); the envelope renders
  immediately when registered after decode; `dragPointSize: 0` is respected;
  public mutators no-op after destroy.
- Zoom: the page can scroll before audio is decoded; the pointer anchor is
  re-derived after an external scroll; `iterations: 1` no longer divides by
  zero; the exponential-zoom baseline resets when new audio loads.
- Hover: string `lineWidth` values no longer break positioning with a `NaN`
  translate.

Spectrogram:

- Full-render mode invalidates its caches when a new buffer is decoded;
  loading a new file at an unchanged zoom used to keep drawing the previous
  file forever.
- `frequencyMax` defaults to Nyquist on the `frequenciesDataUrl` path, which
  previously produced a silent blank spectrogram.
- A redraw arriving while a render is in flight is queued instead of dropped.
- The `lanczoz` window computes `sinc(0) = 1`, fixing blank spectrograms for
  odd window lengths; the Bark scale is offset-corrected so `hzToScale(0)` is
  exactly 0 and `scaleToHz` is its exact inverse.
- Fractional values in external `frequenciesDataUrl` JSON no longer throw
  mid-draw.
- Windowed mode re-checks segment identity after each `await`, removing
  orphaned canvases from compute/render races.
- Frequency-label backgrounds fill row-height rects instead of overdrawing,
  and the main canvases scale their backing store by `devicePixelRatio` in
  both modes.

Examples and docs:

- All examples audited against the v8 API (#4357); `examples/spectrogram.js`
  now listens for `ready`/`click` on the spectrogram plugin instance, which is
  what actually emits them (#4364).

### Changed

- The renderer's internal event bus is gone; an ESLint rule forbids
  `extends EventEmitter` across `src/**` outside the allowlisted public event
  surfaces, so internal buses cannot be reintroduced.
- CI: ESLint and typecheck are blocking, the GC leak harness runs in the unit
  test workflow, and coverage thresholds are ratcheted. The release workflow
  publishes prereleases under their prerelease dist-tag, skips versions that
  are already on npm, and publishes maintenance releases of an older major
  (7.x from the `v7` branch) under that major's dist-tag instead of moving
  `latest` backwards.

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
