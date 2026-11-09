/**
 * The spectrogram plugin's side of the FFT web worker protocol: creating the worker, posting
 * 'calculateFrequencies' requests and matching each 'frequenciesResult' reply to its pending
 * promise by id, timing requests out, and tearing the worker down.
 *
 * Split out of spectrogram-setup.ts. It owns no lifecycle of its own: the caller injects the
 * worker constructor (see the WorkerCtor note in spectrogram-setup.ts), the request timeout and a
 * timer factory (the plugin's ctx.scope.timeout, so a pending timeout is cancelled when the plugin
 * is destroyed), and remains responsible for calling dispose() from its own teardown.
 */

export type WorkerRequest = {
  resolve: (value: Uint8Array[][]) => void
  reject: (reason: unknown) => void
  // Cancel function from deps.setTimer (ctx.scope.timeout), not a raw timer id -- see post().
  timer?: () => void
}

type WorkerFrequenciesMessage = { type: string; id: string; result?: Uint8Array[][]; error?: string }

export type SpectrogramWorkerClientDeps = {
  /** The injected worker constructor; when absent, initialize() only warns. */
  WorkerCtor: (new () => Worker) | undefined
  /** The current request timeout in milliseconds, read on every post(); 0 disables it. */
  getTimeout: () => number
  /** Schedules a callback and returns its cancel function (the plugin's ctx.scope.timeout). */
  setTimer: (callback: () => void, ms: number) => () => void
}

export type SpectrogramWorkerClient = {
  /** The live worker, or null before initialize(), after dispose(), or when construction failed. */
  readonly worker: Worker | null
  /** Latched when the worker constructor threw: such failures are permanent for the environment. */
  readonly constructionFailed: boolean
  /** In-flight requests by id. */
  readonly pending: Map<string, WorkerRequest>
  initialize: () => void
  post: (audioData: Float32Array[], workerOptions: Record<string, unknown>) => Promise<Uint8Array[][]>
  dispose: (error: Error) => void
}

export function createSpectrogramWorkerClient(deps: SpectrogramWorkerClientDeps): SpectrogramWorkerClient {
  const { WorkerCtor, getTimeout, setTimer } = deps

  let worker: Worker | null = null
  let workerConstructionFailed = false
  const workerPromises = new Map<string, WorkerRequest>()

  // Terminate the worker and reject in-flight requests so callers fall back to the main thread
  // immediately instead of waiting out the worker timeout (or hanging when it is disabled)
  function disposeWorker(error: Error): void {
    if (worker) {
      worker.terminate()
      worker = null
    }
    workerPromises.forEach((promise) => {
      promise.timer?.()
      promise.reject(error)
    })
    workerPromises.clear()
  }

  function initializeWorker(): void {
    // Skip worker initialization in SSR environments (Next.js server-side), or if the host
    // entry point didn't provide a worker constructor at all.
    if (typeof window === 'undefined' || typeof Worker === 'undefined' || !WorkerCtor) {
      console.warn('Worker not available in this environment, using main thread calculation')
      return
    }

    try {
      // Create worker using the injected worker constructor
      worker = new WorkerCtor()

      worker.onmessage = (e: MessageEvent<WorkerFrequenciesMessage>) => {
        const { type, id, result, error } = e.data

        if (type === 'frequenciesResult') {
          const promise = workerPromises.get(id)
          if (promise) {
            workerPromises.delete(id)
            promise.timer?.()
            if (error) {
              promise.reject(new Error(error))
            } else {
              // The worker protocol guarantees exactly one of result/error is set
              promise.resolve(result as Uint8Array[][])
            }
          }
        }
      }

      worker.onerror = (error: ErrorEvent) => {
        console.warn('Spectrogram worker error, falling back to main thread:', error)
        disposeWorker(new Error('Worker error'))
      }

      worker.onmessageerror = (event: MessageEvent) => {
        console.warn('Spectrogram worker message error, falling back to main thread:', event)
        disposeWorker(new Error('Worker message error'))
      }
    } catch (error) {
      console.warn('Failed to initialize worker, falling back to main thread:', error)
      worker = null
      // Construction failure (e.g. CSP worker-src denial) is permanent for this environment:
      // latch it so computations don't retry it, unlike runtime failures of a live worker
      workerConstructionFailed = true
    }
  }

  // Shared low-level worker RPC: both the full-buffer path (calculateFrequenciesWithWorker)
  // and the windowed per-segment path (calculateFrequenciesWithWorkerRange) in
  // spectrogram-setup.ts post a 'calculateFrequencies' message and race it against workerTimeout
  // (now configurable in BOTH rendering modes - Phase-1 windowed had this hard-coded at 30000ms,
  // a divergence this unification removes).
  function postWorkerRequest(
    audioData: Float32Array[],
    workerOptions: Record<string, unknown>,
  ): Promise<Uint8Array[][]> {
    if (!worker) {
      throw new Error('Worker not available')
    }
    // Narrow to a local const: TS can't prove `worker` stays non-null inside the Promise
    // executor below (it's a mutable closure variable), and this avoids a non-null assertion.
    const activeWorker = worker

    // Generate unique ID for this request
    const id = `${Date.now()}_${Math.random()}`

    // Create promise for worker response
    return new Promise<Uint8Array[][]>((resolve, reject) => {
      // Set timeout to avoid hanging; a timeout of 0 disables it. Uses deps.setTimer (the
      // plugin's ctx.scope.timeout, not a raw setTimeout) so a plugin destroy() while this is in
      // flight cancels it too, via the caller registering dispose() on ctx.scope's teardown.
      const workerTimeout = getTimeout()
      const timer =
        workerTimeout > 0
          ? setTimer(() => {
              if (workerPromises.has(id)) {
                // A timed-out result can never be consumed (its id is dropped), so dispose
                // the worker too: this stops the abandoned computation and lets the next
                // render start a fresh worker instead of queueing behind a stuck one
                disposeWorker(new Error('Worker timeout'))
              }
            }, workerTimeout)
          : undefined
      workerPromises.set(id, { resolve, reject, timer })

      // Send message to worker; if dispatch fails synchronously, settle and clean up immediately
      try {
        activeWorker.postMessage({
          type: 'calculateFrequencies',
          id,
          audioData,
          options: workerOptions,
        })
      } catch (error) {
        timer?.()
        workerPromises.delete(id)
        reject(error)
      }
    })
  }

  return {
    get worker() {
      return worker
    },
    get constructionFailed() {
      return workerConstructionFailed
    },
    pending: workerPromises,
    initialize: initializeWorker,
    post: postWorkerRequest,
    dispose: disposeWorker,
  }
}
