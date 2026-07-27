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
- `computeCanvasPlan({totalWidth, clientWidth, options})` returning `{numCanvases, singleCanvasWidth, slots: CanvasSlot[]}` where `CanvasSlot = {offset, width}`
- `FrameScheduler(scope)` constructor; synchronous first tick on `start()`

**Patterns:**
- Per-load `loadScope: Scope` + `supersededLoadScopes: WeakSet<Scope>` in `WaveSurfer.ts` for abort-on-new-load
- Load lifecycle on child `Scope` + `AbortSignal`: replaces `_loadVersion`, `_isDestroyed` post-await guards, and `abortController`
- Deferred-minor cleanup sweep completed (webaudio stale-src guard, envelope polyline null, duplicate drag-stream tests, computed subscriber clearing on dispose).

## Plan 3 — definePlugin + plugin ports (after Plan 2)

Spec: functional plugin API `definePlugin(name, (ctx, options) => api)`
with `ctx = { wavesurfer, scope, state }`; teardown = scope disposal only;
`BasePlugin` becomes a deprecated compat shim over it. Shared utilities to
kill the copy-paste classes found in review: `resolveContainer()` (one
error behavior, replaces 4 divergent copies), `overlayElement(scope,
style)` (6 copies), `bridgeEvents(from, to, names, scope)` (minimap's 64
forwarder lines). Port order: hover, zoom (smallest) → timeline, minimap →
regions, envelope, record (per-entity child scopes). Public API: existing
plugin classes keep working via the shim through v8; `definePlugin` is
additive.
Depends on Plan 2's `visibleRange` (timeline/minimap ports consume it) and
`loadPhase` (record/regions guards).

## Plan 4 — Spectrogram unification + leak harness + lint bans (last)

Spec: one spectrogram plugin with `rendering: 'full' | 'windowed'`
strategy; single shared FFT kernel module imported by worker and main
thread (deletes the triplicated loop); one options type + validation
block; configurable worker timeout in both modes; remove both
`@ts-nocheck` headers (the ~390 duplicated lines and the undeclared-field
bugs they hid are already fixed or die in the merge). Plus:
FinalizationRegistry leak tests under `node --expose-gc` (create →
interact → destroy → gc → assert collected — the class of test that would
have caught the spectrogram buffer retention); ESLint `no-restricted-*`
bans on raw `addEventListener`/`setTimeout`/`setInterval`/
`requestAnimationFrame`/`new ResizeObserver` outside `src/scope.ts`.
Depends on Plan 3 (the merged spectrogram should be written against
`definePlugin`, not `BasePlugin`).

## Deliberately deferred (recommendation, not scheduled)

Deriving the public events from state (the original proposal's "events as
a projection") is deferred indefinitely: the double-emission bug it
targeted is fixed, event timing is contractual for v7 consumers, and the
migration risk now outweighs the architectural win. Revisit only at a
major version boundary.
