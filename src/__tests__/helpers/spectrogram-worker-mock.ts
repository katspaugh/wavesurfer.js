/**
 * Stand-in for rollup-plugin-web-worker-loader's `import SpectrogramWorker from
 * 'web-worker:./spectrogram-worker.ts'` virtual-module scheme (see src/web-worker-loader.d.ts),
 * which only resolves under rollup -- under ts-jest nothing exists on disk at that specifier.
 * jest.config.js's `moduleNameMapper` redirects the exact `web-worker:./spectrogram-worker.ts`
 * specifier here (for every project, including the `leaks` one), so every spectrogram suite that
 * imports plugins/spectrogram.ts or plugins/spectrogram-windowed.ts (both of which import the
 * worker eagerly) gets this instead of a real Worker, without each suite re-declaring its own
 * `jest.mock('web-worker:./spectrogram-worker.ts', ..., { virtual: true })`.
 *
 * Jest gives every test FILE its own fresh module registry (unless a suite calls
 * `jest.resetModules()`, which none of these do), so `mockWorkerInstances`/`mockWorkerState`
 * below are effectively per-file, not shared across suites -- safe for the two suites
 * (spectrogram-rendering-mode.test.ts, spectrogram-worker-errors.test.ts) that import them
 * directly to observe/control worker construction (which instances were created, or force the
 * constructor to throw) and reset them in their own `beforeEach`.
 */
// Typed `any[]`, not `MockSpectrogramWorker[]`, to match how every suite that consumes this
// actually uses it: reading `.onerror`/`.onmessage`/`.onmessageerror` off an instance and
// invoking them directly (`worker.onerror(new Event('error'))`), which the real, nullable Worker
// event-handler types (`((e: Event) => void) | null`) would force a null-check onto at every call
// site for no benefit here -- these tests only ever read them after the plugin under test has
// already assigned them.
export const mockWorkerInstances: any[] = []
export const mockWorkerState = { constructorAttempts: 0, constructorShouldThrow: false }

export class MockSpectrogramWorker {
  onmessage: ((e: { data: any }) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onmessageerror: ((e: Event) => void) | null = null
  postMessage = jest.fn()
  terminate = jest.fn()

  constructor() {
    mockWorkerState.constructorAttempts++
    if (mockWorkerState.constructorShouldThrow) {
      throw new Error('worker construction blocked')
    }
    mockWorkerInstances.push(this)
  }
}

export default MockSpectrogramWorker
