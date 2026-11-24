import {
  abortError,
  createSpectrogramDrawTracker,
  rejected,
  toError,
  type SpectrogramDrawTrackerDeps,
} from '../spectrogram-draw-tracker.js'

type Settled = { state: 'pending' | 'resolved' | 'rejected'; error?: unknown }

function track(promise: Promise<void>): Settled {
  const settled: Settled = { state: 'pending' }
  promise.then(
    () => {
      settled.state = 'resolved'
    },
    (error) => {
      settled.state = 'rejected'
      settled.error = error
    },
  )
  return settled
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function createTracker(overrides: Partial<SpectrogramDrawTrackerDeps> = {}) {
  let disposed = false
  let renderPending = false
  let retainedData = true
  const onError = jest.fn()
  const onRedraw = jest.fn()
  const tracker = createSpectrogramDrawTracker({
    isDisposed: () => disposed,
    isRenderPending: () => renderPending,
    hasRetainedData: () => retainedData,
    onError,
    onRedraw,
    ...overrides,
  })
  return {
    tracker,
    onError,
    onRedraw,
    setDisposed: (value: boolean) => {
      disposed = value
    },
    setRenderPending: (value: boolean) => {
      renderPending = value
    },
    setRetainedData: (value: boolean) => {
      retainedData = value
    },
  }
}

describe('spectrogram-draw-tracker helpers', () => {
  it('creates an AbortError DOMException', () => {
    const err = abortError('stopped')
    expect(err).toBeInstanceOf(DOMException)
    expect(err.name).toBe('AbortError')
    expect(err.message).toBe('stopped')
  })

  it('normalizes unknown errors to Error instances', () => {
    const existing = new TypeError('bad')
    expect(toError(existing)).toBe(existing)
    expect(toError('boom')).toEqual(new Error('boom'))
  })

  it('returns a rejected promise that settles for awaiters without unhandled rejection', async () => {
    const err = new Error('fail')
    await expect(rejected(err)).rejects.toBe(err)
  })
})

describe('createSpectrogramDrawTracker', () => {
  it('starts at generation 0, stateVersion 0, drawVersion -1, with no pending requests', () => {
    const { tracker } = createTracker()
    expect(tracker.generation).toBe(0)
    expect(tracker.stateVersion).toBe(0)
    expect(tracker.drawVersion).toBe(-1)
    expect(tracker.pending).toHaveLength(0)
    expect(tracker.isAnalysisFailed()).toBe(false)
  })

  it('settles requests registered up to the completed draw version while keeping newer ones pending', async () => {
    const { tracker } = createTracker()
    tracker.bumpState()
    const first = track(tracker.waitForDraw(tracker.generation))
    tracker.markDrawVersion()
    expect(tracker.drawVersion).toBe(1)

    tracker.bumpState()
    const second = track(tracker.waitForDraw(tracker.generation))

    tracker.completeDraw(1, 0)
    await flushMicrotasks()
    expect(first.state).toBe('resolved')
    expect(second.state).toBe('pending')

    tracker.completeDraw(2, 0)
    await flushMicrotasks()
    expect(second.state).toBe('resolved')
  })

  it('rejects requests on completeDraw when recordFailure recorded an error for that generation', async () => {
    const { tracker, onError } = createTracker()
    const gen = tracker.beginDraw()
    tracker.bumpState()
    const req = track(tracker.waitForDraw(gen))
    tracker.markDrawVersion()

    const err = tracker.recordFailure(gen, 'worker crashed')
    expect(err).toEqual(new Error('worker crashed'))
    expect(onError).toHaveBeenCalledWith(err)
    expect(tracker.isAnalysisFailed()).toBe(true)

    tracker.completeDraw(tracker.drawVersion, gen)
    await flushMicrotasks()
    expect(req.state).toBe('rejected')
    expect(req.error).toBe(err)

    // Starting a new draw clears analysisFailure
    expect(tracker.beginDraw()).toBe(gen)
    expect(tracker.isAnalysisFailed()).toBe(false)
  })

  it('startAnalysis aborts older generation-bound requests and keeps display-only requests pending', async () => {
    const { tracker } = createTracker()
    tracker.bumpState()
    const analysisReq = track(tracker.waitForDraw(tracker.generation))
    const displayReq = track(tracker.waitForDraw(null))

    const aborted = tracker.startAnalysis()
    expect(aborted.name).toBe('AbortError')
    expect(tracker.generation).toBe(1)

    await flushMicrotasks()
    expect(analysisReq.state).toBe('rejected')
    expect(analysisReq.error).toBe(aborted)
    expect(displayReq.state).toBe('pending')

    tracker.completeDraw(tracker.stateVersion, tracker.generation)
    await flushMicrotasks()
    expect(displayReq.state).toBe('resolved')
  })

  describe('trackOptionsCall', () => {
    it('resolves immediately when nothing changed and current state is already applied', async () => {
      const { tracker, onRedraw } = createTracker()
      const gen = tracker.beginDraw()
      tracker.markDrawVersion()
      tracker.completeDraw(tracker.drawVersion, gen)

      await expect(tracker.trackOptionsCall({ hasAnalysisKeys: false, displayChanged: false })).resolves.toBeUndefined()
      expect(tracker.pending).toHaveLength(0)
      expect(onRedraw).not.toHaveBeenCalled()
    })

    it('resolves immediately when failed and idle without display changes', async () => {
      const { tracker, onRedraw } = createTracker()
      const gen = tracker.beginDraw()
      tracker.recordFailure(gen, new Error('boom'))

      await expect(tracker.trackOptionsCall({ hasAnalysisKeys: true, displayChanged: false })).resolves.toBeUndefined()
      expect(tracker.pending).toHaveLength(0)
      expect(onRedraw).not.toHaveBeenCalled()
    })

    it('resolves display-only changes immediately when idle with no retained data', async () => {
      const { tracker, onRedraw, setRetainedData } = createTracker()
      const gen = tracker.beginDraw()
      tracker.markDrawVersion()
      tracker.completeDraw(tracker.drawVersion, gen)

      setRetainedData(false)
      tracker.bumpState()
      await expect(tracker.trackOptionsCall({ hasAnalysisKeys: false, displayChanged: true })).resolves.toBeUndefined()
      expect(onRedraw).not.toHaveBeenCalled()
      // Subsequent no-op call also sees appliedVersion === stateVersion
      await expect(tracker.trackOptionsCall({ hasAnalysisKeys: false, displayChanged: false })).resolves.toBeUndefined()
    })

    it('triggers a redraw and waits when idle with retained data and a display change', async () => {
      const { tracker, onRedraw } = createTracker()
      const gen = tracker.beginDraw()
      tracker.markDrawVersion()
      tracker.completeDraw(tracker.drawVersion, gen)

      tracker.bumpState()
      const req = track(tracker.trackOptionsCall({ hasAnalysisKeys: false, displayChanged: true }))
      expect(onRedraw).toHaveBeenCalledTimes(1)
      expect(req.state).toBe('pending')

      tracker.markDrawVersion()
      tracker.completeDraw(tracker.drawVersion, gen)
      await flushMicrotasks()
      expect(req.state).toBe('resolved')
    })

    it('joins the pending analysis generation only when analysis keys are passed or display is unchanged', async () => {
      const { tracker } = createTracker()
      tracker.bumpState()
      const joined = track(tracker.trackOptionsCall({ hasAnalysisKeys: true, displayChanged: true }))
      const displayCarried = track(tracker.trackOptionsCall({ hasAnalysisKeys: false, displayChanged: true }))

      const aborted = tracker.startAnalysis()
      await flushMicrotasks()
      expect(joined.state).toBe('rejected')
      expect(joined.error).toBe(aborted)
      expect(displayCarried.state).toBe('pending')
    })
  })

  describe('failDraw', () => {
    it('returns -1 without emitting when disposed or stale generation', () => {
      const { tracker, onError, setDisposed } = createTracker()
      tracker.startAnalysis()
      expect(tracker.failDraw(0, new Error('stale'))).toBe(-1)
      expect(onError).not.toHaveBeenCalled()

      setDisposed(true)
      expect(tracker.failDraw(1, new Error('disposed'))).toBe(-1)
      expect(onError).not.toHaveBeenCalled()
    })

    it('emits error and rejects current-generation requests', async () => {
      const { tracker, onError } = createTracker()
      tracker.bumpState()
      const req = track(tracker.waitForDraw(tracker.generation))

      const version = tracker.failDraw(tracker.generation, 'render error')
      expect(version).toBe(1)
      expect(onError).toHaveBeenCalledWith(new Error('render error'))

      await flushMicrotasks()
      expect(req.state).toBe('rejected')
      expect(req.error).toEqual(new Error('render error'))
    })

    it('preserves display requests if an error listener starts a newer analysis', async () => {
      const { tracker } = createTracker({
        onError: () => {
          tracker.startAnalysis()
        },
      })
      tracker.bumpState()
      const displayReq = track(tracker.waitForDraw(null))

      const version = tracker.failDraw(tracker.generation, new Error('first failed'))
      expect(version).toBe(1)

      await flushMicrotasks()
      expect(displayReq.state).toBe('pending')
    })
  })

  describe('redrawIfChanged', () => {
    it('ignores negative, unchanged, pending-render, or disposed states', () => {
      const { tracker, onRedraw, setRenderPending, setDisposed } = createTracker()
      tracker.redrawIfChanged(-1)
      tracker.redrawIfChanged(tracker.stateVersion)

      tracker.bumpState()
      setRenderPending(true)
      tracker.redrawIfChanged(0)

      setRenderPending(false)
      setDisposed(true)
      tracker.redrawIfChanged(0)
      expect(onRedraw).not.toHaveBeenCalled()
    })

    it('schedules a redraw when state changed during a draw with retained data', () => {
      const { tracker, onRedraw } = createTracker()
      tracker.bumpState()
      tracker.redrawIfChanged(0)
      expect(onRedraw).toHaveBeenCalledTimes(1)
    })

    it('resolves display requests instead of redrawing after a failed analysis without retained data', async () => {
      const { tracker, onRedraw, setRetainedData } = createTracker()
      const gen = tracker.beginDraw()
      tracker.recordFailure(gen, new Error('fft failed'))
      setRetainedData(false)
      tracker.bumpState()
      const displayReq = track(tracker.waitForDraw(null))

      tracker.redrawIfChanged(0)
      await flushMicrotasks()
      expect(onRedraw).not.toHaveBeenCalled()
      expect(displayReq.state).toBe('resolved')
    })
  })

  it('resolveDisplayRequests resolves only generation-null requests and dispose rejects all remaining', async () => {
    const { tracker } = createTracker()
    tracker.bumpState()
    const displayReq = track(tracker.waitForDraw(null))
    const analysisReq = track(tracker.waitForDraw(tracker.generation))

    tracker.resolveDisplayRequests()
    await flushMicrotasks()
    expect(displayReq.state).toBe('resolved')
    expect(analysisReq.state).toBe('pending')

    tracker.dispose()
    await flushMicrotasks()
    expect(analysisReq.state).toBe('rejected')
    expect((analysisReq.error as DOMException).name).toBe('AbortError')

    // Calling dispose again when empty is a safe no-op
    tracker.dispose()
    expect(tracker.pending).toHaveLength(0)
  })
})
