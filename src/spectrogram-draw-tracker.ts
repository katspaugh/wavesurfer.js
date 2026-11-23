/**
 * Draw/generation state machine behind SpectrogramPlugin.setOptions(): tracks analysis
 * generations, state versions, draw completion/failure, supersession aborts, and post-draw
 * redraw triggers when options change while a render is in flight.
 *
 * Split out of spectrogram-setup.ts. It owns no timers or plugin lifecycle of its own: the caller
 * supplies predicates and callbacks for disposal, pending renders, retained data, error emission,
 * and redraw scheduling, and remains responsible for calling dispose() during teardown.
 */

/** A pending setOptions() call, settled by the first draw that read its state */
export type SettingsRequest = {
  version: number
  // The analysis generation it waits for (rejected when a newer one starts), or null when any
  // later draw settles it
  generation: number | null
  resolve: () => void
  reject: (error: unknown) => void
}

export type SpectrogramDrawTrackerDeps = {
  /** Whether the owning plugin has been destroyed. */
  isDisposed: () => boolean
  /** Whether a render or settings redraw is currently running or scheduled. */
  isRenderPending: () => boolean
  /** Whether retained data (frequenciesDataUrl or cachedFrequencies) exists to redraw from. */
  hasRetainedData: () => boolean
  /** Emits a normalized Error on the plugin's 'error' event. */
  onError: (error: Error) => void
  /** Schedules a redraw when display state changed while a draw was in flight. */
  onRedraw: () => void
}

export type SpectrogramDrawTracker = {
  /** Bumped by every analysis change: an older generation's result is never cached or drawn. */
  readonly generation: number
  /** Bumped by every display, analysis, or retry change. */
  readonly stateVersion: number
  /** State version captured at the start of the most recent drawSpectrogram() call, or -1. */
  readonly drawVersion: number
  /** Pending setOptions() requests awaiting settlement. */
  readonly pending: readonly SettingsRequest[]
  isAnalysisFailed: () => boolean
  bumpState: () => void
  startAnalysis: () => DOMException
  waitForDraw: (generation: number | null) => Promise<void>
  trackOptionsCall: (options: { hasAnalysisKeys: boolean; displayChanged: boolean }) => Promise<void>
  beginDraw: () => number
  markDrawVersion: () => void
  completeDraw: (version: number, generation: number) => void
  recordFailure: (generation: number, error: unknown) => Error
  failDraw: (generation: number, error: unknown) => number
  redrawIfChanged: (version: number) => void
  resolveDisplayRequests: () => void
  dispose: () => void
}

export function abortError(message: string): DOMException {
  return new DOMException(message, 'AbortError')
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function rejected(error: unknown): Promise<void> {
  const promise = Promise.reject(error)
  // As in load(): fire-and-forget callers get no unhandled rejection, awaiting callers still do
  promise.catch(() => undefined)
  return promise
}

export function createSpectrogramDrawTracker(deps: SpectrogramDrawTrackerDeps): SpectrogramDrawTracker {
  // Bumped by every analysis change: an older generation's result is never cached or drawn
  let analysisGeneration = 0
  // Bumped by every display or analysis change. A draw records the value it read, and settles the
  // requests registered up to it
  let stateVersion = 0
  let drawVersion = -1
  // The state and generation of the last completed draw
  let appliedVersion = -1
  let appliedGeneration = -1
  let analysisFailure: { generation: number; error: Error } | null = null
  let requests: SettingsRequest[] = []

  function waitForDraw(generation: number | null): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      requests.push({ version: stateVersion, generation, resolve, reject })
    })
    // As in load(): fire-and-forget callers get no unhandled rejection, awaiting callers still do
    promise.catch(() => undefined)
    return promise
  }

  /** Resolves (or rejects with `error`) the waiting requests registered up to `version`. */
  function settleRequests(
    version: number,
    error: Error | null,
    filter: (request: SettingsRequest) => boolean = () => true,
  ): void {
    if (requests.length === 0) return
    const settled = requests.filter((request) => request.version <= version && filter(request))
    requests = requests.filter((request) => !settled.includes(request))
    for (const request of settled) {
      if (error) request.reject(error)
      else request.resolve()
    }
  }

  function isAnalysisFailed(): boolean {
    return analysisFailure !== null && analysisFailure.generation === analysisGeneration
  }

  function bumpState(): void {
    stateVersion++
  }

  function startAnalysis(): DOMException {
    analysisGeneration++
    const superseded = abortError('The analysis was superseded by a newer setOptions call')
    settleRequests(
      stateVersion,
      superseded,
      (request) => request.generation !== null && request.generation < analysisGeneration,
    )
    return superseded
  }

  function trackOptionsCall(options: { hasAnalysisKeys: boolean; displayChanged: boolean }): Promise<void> {
    const { hasAnalysisKeys, displayChanged } = options
    const failed = isAnalysisFailed()
    const analysisPending = appliedGeneration !== analysisGeneration && !failed
    const idle = !deps.isRenderPending() && !analysisPending
    // Failed and idle: a call that changes nothing has no draw to wait for. A display change
    // still redraws below when a failed draw left its data in place
    if (failed && idle && !displayChanged) return Promise.resolve()
    // Nothing changed and the current options are drawn, even if another redraw is scheduled
    if (!displayChanged && !failed && !analysisPending && appliedVersion === stateVersion) return Promise.resolve()
    if (idle && displayChanged && !deps.hasRetainedData()) {
      appliedVersion = stateVersion
      return Promise.resolve()
    }
    // An unchanged call joins the pending analysis and shares its outcome, including supersession;
    // a display change is carried forward to the analysis that is drawn next
    const joinsAnalysis = analysisPending && (hasAnalysisKeys || !displayChanged)
    const promise = waitForDraw(joinsAnalysis ? analysisGeneration : null)
    if (idle && displayChanged) deps.onRedraw()
    return promise
  }

  function beginDraw(): number {
    analysisFailure = null
    return analysisGeneration
  }

  function markDrawVersion(): void {
    drawVersion = stateVersion
  }

  // A draw of `generation` that read state `version` finished: settle what it showed, or reject it
  // with the failure its computation has already reported
  function completeDraw(version: number, generation: number): void {
    if (analysisFailure?.generation === generation) {
      settleRequests(version, analysisFailure.error)
      return
    }
    appliedVersion = version
    appliedGeneration = generation
    settleRequests(version, null)
  }

  function recordFailure(generation: number, error: unknown): Error {
    const normalized = toError(error)
    analysisFailure = { generation, error: normalized }
    deps.onError(normalized)
    return normalized
  }

  // A thrown render: emit it once, then reject what was waiting for it. Returns the state version
  // the failure covers, or -1 when a newer analysis (whose requests were aborted) replaced it.
  function failDraw(generation: number, error: unknown): number {
    if (deps.isDisposed() || generation !== analysisGeneration) return -1
    const version = stateVersion
    const normalized = recordFailure(generation, error)
    // A listener may have started a newer analysis, which carries the display requests forward
    if (generation === analysisGeneration) settleRequests(version, normalized)
    return version
  }

  // A change made while a draw ran (from a 'ready' or 'error' listener) gets a draw of its own
  function redrawIfChanged(version: number): void {
    if (version < 0 || version === stateVersion || deps.isRenderPending() || deps.isDisposed()) return
    // After a failed analysis nothing is retained to redraw; a failed draw keeps its data
    if (isAnalysisFailed() && !deps.hasRetainedData()) {
      settleRequests(stateVersion, null, (request) => request.generation === null)
    } else {
      deps.onRedraw()
    }
  }

  function resolveDisplayRequests(): void {
    // Nothing is retained to redraw (clearCache()): display requests resolve, and their values
    // apply to the next draw
    appliedVersion = stateVersion
    settleRequests(stateVersion, null, (request) => request.generation === null)
  }

  function dispose(): void {
    settleRequests(Infinity, abortError('The spectrogram plugin was destroyed'))
  }

  return {
    get generation() {
      return analysisGeneration
    },
    get stateVersion() {
      return stateVersion
    },
    get drawVersion() {
      return drawVersion
    },
    get pending() {
      return requests
    },
    isAnalysisFailed,
    bumpState,
    startAnalysis,
    waitForDraw,
    trackOptionsCall,
    beginDraw,
    markDrawVersion,
    completeDraw,
    recordFailure,
    failDraw,
    redrawIfChanged,
    resolveDisplayRequests,
    dispose,
  }
}
