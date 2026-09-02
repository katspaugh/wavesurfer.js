import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

// Raw resource-acquisition APIs are banned everywhere in src/** except the
// Scope primitives themselves (see the `no-restricted-syntax` override
// below). Each selector matches both the bare global form (`setTimeout(...)`)
// and the `window.`/`self.`/`globalThis.`-qualified form, so renaming the
// receiver doesn't dodge the ban. The message on every entry names the Scope
// (src/scope.ts) alternative to use instead.
const rawResourceAcquisitionRule = [
  'error',
  {
    selector: "CallExpression[callee.property.name='addEventListener']",
    message:
      'Raw addEventListener is banned outside Scope primitives. Use scope.listen(target, type, fn, options) (src/scope.ts) so the listener is removed on dispose.',
  },
  {
    selector: "CallExpression[callee.name='setTimeout'], CallExpression[callee.property.name='setTimeout']",
    message:
      'Raw setTimeout is banned outside Scope primitives. Use scope.timeout(fn, ms) (src/scope.ts) so the timer is cleared on dispose.',
  },
  {
    selector: "CallExpression[callee.name='setInterval'], CallExpression[callee.property.name='setInterval']",
    message:
      'Raw setInterval is banned outside Scope primitives. Use scope.interval(fn, ms) (src/scope.ts) so the interval is cleared on dispose.',
  },
  {
    selector:
      "CallExpression[callee.name='requestAnimationFrame'], CallExpression[callee.property.name='requestAnimationFrame']",
    message:
      'Raw requestAnimationFrame is banned outside Scope primitives. Use scope.raf(fn) (src/scope.ts), or Timer/FrameScheduler for a recurring loop, so the frame is cancelled on dispose.',
  },
  {
    selector: "NewExpression[callee.name='ResizeObserver'], NewExpression[callee.property.name='ResizeObserver']",
    message:
      'Raw `new ResizeObserver(...)` is banned outside Scope primitives. Use scope.createResizeObserver(el, fn) (src/scope.ts), or scope.observeResize(observer, el) for an observer shared across elements, so it is disconnected/unobserved on dispose.',
  },
  {
    selector: "NewExpression[callee.name='Worker'], NewExpression[callee.property.name='Worker']",
    message:
      'Raw `new Worker(...)` is banned. Construct workers via the `web-worker:` import + an injected WorkerCtor param (see src/plugins/spectrogram.ts) and register teardown (worker.terminate()) on ctx.scope.',
  },
]

// Internal modules must not communicate via EventEmitter (R3: events
// outside, streams inside). Banned by default across src/**; the files that
// legitimately ARE a public event surface get a per-file override below that
// keeps the raw-acquisition bans but allows `extends EventEmitter`.
const internalEventBusBan = {
  selector: "ClassDeclaration[superClass.name='EventEmitter'], ClassExpression[superClass.name='EventEmitter']",
  message:
    'Internal modules must not be event buses: expose signals/streams (src/reactive/) instead. The public event surface lives on WaveSurfer and the plugin chassis only.',
}

export default compat.config({
  env: { browser: true, es2021: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier', 'plugin:prettier/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-this-alias': 'off',
  },
  ignorePatterns: ['cypress', 'examples', 'tutorial', 'scripts'],
  overrides: [
    {
      files: ['src/__tests__/**/*.ts'],
      env: { jest: true, node: true },
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
    {
      // Bans raw resource acquisition (addEventListener/setTimeout/setInterval/
      // requestAnimationFrame/ResizeObserver/Worker construction) across all of
      // src/**, so lifecycle cleanup is always expressed as disposing a Scope
      // (src/scope.ts) instead of hand-paired add/remove calls. Tests are
      // exempt entirely (excludedFiles below) -- of the three __tests__
      // directories in src/ (src/__tests__, src/state/__tests__,
      // src/reactive/__tests__), src/__tests__ and src/reactive/__tests__ both
      // contain real raw-acquisition calls that would otherwise fail; the
      // doubled-** glob reaches all three uniformly rather than listing them.
      files: ['src/**/*.ts'],
      excludedFiles: ['src/**/__tests__/**/*.ts'],
      rules: {
        'no-restricted-syntax': [...rawResourceAcquisitionRule, internalEventBusBan],
      },
    },
    {
      // Public event surfaces: `extends EventEmitter` is allowed here (the
      // raw-acquisition bans still apply). Each entry carries its own
      // justification for why it is a legitimate event surface, not an
      // internal bus.
      files: [
        // WaveSurfer itself: the public WaveSurferEvents surface -- the one
        // bridge where internal signals become public events.
        'src/wavesurfer.ts',
        // The plugin chassis: plugins' public per-plugin events (ctx.emit)
        // ride on BasePlugin's emitter.
        'src/base-plugin.ts',
        // WebAudioPlayer emulates the HTMLMediaElement event surface -- a
        // media boundary consumed like a media element, not an internal bus.
        'src/webaudio.ts',
        // Regions' SingleRegion: each region object is a public per-region
        // event surface (users call region.on('update', ...)).
        'src/plugins/regions.ts',
        // Envelope's Polyline emitter predates R3; plugins are out of R3's
        // scope (they consume/emit public events, not internal core buses).
        'src/plugins/envelope.ts',
      ],
      rules: {
        'no-restricted-syntax': rawResourceAcquisitionRule,
      },
    },
    {
      // Primitive files: raw acquisition here IS the primitive that
      // scope.listen/timeout/interval/raf/observeResize/createResizeObserver
      // wraps for everyone else, or a self-contained resource with its own
      // deterministic cleanup that isn't part of the Scope tree. Each entry
      // below carries its own justification for why it's exempt.
      files: [
        // The Scope class itself: addEventListener/setTimeout/setInterval/
        // requestAnimationFrame/ResizeObserver here ARE scope.listen/timeout/
        // interval/raf/createResizeObserver's implementations.
        'src/scope.ts',
        // FrameScheduler: the requestAnimationFrame loop primitive; its own
        // stop() is registered on the Scope passed into its constructor.
        'src/frame-scheduler.ts',
        // fromEvent(): the reactive-signal DOM-event primitive. Its
        // addEventListener is paired with a `_cleanup` function that callers
        // invoke via reactive/event-streams.ts's own cleanup() helper (see
        // renderer.ts/hover.ts, which wire that cleanup into their Scope).
        'src/reactive/event-streams.ts',
        // createDragStream()/createScrollStream(): reactive-stream primitives
        // that own their own listeners and return a `cleanup()` function;
        // callers (renderer.ts, envelope.ts) register that cleanup on their
        // Scope instead of calling scope.listen directly.
        'src/reactive/drag-stream.ts',
        'src/reactive/scroll-stream.ts',
        // fetchBlob()'s progress-abort listener: not owned by any component
        // lifecycle (fetchBlob is a bare async utility, not a class with a
        // Scope). It is deterministically removed in a `finally` block that
        // runs on every exit path -- including the abort-mid-flight path,
        // where the `while(true)` read loop throws a DOMException out of
        // `reader.read()` and the `finally` still fires before the throw
        // propagates -- so the listener cannot outlive the fetch regardless
        // of how/when destroy() runs elsewhere.
        'src/fetcher.ts',
        // Player.onMediaEvent() is allowlisted at the call site (a
        // line-level eslint-disable-next-line), not here -- see that method
        // in player.ts. It's the file's only raw-acquisition call, so a
        // file-wide entry isn't needed and would hide any new one added
        // later in this (357-line) file.
      ],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
})
