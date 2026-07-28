/**
 * GC-level leak-regression harness.
 *
 * Every other "leak" test in this repo (memory-leaks.test.ts, envelope-leaks.test.ts,
 * spectrogram-destroy.test.ts's "releases the decoded buffer on destroy", ...) asserts leaks
 * *structurally*: it pokes an internal field and checks it was nulled, or checks a DOM node was
 * removed. That catches "did the code run the right teardown line" but NOT "is the object graph
 * actually reachable from a GC root afterward" - the exact gap that let the original spectrogram
 * gigabyte-retention bug (a `this.buffer`-style field silently keeping a decoded AudioBuffer
 * alive) go unnoticed: every structural assertion could pass while the real object stayed
 * pinned by something the test never looked at (a closure, an event listener, a cache the test
 * didn't know to poke).
 *
 * This file closes that gap with `WeakRef` + `--expose-gc`: create something, destroy it, drop
 * every strong reference *this test* holds, force a real GC cycle, and assert the object is
 * actually gone. It only runs under the 'leaks' Jest project (see jest.config.js), via
 * `yarn test:leaks`, which sets `NODE_OPTIONS=--expose-gc` so `global.gc()` exists.
 *
 * ## CI stance: manual/pre-release gate, not wired into CI
 *
 * `test:leaks` is deliberately NOT part of `.github/workflows/unit-tests.yml` (which only runs
 * `yarn test:unit`, i.e. the 'default' project). Real-GC timing is inherently less deterministic
 * than the rest of this repo's structural leak tests - it depends on V8's actual GC scheduling,
 * not just "did teardown code run" - so it's a manual/pre-release gate (run `yarn test:leaks`
 * before cutting a release, or when touching plugin/WaveSurfer teardown paths) rather than a
 * per-PR CI check that could flake the build on GC timing alone.
 *
 * ## Coverage shape: "whole graph" cases vs. the one field-sensitive case
 *
 * Most cases below drop EVERY reference to the whole object under test (instance, plugin, ws,
 * container, ...) before checking collection. That proves overall collectability - "is
 * everything reachable from this object gone once nothing external holds it" - which is real,
 * useful coverage, but it is NOT sensitive to a leak isolated to a single field: if some OTHER
 * field on an otherwise-dropped instance keeps pointing at a heavyweight value, that's invisible
 * to a "whole graph" check, because the whole instance (including the leaking field) becomes
 * unreachable anyway once nothing outside holds the instance itself. Only Case 3a
 * ("collects the decoded buffer once destroyed, even while the plugin instance itself is still
 * referenced") is shaped to catch that specific failure mode - it deliberately keeps the plugin
 * instance alive and checks that ONE field on it still releases its heavyweight value - and it's
 * the only case with a mutation-check (see the Task 4 report) actually proving it does. Each
 * "whole graph" case below carries its own inline note to this effect.
 *
 * ## Why every case nulls its own locals inside `make()`
 *
 * `collected()`'s `make: () => object` factory is deliberately synchronous and self-contained:
 * every object the scenario creates must be a LOCAL to `make()`'s own call frame, with only the
 * final target ever returned. If `make()` were instead a closure over a variable declared in the
 * surrounding `it()` (e.g. `let ws = WaveSurfer.create(...)` above it, then
 * `collected(() => { ws.destroy(); return ws })`), that arrow function's [[Environment]] would
 * keep the SAME shared `ws` binding reachable for the entire `collected()` call (`collected`'s
 * own `make` parameter holds the closure, which holds the environment, which holds `ws`) - the
 * WeakRef would then never clear, not because of a real leak, but because the test itself kept a
 * path alive. Where a scenario genuinely needs async setup (awaiting 'ready' before destroy is
 * possible), the outer `let` bindings are explicitly reassigned to `null` as the LAST statements
 * inside `make()`, before it returns - since closures capture bindings (not snapshotted values),
 * this mutation is visible from every reference to that closure, including whatever the `it()`
 * callback's own suspended frame still holds.
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import WaveSurfer from '../wavesurfer.js'
import RegionsPlugin from '../plugins/regions.js'
import SpectrogramPlugin from '../plugins/spectrogram.js'

// SpectrogramWorker is imported (indirectly, via plugins/spectrogram.ts's
// `import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'`) through
// rollup-plugin-web-worker-loader's virtual module scheme, which only resolves under rollup -
// under ts-jest it doesn't exist on disk at all. Every existing spectrogram test suite
// (spectrogram-destroy.test.ts, spectrogram-fft-size.test.ts, ...) mocks it the same way; this
// harness's SpectrogramPlugin case never sets `useWebWorker: true`, but the module is still
// imported eagerly by plugins/spectrogram.ts, so it must resolve to *something*.
jest.mock(
  'web-worker:./spectrogram-worker.ts',
  () => ({
    __esModule: true,
    default: class MockSpectrogramWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null
      onerror: ((e: Event) => void) | null = null
      postMessage = jest.fn()
      terminate = jest.fn()
    },
  }),
  { virtual: true },
)

// ---- Suite-start guard: fail loudly (not silently-vacuous) if global.gc isn't callable ----
// A missing --expose-gc would make every `collected()` call below a silent, permanent `false` -
// i.e. every leak assertion would look like "still retained" regardless of whether the code
// actually leaks. That's worse than not having the harness at all (a confidently-wrong red),
// so this is asserted once, up front, with a message pointing at the correct entry point.
beforeAll(() => {
  if (typeof (globalThis as { gc?: () => void }).gc !== 'function') {
    throw new Error(
      'gc-leaks.test.ts requires global.gc(): run it via `yarn test:leaks` (sets ' +
        'NODE_OPTIONS=--expose-gc), not `yarn test:unit` / a bare `jest` invocation. See ' +
        'jest.config.js\'s "leaks" project and this file\'s own doc comment.',
    )
  }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
})

// jsdom ships no Web Audio API at all (`typeof AudioBuffer === 'undefined'`), but
// decoder.ts's real (unmocked - this suite deliberately exercises the real decode path, not a
// jest.mock('../decoder.js') stand-in, since a mocked decoder wouldn't reproduce the actual
// object graph a gigabyte-retention regression would occur in) `Decoder.createBuffer()` reads
// `AudioBuffer.prototype.copyFromChannel`/`copyToChannel` to populate its returned object. A
// minimal stub is enough: nothing in this file ever calls those two methods, they just need to
// exist as functions at the point `createBuffer` reads them off the prototype.
if (typeof (globalThis as { AudioBuffer?: unknown }).AudioBuffer === 'undefined') {
  class FakeAudioBuffer {
    copyFromChannel(): void {}
    copyToChannel(): void {}
  }
  ;(globalThis as { AudioBuffer?: unknown }).AudioBuffer = FakeAudioBuffer
}

/**
 * The Task 4 brief's binding design, with one deliberate, empirically-forced change from the
 * brief's own sketch: `ref.deref()` is called exactly ONCE, after every `gc()`/wait round, not
 * once per round inside the loop.
 *
 * Why: per spec (`WeakRef.prototype.deref`, 9.10.4 "AddToKeptObjects"), every `deref()` call adds
 * the referent to the current realm's "kept objects" list, which is only cleared between host
 * "jobs". Calling `deref()` on each loop iteration (the brief's literal sketch: `if
 * (ref.deref() === undefined) return true` inside the loop) re-adds the target to that list on
 * every single check - which was verified, empirically, to make the target UNCOLLECTIBLE for the
 * lifetime of the loop, regardless of whether anything in the real object graph retains it.
 * Confirmed in plain Node (no Jest involved) with `node --expose-gc`: a bare, obviously-dead
 * `{ big: new Array(10000).fill(0) }` with no other reference anywhere reports "still alive"
 * after 100 rounds of `gc()` when polled every iteration, but reports collected within the
 * original 10-round budget when `deref()` is only called once at the end - and a genuinely
 * leaked object (held by an outer closure) still correctly reports "still alive" either way. Only
 * checking once means giving up the loop's "return true as soon as it clears" early exit; nothing
 * else about the design changes. Using the literal per-iteration-check version here would have
 * made every single case in this file permanently fail regardless of the production code's
 * correctness - i.e. the exact "fake fail" this harness exists to avoid producing in the other
 * direction (a fake PASS).
 */
const collected = async (make: () => object): Promise<boolean> => {
  const ref = new WeakRef(make()) // factory so no local strong ref survives
  for (let i = 0; i < 10; i++) {
    global.gc!()
    await new Promise((r) => setTimeout(r, 10))
  }
  return ref.deref() === undefined
}

/**
 * `expect(ok).toBe(true)` alone just prints "expected true, received false" on failure - jest's
 * `toBe` has no message parameter, and this file has enough distinct retention scenarios that a
 * bare boolean forces whoever's debugging a red run to go re-derive which of them failed and
 * where to look. This bakes that answer into the assertion itself: `retainedWhat` names the
 * target and points at the teardown site responsible for releasing it.
 */
const expectCollected = (ok: boolean, retainedWhat: string): void => {
  expect(ok ? 'collected' : `still reachable after the GC-cycle budget: ${retainedWhat}`).toBe('collected')
}

/** A handful of non-trivial peaks so Decoder.createBuffer produces a real, sized Float32Array. */
const makePeaks = (length = 4096): number[][] => [Array.from({ length }, (_, i) => Math.sin(i / 37) * 0.8)]

describe('GC leak regression harness (WeakRef + --expose-gc)', () => {
  // ==========================================================================================
  // Case 1: WaveSurfer core (+ its decoded AudioBuffer-equivalent)
  // ==========================================================================================
  describe('Case 1: WaveSurfer core', () => {
    // Whole-graph coverage (see this file's top doc comment, "Coverage shape") - both tests below
    // drop every reference to `ws` itself, so they verify overall collectability of the whole
    // instance, not sensitivity to a single retained field.
    it('collects the WaveSurfer instance after destroy, with peaks+duration loaded', async () => {
      // Detached: appended to nothing, in particular never document.body. jsdom's own document
      // keeps every node ever attached to it reachable for the lifetime of the test file (see
      // this file's own trailing doc comment on the jsdom retention caveat) - a detached
      // container sidesteps that entirely rather than fighting it.
      let container: HTMLElement | null = document.createElement('div')
      let ws: WaveSurfer | null = WaveSurfer.create({ container, peaks: makePeaks(), duration: 2 })
      await new Promise((resolve) => ws!.once('ready', resolve))
      // Sanity: prove the load actually completed (a vacuous "collected" on an instance that
      // never decoded anything would prove nothing about the real load->destroy lifecycle).
      if (!ws.getDecodedData()) throw new Error('setup did not decode - this test would be vacuous')

      let childrenAfterDestroy = -1
      const ok = await collected(() => {
        const instance = ws!
        const parent = container!
        instance.destroy()
        // Renderer.destroy() removes its own wrapper from the user-supplied container - assert
        // it even on a detached parent (the brief's "container element removed from a detached
        // parent" case): this is a plain structural check, independent of the WeakRef below.
        childrenAfterDestroy = parent.children.length
        ws = null
        container = null
        return instance
      })

      expect(childrenAfterDestroy).toBe(0)
      expectCollected(
        ok,
        'the WaveSurfer instance (check WaveSurfer#destroy() / whatever external code still references it)',
      )
    })

    // Whole-graph coverage, not field-retention sensitive (see top doc comment): `ws` itself is
    // also dropped here, so this proves the whole ws+renderer+decodedData graph is collectible
    // once nothing external holds `ws` - NOT that WaveSurfer#destroy()/Renderer#destroy()
    // proactively null their own `decodedData`/`audioData` fields (they don't - confirmed by
    // reading both; existing, not-in-scope behavior). A field-only leak on an otherwise-dropped
    // `ws` would be invisible to this test; only Case 3a is shaped to catch that failure mode.
    it('collects the decoded AudioBuffer-equivalent after destroy', async () => {
      let container: HTMLElement | null = document.createElement('div')
      let ws: WaveSurfer | null = WaveSurfer.create({ container, peaks: makePeaks(), duration: 2 })
      await new Promise((resolve) => ws!.once('ready', resolve))
      if (!ws.getDecodedData()) throw new Error('setup did not decode - this test would be vacuous')

      const ok = await collected(() => {
        const decoded = ws!.getDecodedData() as object
        ws!.destroy()
        ws = null
        container = null
        return decoded
      })

      expectCollected(
        ok,
        'the decoded AudioBuffer-equivalent (check what still references `ws` - WaveSurfer#destroy() and ' +
          'Renderer#destroy() do not null decodedData/audioData themselves, so this only passes if nothing ' +
          'external keeps `ws` alive)',
      )
    })
  })

  // ==========================================================================================
  // Case 2: RegionsPlugin, 3 regions incl. one removed pre-destroy (#4243 lineage)
  // ==========================================================================================
  describe('Case 2: RegionsPlugin (#4243 lineage)', () => {
    // Whole-graph coverage, not field-retention sensitive (see top doc comment): both tests below
    // drop every reference to `ws`/`regions`/`removedRegion` before checking collection, so they
    // verify overall collectability of the removed region / the plugin instance once nothing
    // external holds them - NOT sensitivity to a leak isolated to one field on an object that's
    // otherwise still referenced. Only Case 3a is shaped (and mutation-proven) to catch that.
    it('collects a region removed pre-destroy, and the plugin itself, after wavesurfer.destroy()', async () => {
      let container: HTMLElement | null = document.createElement('div')
      let ws: WaveSurfer | null = WaveSurfer.create({ container, peaks: makePeaks(), duration: 10 })
      await new Promise((resolve) => ws!.once('ready', resolve))

      let regions: ReturnType<typeof RegionsPlugin.create> | null = ws.registerPlugin(RegionsPlugin.create())
      regions.addRegion({ start: 0, end: 1 })
      let removedRegion: ReturnType<typeof regions.addRegion> | null = regions.addRegion({ start: 2, end: 3 })
      regions.addRegion({ start: 4, end: 5 })
      if (regions.getRegions().length !== 3)
        throw new Error('setup did not create 3 regions - this test would be vacuous')
      removedRegion.remove() // #4243: removed BEFORE destroy - the historically-leaked path
      if (regions.getRegions().length !== 2)
        throw new Error('remove() did not drop the region - this test would be vacuous')

      const ok = await collected(() => {
        const target = removedRegion as object
        ws!.destroy()
        removedRegion = null
        regions = null
        ws = null
        container = null
        return target
      })

      expectCollected(
        ok,
        "the region removed pre-destroy (check RegionsPlugin's region.once('remove', ...) pruning of its " +
          "`regions` array, and Region#remove()'s scope.dispose())",
      )
    })

    it('collects the RegionsPlugin instance itself after destroy', async () => {
      let container: HTMLElement | null = document.createElement('div')
      let ws: WaveSurfer | null = WaveSurfer.create({ container, peaks: makePeaks(), duration: 10 })
      await new Promise((resolve) => ws!.once('ready', resolve))
      let regions: ReturnType<typeof RegionsPlugin.create> | null = ws.registerPlugin(RegionsPlugin.create())
      regions.addRegion({ start: 0, end: 1 })
      regions.addRegion({ start: 2, end: 3 })
      regions.addRegion({ start: 4, end: 5 })

      const ok = await collected(() => {
        const target = regions as object
        ws!.destroy()
        regions = null
        ws = null
        container = null
        return target
      })

      expectCollected(
        ok,
        'the RegionsPlugin instance (check WaveSurfer#registerPlugin()/#destroy() plugin bookkeeping and ' +
          'BasePlugin#destroy())',
      )
    })
  })

  // ==========================================================================================
  // Case 3: SpectrogramPlugin after a render - the Phase-1 `this.buffer` retention lineage
  // ==========================================================================================
  describe('Case 3: SpectrogramPlugin buffer (Phase-1 `this.buffer` retention lineage)', () => {
    // A minimal, self-contained fake wavesurfer (same pattern as spectrogram-destroy.test.ts /
    // spectrogram-fft-size.test.ts / spectrogram-worker-errors.test.ts) rather than a real
    // WaveSurfer instance: it decouples the WeakRef target (the decoded buffer) from
    // WaveSurfer's OWN retention of `decodedData`/Renderer's own `audioData` field (neither of
    // which SpectrogramPlugin controls, and neither of which is nulled by WaveSurfer#destroy() -
    // see wavesurfer.ts/renderer.ts). Routing the buffer through a real WaveSurfer would make
    // this case's mutation check (see the Task 4 report) meaningless: dropping `ws` at the end
    // would drag the buffer down with it regardless of whether SpectrogramPlugin's own `buffer`
    // closure variable was nulled on destroy - the exact bug this case exists to catch. With a
    // fake wavesurfer, the ONLY strong reference to the target buffer, once `make()` returns, is
    // whatever SpectrogramPlugin's own setup closure still holds - which is precisely what a
    // regression in spectrogram-setup.ts's teardown (removing `buffer = null`) would keep alive.
    function createFakeWaveSurfer(decodedData: AudioBuffer) {
      const wrapper = document.createElement('div')
      Object.defineProperty(wrapper, 'offsetWidth', { value: 600, configurable: true })
      Object.defineProperty(wrapper, 'clientWidth', { value: 600, configurable: true })
      return {
        options: {},
        getWrapper: () => wrapper,
        getDecodedData: () => decodedData,
        on: () => () => undefined,
      }
    }

    /** A real, sized AudioBuffer-shaped object - not `{ length: 1 }` - so the render this case
     * exercises actually computes real frequency data over it, the same as a genuine render. */
    function makeAudioBuffer(length = 8192): AudioBuffer {
      const data = new Float32Array(length)
      for (let i = 0; i < length; i++) data[i] = Math.sin(i / 11) * 0.7
      return {
        duration: length / 44100,
        length,
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => data,
        copyFromChannel: () => undefined,
        copyToChannel: () => undefined,
      } as unknown as AudioBuffer
    }

    // This case is deliberately shaped differently from every other case in this file: the
    // PLUGIN instance is kept alive (referenced by the still-live `plugin` const) for the whole
    // `collected()` call, rather than dropped along with everything else. That's the point - the
    // historical Phase-1 bug was a still-alive plugin instance (e.g. one an app kept a reference
    // to, or one WaveSurfer's own `this.plugins` bookkeeping failed to drop) whose OWN `buffer`
    // field/closure-var kept pinning a decoded AudioBuffer after destroy(), independent of
    // whether the plugin object itself was reachable. Dropping `plugin` too (as the other cases
    // in this file do) would make the mutation check below meaningless: the target buffer would
    // become unreachable once `plugin` itself is collected regardless of whether destroy()'s
    // teardown ever nulled its own `buffer` variable - see this describe block's own doc comment
    // above `createFakeWaveSurfer` for the longer version of this reasoning, and the Task 4
    // report for the actual mutation-check run (temporarily deleting spectrogram-setup.ts's
    // `buffer = null` and confirming exactly this test - and only this test - goes red).
    it('collects the decoded buffer once destroyed, even while the plugin instance itself is still referenced', async () => {
      let audioBuffer: AudioBuffer | null = makeAudioBuffer()
      let fakeWs: ReturnType<typeof createFakeWaveSurfer> | null = createFakeWaveSurfer(audioBuffer)
      const plugin = SpectrogramPlugin.create({ useWebWorker: false })
      plugin._init(fakeWs as unknown as WaveSurfer)

      // getFrequenciesData() is the plugin's real public render-triggering entry point (the same
      // one throttledRender()/render() call from a 'redraw' event). Awaited (not fire-and-forget)
      // deliberately: getFrequenciesData()'s own cache write (`cachedBuffer = decodedData`) runs
      // AFTER its internal `await getFrequencies(...)`, with no post-await `ctx.scope.disposed`
      // guard - firing-and-forgetting it and destroying immediately was tried first and let that
      // pending write land AFTER destroy() had already nulled `cachedBuffer`/`buffer`, silently
      // re-populating `cachedBuffer` with the same object post-teardown and making this test
      // fail even against correct code (a real, if narrow, race worth its own follow-up - see
      // the Task 4 report). Awaiting here sidesteps it entirely for this test's purposes.
      await plugin.getFrequenciesData()

      // Captured BEFORE destroy(), while the plugin's own closure `buffer` variable still points
      // to it - this is our OWN reference, kept only long enough to hand to collected() below,
      // then nulled inside the factory (see the comment on the `collected` helper for why that
      // has to happen inside the factory, not before it).
      let target: object | null = plugin.__spectrogramInternalsForTests().buffer
      if (!target) throw new Error('render did not populate `buffer` - this test would be vacuous')

      plugin.destroy()

      // Drop every OTHER strong reference this test itself created to the target buffer. If
      // destroy() correctly nulled the plugin's own `buffer` closure variable, the ONLY
      // remaining strong ref to the object is now this test's own `target` binding (nulled
      // inside the factory below). If destroy() did NOT null it (the mutation this case guards
      // against), `plugin` - deliberately still referenced by this test - keeps a second,
      // independent path to the same object alive via its own internal state, and the WeakRef
      // below correctly reports "still alive" regardless of what this test does with `target`.
      audioBuffer = null
      fakeWs = null

      const ok = await collected(() => {
        const t = target!
        target = null
        return t
      })

      expectCollected(
        ok,
        "the decoded buffer, while `plugin` itself is still referenced (check spectrogram-setup.ts's " +
          'destroy() teardown - specifically the `buffer = null` line)',
      )
    })

    // Whole-graph coverage, not field-retention sensitive (see top doc comment): unlike 3a above,
    // this drops `plugin` itself too, so it verifies the plugin instance is collectible when
    // unreferenced - it does NOT isolate the `buffer` field the way 3a does, and stays green even
    // under 3a's mutation check (see the Task 4 report).
    it('collects the SpectrogramPlugin instance itself after a real render, after destroy', async () => {
      const ok = await collected(() => {
        const audioBuffer = makeAudioBuffer()
        const fakeWs = createFakeWaveSurfer(audioBuffer)
        const plugin = SpectrogramPlugin.create({ useWebWorker: false })
        plugin._init(fakeWs as unknown as WaveSurfer)
        void plugin.getFrequenciesData()
        if (!plugin.__spectrogramInternalsForTests().buffer) {
          throw new Error('render did not populate `buffer` - this test would be vacuous')
        }
        plugin.destroy()
        return plugin
      })

      expectCollected(ok, 'the SpectrogramPlugin instance (check BasePlugin#destroy() / definePlugin teardown)')
    })
  })

  // ==========================================================================================
  // Case 4: a definePlugin test plugin whose setup captures a large array on scope
  // ==========================================================================================
  describe('Case 4: definePlugin scope-held payload', () => {
    // A synthetic plugin, local to this test: its setup() closes over a sizable typed array
    // that is NEVER exposed on the returned Api (no field, no getter) - the only way to reach
    // it is through the plugin instance's own closures (peek()) or through ctx.scope's internal
    // disposer bookkeeping (see scope.ts's `dispose()`, which replaces `this.disposers` with a
    // fresh empty array rather than merely iterating the old one - a regression there, e.g.
    // iterating without ever dropping the array, would keep every disposer closure - and
    // whatever they captured - reachable via the Scope instance forever). Mirrors real plugins
    // that hold a heavyweight decoded/cached value purely in closure state (spectrogram's
    // `buffer`, envelope's polyline state, ...).
    const GcPayloadTestPlugin = definePlugin<Record<string, never>, BasePluginEvents, { peek: () => number }>(
      'GcPayloadTestPlugin',
      (ctx) => {
        const payload = new Float64Array(200_000) // ~1.6MB, closure-only
        for (let i = 0; i < payload.length; i++) payload[i] = i
        ctx.scope.add(() => {
          // Mirrors real plugins' teardown shape (at least one scope-registered disposer) -
          // this one has nothing extra to release, `payload` dies with the closure itself.
        })
        return { peek: () => payload.length }
      },
    )

    // Whole-graph coverage, not field-retention sensitive (see top doc comment): `plugin` itself
    // is dropped along with `ws`/`container`, so this proves the plugin instance (and therefore,
    // transitively, its closure-only `payload`) is collectible once unreferenced - NOT that
    // `payload` specifically gets released while the plugin instance survives. No case in this
    // file mutation-tests scope.ts's `dispose()` directly (see the Task 4 report); the "whole
    // graph gone" signal here is real but coarser than Case 3a's field-level check.
    it('collects the plugin instance (and its closure-only payload) after destroy', async () => {
      const ok = await collected(() => {
        const container = document.createElement('div')
        const ws = WaveSurfer.create({ container })
        const plugin = ws.registerPlugin(GcPayloadTestPlugin.create())
        if (plugin.peek() !== 200_000) throw new Error('setup did not run - this test would be vacuous')
        ws.destroy()
        return plugin
      })

      expectCollected(
        ok,
        'the GcPayloadTestPlugin instance / its closure-only payload (check definePlugin teardown and ' +
          'Scope#dispose())',
      )
    })
  })
})

// ---- Known jsdom retention caveats (documented per the Task 4 brief; no case below is skipped
// in this file - every one of the four brief cases above proved assertable honestly with a
// detached container / fake wavesurfer, so there is nothing to `test.skip` here). Kept as a
// comment (not a skipped test) since it explains a design choice already reflected above, not an
// unimplemented case:
// - jsdom's `document` retains every node ever appended to it (including document.body) for the
//   life of the test file's realm - a container appended to document.body would make the
//   WaveSurfer wrapper/canvas subtree unreachable-but-not-actually-collectible via that path.
//   Every case above uses a container that is created but never appended anywhere.
// - jest-environment-jsdom tears down its whole global/document per TEST FILE, not per test -
//   irrelevant here since every case already drops its own references before the GC loop
//   rather than relying on file-level teardown.
