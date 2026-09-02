# wavesurfer.js v8.0.0 — Pre-release Refactoring Spec

Status: **draft** — decisions below are final; the "Findings under verification" sections
are being filled in from the ongoing code review.

This spec defines the architectural refactoring to land before v8.0.0 final. It is the
output of a full architecture/code review of `8.0.0-beta.3` plus maintainer decisions.

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
Pending: results of a public-code scan for the `destroy()` → `load()` reuse pattern
(grep.app / GitHub search / framework wrappers incl. `@wavesurfer/react`).
*(section to be completed)*

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

Pending: verified findings from the line-by-line reviews of core, renderer/DOM,
plugins, and the spectrogram subsystem. Each lands as its own `fix(...)` PR before or
alongside the refactors above, ordered by severity.
*(section to be completed)*

---

## Execution plan

Sequencing chosen so each step shrinks the blast radius of the next:

1. **PR 1 — R5 P0** (CI/guardrails first, so every subsequent PR is checked by them),
   including the API-snapshot (P1 #8) if feasible — it documents R1–R4's breaking
   changes as diffs.
2. **PR 2 — R6 severity-critical/major fixes** on the current architecture (small,
   cherry-pickable to 7.x if needed).
3. **PR 3 — R1** terminal destroy (deletes revival machinery + test updates).
4. **PR 4 — R2** backend composition (mechanical; behavior-compatible except the
   documented `getMediaElement()` change). R1 first makes this smaller.
5. **PR 5 — R3** internal events → streams (renderer first, then plugin-facing).
6. **PR 6 — R4** BasePlugin deprecation + docs/migration guide.
7. **v8.0.0-rc**: beta soak, then final.

Each PR: semantic title, green on the new CI gauntlet, API-snapshot diff reviewed.

## Out of scope for v8.0.0

- Removing `BasePlugin` (v9).
- Splitting `spectrogram-setup.ts` (tracked, can land in 8.x as pure refactor once it
  has direct tests).
- `exactOptionalPropertyTypes` and other noisy compiler flags.
