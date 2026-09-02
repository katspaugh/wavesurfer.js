# wavesurfer.js v8.0.0 — Pre-release Refactoring Spec

Status: **final** — the output of a full architecture/code review of `8.0.0-beta.3`
(five parallel line-by-line reviews: core, renderer/DOM, plugins, spectrogram, repo
infrastructure; plus a public-GitHub usage scan) and maintainer decisions.

This spec defines the architectural refactoring to land before v8.0.0 final.

## Goals

1. **Correctness**: eliminate the lifecycle complexity that breeds races and leaks.
2. **Honest abstractions**: no type lies, no `instanceof` backend sniffing.
3. **Events outside, streams inside**: the public event API is a stable contract;
   internal modules communicate via signals/streams only.
4. **Agentic robustness**: CI and repo conventions that make agent-introduced
   regressions fail loudly before merge.

---

## R1. `destroy()` becomes terminal

### Decision
`destroy()` is a wind-down call. After `destroy()`, the instance is dead: `load()`,
`loadBlob()`, `setMediaElement()`, `play()` etc. are no longer supported on it.
Calling `load()` repeatedly on a **live** instance remains fully supported.

### Rationale
- The destroy→load "revival" contract is self-imposed, not user-demanded. Issue
  [#3637](https://github.com/katspaugh/wavesurfer.js/issues/3637) — cited by the code
  as the origin — never reuses the instance: the reporter destroys during an in-flight
  load and creates a fresh instance afterwards. The only real contracts from #3637 are:
  - `destroy()` during an in-flight load must not throw an unhandled `DOMException`;
  - the in-flight `load()` rejects with `AbortError` and emits `error`.
- Of the three tests in `cypress/e2e/abort.cy.js`, only the first
  ("load url after destroyed should emit ready") pins revival — it asserts more than
  #3637 ever asked for. The other two pin the legitimate abort contracts and stay.

### Changes
- `src/wavesurfer.ts`: delete the revival machinery —
  `coreEventsInitialized` / `ensureCoreEvents()` re-arming, scope recreation in
  `destroy()` (`this.scope = new Scope()`, `mediaEventScope`, `FrameScheduler`
  recreation), and the `supersededLoadScopes` WeakSet disambiguation (supersession of a
  *live* previous load is still needed; the WeakSet exists only to distinguish
  supersede-then-destroy in the same tick — with terminal destroy, a disposed root
  scope is sufficient signal).
- `src/player.ts`: delete `mediaEventsInitialized` re-arming and the scope recreation in
  `destroy()`. (Most of this layer is restructured by R2 anyway.)
- Post-destroy calls: `load()`/`loadBlob()` reject with a clear
  `Error('wavesurfer was destroyed')` (and emit `error`); other methods are no-ops or
  throw the same — one consistent rule, documented.
- Replace the revival cypress test with one that asserts the new contract
  (destroy → load rejects), keep the two abort-contract tests.
- Migration note: "reuse after destroy" users must create a new instance —
  same cost, one line.

### Evidence from the wild
A public-code scan (GitHub code search co-occurrence of `destroy()` with
`load`/`loadBlob`, ~30+ candidate projects manually inspected out of ~800 hits, plus
web/StackOverflow searches) found **zero deliberate destroy→reuse of the same
instance**. The universal community idiom is destroy → `WaveSurfer.create()` → load;
several projects explicitly null the reference after destroy to *prevent* post-destroy
calls. All framework wrappers audited (`@wavesurfer/react` official,
`ShiiRochi/wavesurfer-react`, `@meersagor/wavesurfer-vue`, `videojs-wavesurfer`,
Gradio's AudioPlayer) are fully compatible with terminal destroy.

The only in-the-wild post-destroy `load()` calls are **race-initiated**, chiefly the
v7 record plugin itself: `destroy()` while recording → MediaRecorder's async `onstop`
fires later → the plugin calls `wavesurfer.load(blobUrl)` on the destroyed instance
(the actual mechanism behind #3637; v7's shipping record.js still has only a null
check). Therefore terminal destroy must:
1. keep the two abort contracts (destroy mid-load → catchable `AbortError` rejection
   + `error` event, no unhandled DOMException);
2. make post-destroy `load()` **reject catchably** rather than throw synchronously —
   apps destroying while recording will hit it;
3. keep the `!this.destroyed` guard already present in v8's `record.ts` (~:349) so the
   plugin itself never triggers the rejection.
With those, affected users' migration cost is one line, and no wrapper changes.

### The revival contract is already broken anyway
The renderer review found that destroy→load reuse doesn't actually work in beta.3:
`Renderer.destroy()` removes `this.container` from the DOM (`renderer.ts:472`) and
nothing on the revival path re-appends it. After `destroy(); load(url)`, listeners and
streams are faithfully revived **on a detached DOM tree**: `ready` fires (which is all
the cypress test checks), rendering happens off-screen, nothing is visible, and the
revived ResizeObserver observes a detached element. Making destroy terminal legalizes
reality rather than removing a working feature.

---

## R2. Backend composition replaces `WaveSurfer extends Player`

### Decision
Break the inheritance chain `WaveSurfer → Player → EventEmitter`. Introduce an explicit
`PlaybackBackend` interface with two implementations; `WaveSurfer` holds a backend by
composition. The public option `backend: 'WebAudio' | 'MediaElement'` already promises
this model — the implementation finally matches it.

### Rationale (scar tissue in beta.3)
- `wavesurfer.ts:214` — `new WebAudioPlayer() as unknown as HTMLAudioElement`: the
  WebAudio backend can only exist by impersonating a media element.
- `wavesurfer.ts:868` and `:704-709` — `instanceof WebAudioPlayer` branches for
  stop-at and duration back-patching: the abstraction leaks wherever behavior differs.
- `player.ts:33-39` — Player cannot own a root `scope` field because it would collide
  with WaveSurfer's through the inheritance chain; the codebase runs **two disconnected
  ownership trees** (`mediaScope` vs `scope`) purely because of `extends`.
- Duplicated lifecycle flags at both layers (`mediaEventsInitialized`,
  `coreEventsInitialized`).

### Shape
```ts
interface PlaybackBackend {
  // commands
  play(): Promise<void>
  pause(): void
  setTime(t: number): void
  stopAt(t: number): void            // both backends implement; instanceof dies
  setVolume(v: number): void
  setMuted(m: boolean): void
  setPlaybackRate(r: number, preservePitch?: boolean): void
  setSinkId(id: string): Promise<void>
  setSrc(url: string, blob?: Blob): void
  // queries
  getCurrentTime(): number
  getDuration(): number
  isPlaying(): boolean
  isSeeking(): boolean
  getMediaElement(): HTMLMediaElement | null   // null for WebAudio — honest at last
  // reactive surface (composed by WaveSurferState by reference, as today)
  signals: {
    currentTime, duration, isPlaying, isSeeking, volume, muted, playbackRate
  }
  destroy(): void
}
```
- `MediaElementBackend`: today's `Player` minus the class hierarchy (owns the
  `<audio>` element or an external one, the reactive media-event bridge, blob-URL
  bookkeeping, WebKit pending-seek workaround).
- `WebAudioBackend`: today's `WebAudioPlayer` implementing the interface natively —
  no impersonation, own AudioContext lifecycle.
- `WaveSurfer extends EventEmitter<WaveSurferEvents>` directly; ~15 one-line delegating
  methods. These delegations are the single grep-able definition of the public playback
  API (an asset for API snapshots and for agents).
- One ownership tree: `backend.destroy()` is a disposer on the WaveSurfer root scope.
- `stopAtPosition` polling in `onTick` remains only as `MediaElementBackend`'s `stopAt`
  implementation detail, or moves into the backend entirely (preferred).

### Breaking changes (migration notes)
- `getMediaElement()` returns `HTMLMediaElement | null`; `null` under the WebAudio
  backend. Plugins/consumers must handle it. (Today they silently get a
  `WebAudioPlayer` typed as `HTMLMediaElement`.)
- `WaveSurfer` is no longer `instanceof Player` (Player class is removed from the
  export surface; it was never a documented entry point).
- Protected internals (`this.media` etc.) disappear for subclassers — subclassing
  WaveSurfer was never supported; plugins are the extension mechanism.

---

## R3. Events outside, streams inside

### Decision
The public `WaveSurferEvents` surface (and per-plugin events) **must be maintained**
as-is — it is the compatibility contract. Internally, modules must not communicate via
EventEmitter: signals/streams (`src/reactive/`) only.

### Changes
- Keep the one bridge point where internal signals/streams are translated into public
  events (today `initPlayerEvents`/`initRendererEvents` in `wavesurfer.ts`). This
  bridge becomes the *only* internal emitter usage.
- `Renderer` stops extending EventEmitter: its `'click' | 'drag' | 'scroll' | 'render'
  | 'rendered' | 'resize' | ...` internal events become streams/signals consumed by the
  bridge. (Audit: every internal `renderer.on(...)`, `this.onMediaEvent`-to-emit
  forwarding, and cross-module `.on()` call is migration work; plugin-facing
  subscriptions go through `ctx.state` / renderer streams instead.)
- Plugins keep emitting public events via `ctx.emit` (unchanged contract for plugin
  consumers).
- Lint enforcement: extend the existing `no-restricted-syntax` guardrail to ban
  `extends EventEmitter` / internal `.emit(` outside the public-bridge and
  `event-emitter.ts` allowlist, so agents cannot reintroduce internal event buses.

---

## R4. Deprecate `BasePlugin` (class API)

### Decision
`definePlugin` is the only documented plugin API from v8. `BasePlugin` stays working
through v8.x, marked `@deprecated`, removed in v9.

### Changes
- `@deprecated` JSDoc on `BasePlugin`, `GenericPlugin` stays as the structural type
  (definePlugin plugins are BasePlugin instances under the hood — the chassis remains
  internal implementation, only the *authoring* API is deprecated).
- Docs/examples: migrate any remaining class-plugin examples to `definePlugin`.
- `scripts/plugin.sh` template generates a `definePlugin` skeleton (and fix the broken
  template path — see R5).
- Migration guide section: mechanical mapping (constructor→setup, `this.subscriptions`
  →`ctx.scope`, `this.emit`→`ctx.emit`, `onInit`→setup body, `destroy` override→scope
  disposers).

---

## R5. Agentic-robustness hardening (repo/CI)

From the infra review of `8.0.0-beta.3`. P0 items land before v8.0.0 final; P1 shortly
after (or alongside, they're small).

### P0 (minutes–hours each)
1. **Make lint blocking in CI**: remove `continue-on-error: true` from
   `.github/workflows/lint.yml`; add a blocking `eslint "src/**/*.ts" --max-warnings 0`.
2. **Split lint scripts**: `lint` = check only (`--max-warnings 0`), `lint:fix` = fix.
   Today `yarn lint` mutates source (`--fix` baked in) — a check that rewrites code.
3. **Real typecheck**: add `"typecheck": "tsc --noEmit"` (~3s); fix
   `tsconfig.test.json` so it actually includes `src/**/__tests__` (today it inherits
   the exclusion and checks **zero** test files); run both in CI.
4. **Rewrite AGENTS.md "Programmatic Checks"** to the real gauntlet with timings:
   `yarn lint` (~8s) → `yarn typecheck` (~3s) → `yarn test:unit` (~20s, 580 tests) →
   `yarn test:leaks` (~25s, mandatory when touching `scope.ts`/destroy/teardown) →
   `yarn build` when touching exports/public types. State explicitly that `yarn test`
   is Cypress e2e (needs build + browser). Add the convention: every new `src/**/*.ts`
   file gets a matching test file.
5. **Run `yarn test:leaks` in CI** (`unit-tests.yml`, +24s) — the GC-leak harness
   exists precisely to catch the regressions agents reintroduce when "simplifying"
   scope code, and currently runs nowhere.
6. **Coverage ratchet**: `coverageThreshold` at just-below-current global levels
   (statements 72 / branches 58 / functions 73 / lines 74).
7. **Fix `scripts/plugin.sh`**: wrong template path silently creates an empty plugin
   file; add `set -euo pipefail`.

### P1 (half-day each)
8. **API-contract snapshot**: commit built `.d.ts` files under `api/`; CI runs
   `yarn build && git diff --exit-code api/` — public-type changes fail until the
   snapshot is deliberately regenerated in the same PR. Especially valuable while R1–R4
   intentionally change the API: the snapshot diff *is* the reviewable breaking-change
   list.
9. **Type-aware lint**: `parserOptions.project` + `no-floating-promises`,
   `no-misused-promises`, `await-thenable`, `switch-exhaustiveness-check` (one-time
   cleanup; lint ~30–60s). Un-ignore `scripts/` and `cypress/` in eslint.
10. **Gate `release.yml`**: lint + typecheck + `test:unit` before publish; Node 16 →
    20/22; `actions/*` → v4.
11. **Bundle-size budget**: assert gzipped `dist/wavesurfer.min.js` + each plugin under
    a checked-in budget.
12. **Direct tests for `src/spectrogram-setup.ts`** — the largest file (1731 lines) and
    the only source file with no direct test, home of the documented request-side
    rounding limitation.

### P2 (staged)
13. Compiler flags: `noImplicitOverride`, `noFallthroughCasesInSwitch`,
    `noUnusedLocals/Parameters` (cheap); `noUncheckedIndexedAccess` as a dedicated
    migration PR (valuable for FFT/renderer indexing, noisy).
14. CHANGELOG discipline: CI nudge or fully generated notes — the manual file is two
    releases stale.
15. Workflow hygiene: `concurrency` + cancel-in-progress; `cypress-io/github-action`
    v4 → v6; make lint/typecheck/unit required branch-protection checks.

---

## R6. Correctness & leak fixes from the code review

Verified findings from the line-by-line review. Each lands as its own `fix(...)` PR
before or alongside the refactors above, ordered by severity.

### R6.1 Core (wavesurfer/player/webaudio/decoder/reactive)

**Critical**
- **`destroy()` on the WebAudio backend never tears down the `WebAudioPlayer` —
  AudioContext leaked, playback keeps going.** The internally-created WebAudioPlayer is
  passed as `options.media` (`wavesurfer.ts:212-214`), so Player marks it
  `isExternalMedia = true` and `destroy()` bails before pause/remove
  (`player.ts:297-303`); `WebAudioPlayer.destroy()` is dead code for the only player
  core ever creates. `create({backend:'WebAudio'}); play(); destroy()` → audio plays
  to the end, AudioContext open forever (browsers cap live contexts), buffer retained.
  This is the direct runtime cost of the impersonation R2 removes; interim fix if
  needed pre-R2: track "internally created" separately from "user-supplied".

**Major**
- **`destroy()` synchronously after `create()` resurrects the instance.** The
  constructor defers `emit('init')` + `load()` to a microtask with no destroyed guard
  (`wavesurfer.ts:260-273`); post-destroy, `loadAudio` revives all bridges — full
  fetch/decode/render into a detached tree, with `autoplay` even ghost audio. R1
  (terminal destroy) fixes this class of bug wholesale; the deferred callback must
  check disposal either way.
- **`state.isSeeking` sticks `true` forever on the WebAudio backend.**
  `WebAudioPlayer` never emits `'seeked'` (`webaudio.ts:285-294` emits only
  `'seeking'`); `_seeking` is cleared only on `'seeked'` (`player.ts:180-193`). Any
  consumer of the v8 reactive state gating on `isSeeking` breaks. Fix: emit `'seeked'`
  from the currentTime setter (folds into R2's backend interface conformance).
- **`play(start, end)` overshoots arbitrarily in background tabs** (MediaElement path):
  `stopAtPosition` is only checked in the rAF-driven `onTick`, and rAF suspends in
  hidden tabs. One-line fix: also check it in the media `'timeupdate'` handler
  (`wavesurfer.ts:336-340`).

**Minor**
- Player's `'canplay'` playbackRate listener never registered for cleanup
  (`player.ts:110-120`) — survives destroy with external media.
- `setMediaElement()` during an in-flight load with unknown duration hangs `load()`
  forever (resolver lives on `mediaEventScope`, disposed without resolving;
  `wavesurfer.ts:680-697, 900-904`).
- A throwing `'timeupdate'` listener kills the frame loop permanently (`tick`
  schedules the next frame *after* the callback; `isRunning` stays true so restart is
  blocked; `frame-scheduler.ts:25-33`, `event-emitter.ts:65-69`).
- `Player.setTime()` pre-metadata: standalone NaN → deferred
  `media.currentTime = NaN` throws inside `canplay`; under WaveSurfer early seeks
  clamp to 0, defeating the #4353 pending-seek deferral in exactly its window.
- `decoder.normalize` decides from channel 0 only, scales all channels by channel 0's
  max, and mutates caller-owned peaks arrays in place (`decoder.ts:15-31`).
- `createBuffer`'s fake AudioBuffer has `copyFrom/ToChannel` methods that throw
  "Illegal invocation" (`decoder.ts:71-72`) — implement or drop for v8.
- `empty()` is fire-and-forget → unhandled rejection path (`wavesurfer.ts:895-897`).
- **Superseded `load()` resolves as success** — decide consciously for v8: rejecting
  with a canonical `AbortError` is more conventional than silently fulfilling.
- `BasePlugin` exposes `scope` but `BasePlugin.destroy()` never disposes it — a
  third-party class plugin using `this.scope.listen()` with inherited destroy leaks
  everything (`base-plugin.ts:22, 49-59`). Dispose it in `BasePlugin.destroy()` (safe:
  chassis re-inits create fresh scopes) as part of R4.
- WebAudioPlayer: no `audioContext.resume()` in `play()` (suspended-context silent
  playback); `src` fetch not abortable; `stopAt()` in the past can throw RangeError
  (`webaudio.ts:138-166, 216-233`).
- `'error'` event typed `Error` but delivers a force-cast `MediaError`
  (`wavesurfer.ts:380`) — normalize for v8.

Verified-clean: `scope.ts` semantics, `fetcher.ts` teardown, the load/supersede/destroy
classification (correct for every constructed interleaving — R1 lets us delete it
anyway), `drag-stream.ts` bookkeeping, `store.ts` reentrancy/settle logic (document
LIFO batch-flush ordering if the module goes public).

Core architectural corroboration (feeds R2/R3): the review independently flagged the
same structural issues — two parallel channels carrying the same facts (events vs
signals, already disagreeing via the `isSeeking` bug), dual write-ownership of
composed signals (Player bridge + standalone `WaveSurferActions` setters), three
disposal conventions (`Scope`, duck-typed `_cleanup`, bespoke closures — collapse to
`Scope`), destroy→reuse flag choreography across three layers, and the
`as unknown as HTMLAudioElement` type lie as C1's root cause.

### R6.2 Renderer & DOM

**Critical**
- **`visibleRange` doesn't track `isScrollable` transitions — lazy rendering and
  timeline windowing freeze after zooming in from a fit-to-width view.**
  `renderer.ts:146-156` — the auto-tracked computed reads `isScrollable` as a plain
  field, so when the last run took the non-scrollable early-return branch, the
  dependency on `scrollStream.percentages` is dropped and never re-collected (the only
  recompute triggers are `audioDuration` — an `Object.is` no-op on re-render of the
  same file — and `streamEpoch`, bumped only at construction/revival). Load with
  default `minPxPerSec: 0`, then `zoom(1000)`: scrolling shows **blank canvases**
  beyond the initial window, and `getVisibleRange()` consumers (timeline) stop
  re-windowing. Reproduced with a test. Fix: make `isScrollable` a signal (preferred —
  aligns with R3's "half-adopted reactivity" cleanup) or bump `streamEpoch` in
  `render()` on transitions. Existing tests only cover first-render-scrollable.

**Major**
- Destroy→load renders into a detached container (see R1 above — resolved by making
  destroy terminal rather than by re-appending).
- **`normalize: true` normalizes each canvas chunk independently** — visible amplitude
  discontinuities at every canvas seam on long/zoomed files (`renderer.ts:625-630`,
  `renderer-utils.ts:379-393` operate on per-canvas slices). Fix: compute the global
  max once per `render()` and thread it through as `maxPeak`.

**Minor**
- Bar-grid clamp defaults disagree with actual bar spacing (`renderer-utils.ts:275-282`
  vs `:46-50`) — clipped bar/irregular gap at canvas seams at dpr=1.
- Lazy render window uses average canvas width — up to `(barWidth+barGap)` px of
  undrawn strip at a viewport edge (`renderer-utils.ts:350-363`).
- `roundToHalfAwayFromZero` ceils, doesn't round — outward-biased cursor drift on
  repeated wheel-zoom (`renderer-utils.ts:443-447`).
- `destroy()` retains `audioData`/`decodedData` (~40MB per 10min stereo) — with R1
  terminal destroy, null both.
- `setOptions` cannot un-set a fixed `width` (`renderer.ts:795-798`).
- Pointer math divides by `rect.width/height` unguarded; `clampToUnit` passes NaN
  through → NaN seeks on hidden containers (`renderer-utils.ts:184-190, 26-30`).
- Per-draw throwaway `<canvas>` in gradient resolution — GC churn during scroll-time
  lazy draws (`renderer-utils.ts:235-239`).
- `dom.ts` latent issues: `string | Node` textContent stringifies Nodes; same-tag
  siblings inexpressible; loose `isHTMLElement`.
- Migration note: v7's `vertical` option is gone from `WaveSurferOptions` — call out
  in v8 migration notes.

Architectural note (feeds R3): the renderer's reactivity is half-adopted —
`isScrollable`, `audioData`, `options` are plain mutable fields feeding an
auto-tracked computed, which is exactly what produced the critical finding. As part of
R3, promote layout outputs to signals or use explicit dependencies. Candidate
decompositions (post-8.0): a canvas-tile pool owning `drawnIndexes`/eviction (making
MAX_NODES eviction visible-range-aware instead of wipe-everything), and
cursor/scroll positioning (`renderProgress`/`scrollIntoView`) as its own module.

### R6.3 Plugins

**Critical**
- **Record: mic stays live forever when destroyed during a pending `getUserMedia`.**
  `record.ts:268-289` — `startMic()` has no `this.destroyed` guard after the await;
  `destroy()` replaces the scope with a fresh one, so a late permission grant attaches
  the stream, AudioContext, and a 100fps interval to a scope nothing ever disposes.
  Fix: `destroyed` guard after the await + stop tracks when destroyed.

**Major**
- **Regions: dragging a region against either edge permanently shrinks it.**
  `regions.ts:404-434` — endpoints clamped independently during drag; reject the move
  (preserving length) instead of clamping each end.
- **Record: restarting while recording pollutes the new session and fires a spurious
  `record-end`.** `record.ts:304-364` — old recorder's queued `dataavailable`/`stop`
  events dispatch into the new session's handlers (stale foreign chunk → corrupt blob).
- **Timeline: `duration` option is dead code.** `timeline.ts:147` —
  `getDuration() ?? opts.duration` never falls through (getDuration returns 0, not
  nullish), so a timeline can never render before audio loads despite call sites
  clearly intending it.
- **Record: hijacked wavesurfer options never restored** on `stopMic()`-without-record
  or `renderRecordedAudio: false` (`record.ts:133-145, 349-357`) — host waveform left
  non-interactive with hidden cursor.

**Minor** (fix the cheap ones pre-8, batch the rest)
- Record `isActive()` returns true before any recorder exists (`record.ts:388-390`).
- Zoom: wheel-zoom before decode throws (swallowed) and blocks page scroll —
  needs a `!duration` guard (`zoom.ts:124-169`); stale pointer anchor after scroll at
  same x (`zoom.ts:150-153`); `iterations: 1` divides by zero; `startZoom` never reset
  on new audio (`zoom.ts:109-136`).
- Hover: documented `string` `lineWidth` yields `NaN` positioning (`hover.ts:133-202`).
- Timeline: notch width measured before DOM insertion → culling condition degenerate
  (`timeline.ts:110-131`).
- Envelope: registered after decode never renders its UI — missing "already decoded"
  init like minimap/timeline have (`envelope.ts:507-515`); `||` option fallbacks make
  falsy values (`dragPointSize: 0`) unusable (`envelope.ts:350-353`).
- Regions: min/maxLength bypassed during drag-creation; `setOptions({start,end})`
  doesn't update marker/region styling (`regions.ts:426-427, 541-548`).
- **Post-destroy API behavior is inconsistent across plugins** (throw vs silent no-op
  vs deliberately supported) — unify under R1's "one consistent rule".

Lifecycle note: the six `definePlugin` plugins have verifiably solid scope-owned
teardown. **Record is the lone class-based holdout and hand-rolls the chassis** — both
of its unguarded async holes live exactly in that divergence. Migrating record to
`definePlugin` is therefore part of the R4 story, not just cosmetics. Timeline and
minimap re-emit `ready` on every rebuild (unlike wavesurfer's per-load semantics) —
document or unify.

### R6.4 Spectrogram subsystem

**Major**
- **Full mode renders a stale spectrogram after loading a new audio file.** Cache is
  never invalidated on buffer change: `throttledRender` fast-path draws
  `cachedFrequencies` from the previous file (`spectrogram-setup.ts:1116-1169`), and
  even the full path reuses `cachedResampledData` keyed only on width
  (`:1289-1297`). Windowed mode handles this correctly (`segmentManager.reset()`);
  full mode must too. Fix direction: extract the five interacting cache variables
  behind a cache object with a single invalidation path keyed on buffer identity.
- **`frequenciesDataUrl` renders a blank spectrogram unless `frequencyMax` is set.**
  `freqMax` stays 0 on the data-URL path → zero-height `createImageBitmap` rejects,
  swallowed; `ready` fires, nothing draws (`spectrogram-setup.ts:414, 1010-1038,
  1205-1241`). Default it to `sampleRate / 2` on that path; add the missing test.

**Minor**
- Windowed: progressive loader races viewport `generateSegments` → orphaned canvases
  (re-check `segments.has()` after await; `spectrogram-windowing.ts:236-250, 385`).
- `lanczoz` window NaN for odd window lengths → fully blank spectrogram, now reachable
  via the `fftSize` decoupling (`fft.ts:85-89`).
- `noverlap` silently capped at 50% of `fftSamples`, contradicting the documented
  contract (`spectrogram-frequencies.ts:190-194`) — fix docs/validation, one way or
  the other.
- `paintColumnPixels` clamps but doesn't floor → fractional external JSON values
  throw mid-draw (`spectrogram-render-utils.ts:637-641`).
- Bark scale: `hzToScale(0) ≠ 0` breaks the vertical-mapping assumption (~0.6% offset,
  out-of-range bitmap rows) (`spectrogram-windowing.ts:556-563`).
- Windowed zoom: quality refresh only sees single-step ratio; segment FFT data never
  recomputed on zoom (documented "no cache invalidation on zoom").
- Windowed segment cap counts segments not bytes — worst case ~576MB canvas memory,
  above Safari's budget (`spectrogram-windowing.ts:76, 116`). Move to a byte cap.
- Windowed `progress` event always 0 with default (non-progressive) loading.
- Cosmetic: labels background overdraw; main canvases ignore `devicePixelRatio`
  (blurry vs their own axis labels on HiDPI).

Worker lifecycle verified healthy (creation fallback, error latching, id-matched
responses, scope-guarded recreation, full teardown) — preserve its test pinning.

Structural (post-8.0, needs direct tests first — see R5 P1 #12): split
`spectrogram-setup.ts` along existing seams into `spectrogram-worker-client.ts` (pure
RPC client, no DOM coupling) and `spectrogram-full-render.ts` (mirroring
`spectrogram-windowing.ts`), leaving setup at ~600-700 lines of option resolution and
mode dispatch. Both major bugs above live in the full-render cache tangle — the
strongest argument for the extraction.

---

## Execution plan

Sequencing chosen so each step shrinks the blast radius of the next. Delivered as
sequential commits on `claude/v8-architecture-code-review-lputno` (per-stage, not PRs).

1. **Stage 1 — R5 P0** ✅ (commit `aaa3907`): CI/guardrails first, so every subsequent
   commit is checked by them.
2. **Stage 2 — R6 criticals** ✅ (`295e980`, `746dc04`, `9fae3fb`): WebAudio destroy
   leak (+ stuck isSeeking), renderer visibleRange freeze, record mic leak.
3. **Stage 2b — R6 majors** ✅ (`4374c14`…`4545b72`, `f4f8564`): background-tab stopAt,
   timeline duration, regions edge-drag, record restart/options/isActive, spectrogram
   stale-cache + frequenciesDataUrl.
4. **Stage 3 — R1** ✅ (`08ec196`): terminal destroy; −336 net lines of revival
   machinery; reuse-pinning tests rewritten as terminal-destroy contract tests;
   cypress abort.cy.js updated.
5. **Stage 4 — R4** ✅ (`c776e44`): BasePlugin deprecated; chassis scope disposed in
   destroy() (m9); record re-init moved to onInit. (Record's full definePlugin
   migration remains open.)
6. **Stage 5 — R2** ✅ (`a0aa1e0`): WaveSurfer owns Player by composition; the
   `as unknown as HTMLAudioElement` lie and scattered `instanceof` branches are gone;
   `getMediaElement(): HTMLMediaElement | null` (null under WebAudio).
7. **Stage 6 — R3** ✅ (`868ab00`, `3bc655d`): Renderer exposes signals instead of an
   event bus, `initRendererEvents` is the one signals→public-events bridge, public
   `dist/wavesurfer.d.ts` byte-identical; eslint bans `extends EventEmitter` across
   `src/**` (allowlist: WaveSurfer, BasePlugin, WebAudioPlayer media boundary, regions'
   public per-region events); envelope's Polyline converted to injected callbacks —
   zero internal event buses remain.
8. Remaining open items for 8.x: R6 minors not yet fixed, R5 P1 (API snapshot,
   type-aware lint, release-workflow gate, bundle budget, spectrogram-setup direct
   tests), record's full definePlugin migration, optional plugin migration from public
   events to `ctx.state` signals, then **v8.0.0-rc**.

Each stage: semantic commits, green on the new CI gauntlet.

## Out of scope for v8.0.0

- Removing `BasePlugin` (v9).
- Splitting `spectrogram-setup.ts` (tracked, can land in 8.x as pure refactor once it
  has direct tests).
- `exactOptionalPropertyTypes` and other noisy compiler flags.
