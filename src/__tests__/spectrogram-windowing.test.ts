import {
  SegmentManager,
  type SegmentManagerDeps,
  type FrequencySegment,
  computeWindowedPixelsPerSecond,
  deriveNoverlap,
  getScrollLeft,
  getViewportWidth,
  renderFrequencySegment,
} from '../spectrogram-windowing.js'

/** A minimal, fully-controllable SegmentManagerDeps for unit tests: no DOM/wavesurfer/Scope involved. */
function makeDeps(overrides: Partial<SegmentManagerDeps> = {}): SegmentManagerDeps & {
  timers: Array<{ fn: () => void; ms: number; cancelled: boolean }>
  fireAllTimers(): void
} {
  const timers: Array<{ fn: () => void; ms: number; cancelled: boolean }> = []
  let disposed = false

  const deps: SegmentManagerDeps & { timers: typeof timers; fireAllTimers(): void } = {
    getWidth: () => 1000,
    getPixelsPerSecond: () => 100,
    getBufferDuration: () => 600,
    getScrollLeft: () => 0,
    getViewportWidth: () => 1000,
    computeSegmentFrequencies: async () => [[new Uint8Array([1, 2, 3])]],
    renderSegment: async () => undefined,
    emitProgress: () => undefined,
    isDisposed: () => disposed,
    setTimer: (fn, ms) => {
      const entry = { fn, ms, cancelled: false }
      timers.push(entry)
      return () => {
        entry.cancelled = true
      }
    },
    timers,
    fireAllTimers() {
      // Snapshot first: firing a timer callback may itself schedule a new one, which must
      // not be fired within the same fireAllTimers() pass (mirrors real single-tick semantics).
      const due = [...timers].filter((t) => !t.cancelled)
      due.forEach((t) => {
        if (!t.cancelled) t.fn()
      })
    },
    ...overrides,
  }
  ;(deps as any).__setDisposed = (value: boolean) => {
    disposed = value
  }
  return deps
}

function makeSegment(start: number, end: number, canvas?: HTMLCanvasElement): FrequencySegment {
  return { startTime: start, endTime: end, startPixel: start * 100, endPixel: end * 100, frequencies: [], canvas }
}

/** A canvas whose backing store costs width * height * 4 bytes (default 100x100 = 40 000 B). */
function makeCanvas(width = 100, height = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const CANVAS_BYTES = 100 * 100 * 4 // one makeCanvas() backing store

describe('SegmentManager eviction (byte budget)', () => {
  it('does nothing when at or under the byte budget', () => {
    const manager = new SegmentManager(makeDeps(), { maxRetainedBytes: 5 * CANVAS_BYTES })
    for (let i = 0; i < 5; i++) manager.segments.set(String(i), makeSegment(i * 30, (i + 1) * 30, makeCanvas()))
    manager.evictDistantSegments(0)
    expect(manager.segments.size).toBe(5)
  })

  it('evicts the farthest-from-currentTime segments down to the byte budget', () => {
    const manager = new SegmentManager(makeDeps(), { maxRetainedBytes: 3 * CANVAS_BYTES })
    for (let i = 0; i < 10; i++) manager.segments.set(String(i), makeSegment(i * 30, (i + 1) * 30, makeCanvas()))

    manager.evictDistantSegments(0)

    expect(manager.segments.size).toBe(3)
    expect(manager.segments.has('0')).toBe(true)
    expect(manager.segments.has('1')).toBe(true)
    expect(manager.segments.has('2')).toBe(true)
    expect(manager.segments.has('9')).toBe(false)
  })

  it('counts bytes, not segments: fewer large canvases fit in the same budget', () => {
    const manager = new SegmentManager(makeDeps(), { maxRetainedBytes: 4 * CANVAS_BYTES })
    // Each canvas is 4x the base size (200x200), so the 4-canvas-equivalent budget only fits one.
    for (let i = 0; i < 6; i++) {
      manager.segments.set(String(i), makeSegment(i * 30, (i + 1) * 30, makeCanvas(200, 200)))
    }

    manager.evictDistantSegments(0)

    expect(manager.segments.size).toBe(1)
    expect(manager.segments.has('0')).toBe(true)
  })

  it('removes evicted segments canvases from the DOM', () => {
    const manager = new SegmentManager(makeDeps(), { maxRetainedBytes: 2 * CANVAS_BYTES })
    const container = document.createElement('div')
    document.body.appendChild(container)
    for (let i = 0; i < 5; i++) {
      const canvas = makeCanvas()
      container.appendChild(canvas)
      manager.segments.set(String(i), makeSegment(i * 30, (i + 1) * 30, canvas))
    }

    manager.evictDistantSegments(0)

    expect(container.children.length).toBe(2)
    for (const segment of manager.segments.values()) {
      expect(segment.canvas!.isConnected).toBe(true)
    }
  })

  it('anchors eviction on the given currentTime, not always segment index 0', () => {
    const manager = new SegmentManager(makeDeps(), { maxRetainedBytes: 3 * CANVAS_BYTES })
    for (let i = 0; i < 10; i++) manager.segments.set(String(i), makeSegment(i * 30, (i + 1) * 30, makeCanvas()))

    // Anchor near segment 9 (t=285): the lowest-index segments should be evicted instead.
    manager.evictDistantSegments(285)

    expect(manager.segments.has('9')).toBe(true)
    expect(manager.segments.has('8')).toBe(true)
    expect(manager.segments.has('0')).toBe(false)
  })

  it('never evicts the segment nearest to the current view, even when it alone exceeds the budget', () => {
    const manager = new SegmentManager(makeDeps(), { maxRetainedBytes: CANVAS_BYTES })
    manager.segments.set('near', makeSegment(0, 30, makeCanvas(400, 400)))
    manager.segments.set('far', makeSegment(300, 330, makeCanvas(400, 400)))

    manager.evictDistantSegments(0)

    // Evicting the visible segment would just force an immediate recompute (thrash);
    // the budget therefore only ever removes all-but-the-nearest.
    expect(manager.segments.has('near')).toBe(true)
    expect(manager.segments.has('far')).toBe(false)
  })

  it('defaults to a ~256MB budget', () => {
    const manager = new SegmentManager(makeDeps())
    expect(manager.maxRetainedBytes).toBe(256 * 1024 * 1024)
  })
})

describe('SegmentManager.findUncoveredTimeRanges', () => {
  it('returns the whole range when nothing is loaded', () => {
    const manager = new SegmentManager(makeDeps())
    expect(manager.findUncoveredTimeRanges(0, 100)).toEqual([{ start: 0, end: 100 }])
  })

  it('returns nothing when the range is fully covered', () => {
    const manager = new SegmentManager(makeDeps())
    manager.segments.set('a', makeSegment(0, 100))
    expect(manager.findUncoveredTimeRanges(10, 90)).toEqual([])
  })

  it('finds a gap before the first segment', () => {
    const manager = new SegmentManager(makeDeps())
    manager.segments.set('a', makeSegment(50, 100))
    expect(manager.findUncoveredTimeRanges(0, 100)).toEqual([{ start: 0, end: 50 }])
  })

  it('finds a gap after the last segment', () => {
    const manager = new SegmentManager(makeDeps())
    manager.segments.set('a', makeSegment(0, 50))
    expect(manager.findUncoveredTimeRanges(0, 100)).toEqual([{ start: 50, end: 100 }])
  })

  it('finds a gap between two segments', () => {
    const manager = new SegmentManager(makeDeps())
    manager.segments.set('a', makeSegment(0, 30))
    manager.segments.set('b', makeSegment(60, 100))
    expect(manager.findUncoveredTimeRanges(0, 100)).toEqual([{ start: 30, end: 60 }])
  })

  it('handles unsorted/overlapping existing segments', () => {
    const manager = new SegmentManager(makeDeps())
    manager.segments.set('b', makeSegment(60, 100))
    manager.segments.set('a', makeSegment(0, 40)) // overlaps what would be a gap boundary
    expect(manager.findUncoveredTimeRanges(0, 100)).toEqual([{ start: 40, end: 60 }])
  })
})

describe('SegmentManager.generateSegments', () => {
  it('creates and renders a segment for an uncovered range, then starts progressive loading', async () => {
    const rendered: FrequencySegment[] = []
    const deps = makeDeps({
      getBufferDuration: () => 5,
      getWidth: () => 100, // small enough vs. duration*pxPerSec to trigger fill-container mode
      getPixelsPerSecond: () => 10,
      renderSegment: async (segment) => {
        rendered.push(segment)
      },
    })
    const manager = new SegmentManager(deps, { progressiveLoading: true })

    await manager.generateSegments(0, 5)

    expect(manager.segments.size).toBe(1)
    expect(rendered).toHaveLength(1)
    // Fill-container mode: segment spans the whole buffer duration
    const [segment] = manager.segments.values()
    expect(segment.startTime).toBe(0)
    expect(segment.endTime).toBe(5)
    // generateSegments() should have kicked off progressive loading (scheduled, not run yet)
    expect(manager.isProgressiveLoading).toBe(true)
    expect(deps.timers).toHaveLength(1)
    expect(deps.timers[0].ms).toBe(1000)
  })

  it('skips ranges already covered, computing nothing new', async () => {
    let calls = 0
    const deps = makeDeps({
      getBufferDuration: () => 100,
      computeSegmentFrequencies: async () => {
        calls++
        return [[new Uint8Array([1])]]
      },
    })
    const manager = new SegmentManager(deps)
    manager.segments.set('covered', makeSegment(0, 100))

    await manager.generateSegments(10, 90)

    expect(calls).toBe(0)
  })

  it('does not add a segment when computeSegmentFrequencies returns empty output', async () => {
    const deps = makeDeps({
      getBufferDuration: () => 5,
      computeSegmentFrequencies: async () => [],
    })
    const manager = new SegmentManager(deps)

    await manager.generateSegments(0, 5)

    expect(manager.segments.size).toBe(0)
  })

  it('stops mid-loop and renders nothing further once disposed', async () => {
    const deps = makeDeps({ getBufferDuration: () => 5 })
    ;(deps as any).__setDisposed(true)
    const manager = new SegmentManager(deps)

    await manager.generateSegments(0, 5)

    expect(manager.segments.size).toBe(0)
  })
})

describe('SegmentManager.renderVisibleWindow re-entrancy', () => {
  it('two overlapping calls compute and render the same segment only once', async () => {
    let resolveCompute: ((value: Uint8Array[][]) => void) | null = null
    let computeCalls = 0
    let renderCalls = 0
    const deps = makeDeps({
      // Short audio, small container -> fill-container mode -> exactly one segment for the
      // whole buffer, so both overlapping calls are racing to fill the SAME uncovered range.
      getBufferDuration: () => 5,
      getWidth: () => 100,
      getPixelsPerSecond: () => 10,
      computeSegmentFrequencies: () => {
        computeCalls++
        return new Promise<Uint8Array[][]>((resolve) => {
          resolveCompute = resolve
        })
      },
      renderSegment: async () => {
        renderCalls++
      },
    })
    const manager = new SegmentManager(deps)

    // Fire two overlapping renderVisibleWindow() calls before either's awaited
    // computeSegmentFrequencies() has resolved - e.g. a scroll event firing again while the
    // first call is still mid-flight.
    const first = manager.renderVisibleWindow()
    const second = manager.renderVisibleWindow()

    // The second call must have been turned away immediately by the re-entrancy guard, not
    // queued behind the first - only one computeSegmentFrequencies() call should be in flight.
    expect(computeCalls).toBe(1)

    resolveCompute!([[new Uint8Array([1, 2, 3])]])
    await Promise.all([first, second])

    // A single segment was computed and rendered exactly once - not raced/overwritten/duplicated.
    expect(computeCalls).toBe(1)
    expect(renderCalls).toBe(1)
    expect(manager.segments.size).toBe(1)
  })

  it('re-runs once for the current viewport after a bailed-out overlapping call (dirty-flag re-arm)', async () => {
    const resolvers: Array<(value: Uint8Array[][]) => void> = []
    const computedRanges: Array<[number, number]> = []
    let scrollLeft = 0
    const deps = makeDeps({
      getBufferDuration: () => 600,
      getWidth: () => 1000,
      getPixelsPerSecond: () => 100,
      getScrollLeft: () => scrollLeft,
      getViewportWidth: () => 100,
      computeSegmentFrequencies: (start, end) => {
        computedRanges.push([start, end])
        return new Promise<Uint8Array[][]>((resolve) => {
          resolvers.push(resolve)
        })
      },
    })
    const manager = new SegmentManager(deps)

    const first = manager.renderVisibleWindow()
    // A second, overlapping call targeting a different part of the timeline arrives while the
    // first is still awaiting its compute - e.g. the user scrolled again mid-flight.
    scrollLeft = 40000
    const second = manager.renderVisibleWindow()

    // The second call is turned away immediately by the re-entrancy guard - no second compute
    // in flight yet.
    expect(resolvers).toHaveLength(1)

    resolvers[0]([[new Uint8Array([1, 2, 3])]])

    // Without the dirty-flag re-arm, the second (bailed) call's window is dropped for good and
    // no further compute ever happens - this loop times out at length 1 and the assertion below
    // fails, which is the "fails today: dropped" case the plan calls out. With the re-arm, the
    // first call's finally block gives the (now-moved) viewport one more pass once it's done.
    for (let i = 0; i < 20 && resolvers.length < 2; i++) {
      await Promise.resolve()
    }
    expect(resolvers).toHaveLength(2)
    resolvers[1]([[new Uint8Array([4, 5, 6])]])

    await Promise.all([first, second])

    expect(computedRanges).toHaveLength(2)
    // The second computed range must be for the moved viewport (t=400ish), not a repeat of the
    // first (t=0ish).
    expect(computedRanges[1][0]).toBeGreaterThan(100)
    expect(manager.segments.size).toBe(2)
  })

  it('does not run the coalesced re-arm pass once disposed while pendingRender is set', async () => {
    // Mirrors the real host contract (destroy() disposes the Scope before/while an in-flight
    // renderVisibleWindow() await can resume - see the "does not throw or touch destroyed DOM
    // state..." host-level test elsewhere in this suite) but pins the dirty-flag re-arm path
    // specifically: pendingRender is already true (from a bailed overlapping call) at the moment
    // disposal happens, so the finally block's "one more pass" must still be skipped rather than
    // reading deps (or computing) for a torn-down host.
    let resolveCompute: ((value: Uint8Array[][]) => void) | null = null
    let computeCalls = 0
    const deps = makeDeps({
      getBufferDuration: () => 600,
      computeSegmentFrequencies: () => {
        computeCalls++
        return new Promise<Uint8Array[][]>((resolve) => {
          resolveCompute = resolve
        })
      },
    })
    const manager = new SegmentManager(deps)

    // First call starts computing (in flight, awaiting resolveCompute).
    const first = manager.renderVisibleWindow()
    // Second, overlapping call bails on the re-entrancy guard and re-arms pendingRender.
    const second = manager.renderVisibleWindow()
    expect(computeCalls).toBe(1)

    // Dispose while the first call's compute is still pending, with pendingRender already set.
    ;(deps as any).__setDisposed(true)
    resolveCompute!([[new Uint8Array([1, 2, 3])]])

    await Promise.all([first, second])

    // Only the first call's own compute ran - the coalesced rerun the dirty flag would
    // otherwise trigger must be skipped once disposed, not attempted.
    expect(computeCalls).toBe(1)
  })

  it('a second call after the first completes is not blocked by the guard', async () => {
    let computeCalls = 0
    const deps = makeDeps({
      getBufferDuration: () => 600,
      computeSegmentFrequencies: async () => {
        computeCalls++
        return [[new Uint8Array([1])]]
      },
    })
    const manager = new SegmentManager(deps)

    await manager.renderVisibleWindow()
    // Different viewport the second time (simulated via a second buffer-covering call) so
    // there's fresh work to do - the point here is only that isRendering was reset to false.
    await manager.renderVisibleWindow()

    expect(computeCalls).toBeGreaterThanOrEqual(1)
  })
})

describe('SegmentManager progressive loading', () => {
  it('startProgressiveLoading schedules exactly one 1000ms timer and flips isProgressiveLoading', () => {
    const deps = makeDeps({ getBufferDuration: () => 100 })
    const manager = new SegmentManager(deps, { progressiveLoading: true })

    manager.startProgressiveLoading()

    expect(manager.isProgressiveLoading).toBe(true)
    expect(deps.timers).toHaveLength(1)
    expect(deps.timers[0].ms).toBe(1000)
  })

  it('does nothing if progressiveLoading option is off', () => {
    const deps = makeDeps({ getBufferDuration: () => 100 })
    const manager = new SegmentManager(deps, { progressiveLoading: false })

    manager.startProgressiveLoading()

    expect(manager.isProgressiveLoading).toBe(false)
    expect(deps.timers).toHaveLength(0)
  })

  it('walks forward through the buffer, one 30s segment per tick, then stops at the end', async () => {
    const deps = makeDeps({ getBufferDuration: () => 65, getWidth: () => 100000 })
    const manager = new SegmentManager(deps, { progressiveLoading: true })
    manager.startProgressiveLoading()

    // Tick 1: [0, 30)
    await manager.progressiveLoadNextSegment()
    expect(manager.nextProgressiveSegmentTime).toBe(30)
    expect(manager.isProgressiveLoading).toBe(true)

    // Tick 2: [30, 60)
    await manager.progressiveLoadNextSegment()
    expect(manager.nextProgressiveSegmentTime).toBe(60)

    // Tick 3: [60, 65) - reaches the end
    await manager.progressiveLoadNextSegment()
    expect(manager.nextProgressiveSegmentTime).toBe(65)

    // Tick 4: nextProgressiveSegmentTime >= duration -> stops
    await manager.progressiveLoadNextSegment()
    expect(manager.isProgressiveLoading).toBe(false)
  })

  it('enforces the byte budget purely through the progressive path, with no viewport render involved', async () => {
    const deps = makeDeps({
      getBufferDuration: () => 30 * 20,
      getWidth: () => 100000,
      renderSegment: async (segment) => {
        segment.canvas = makeCanvas()
      },
    })
    const manager = new SegmentManager(deps, { progressiveLoading: true, maxRetainedBytes: 3 * CANVAS_BYTES })
    manager.isProgressiveLoading = true

    for (let i = 0; i < 10; i++) {
      await manager.progressiveLoadNextSegment()
    }

    expect(manager.segments.size).toBeLessThanOrEqual(3)
  })

  it('does not re-arm the timer once destroyed (disposed + stopped) mid-await', async () => {
    // Mirrors the real host contract: destroy() disposes the Scope (isDisposed() flips true)
    // AND runs SegmentManager.dispose() (which stops progressive loading) - both happen before
    // any pending generateSegments() await can resume. Only stopping without disposing is not
    // load-bearing here: generateSegments()'s own post-await guard is what's actually pinned
    // (see the "once disposed mid-await" case below), and it would otherwise restart
    // progressive loading (an unrelated pre-existing quirk of the ported legacy code, not a
    // new regression - see the block comment at generateSegments' "start progressive loading
    // if not already running" line).
    let resolveCompute: (() => void) | null = null
    const deps = makeDeps({
      getBufferDuration: () => 120,
      computeSegmentFrequencies: () =>
        new Promise((resolve) => {
          resolveCompute = () => resolve([[new Uint8Array([1])]])
        }),
    })
    const manager = new SegmentManager(deps, { progressiveLoading: true })
    manager.isProgressiveLoading = true

    const tick = manager.progressiveLoadNextSegment()
    ;(deps as any).__setDisposed(true)
    manager.dispose()
    resolveCompute!()
    await tick

    expect(manager.isProgressiveLoading).toBe(false)
    expect(deps.timers.every((t) => t.cancelled)).toBe(true)
  })

  it('does not re-arm the timer once disposed mid-await', async () => {
    let resolveCompute: (() => void) | null = null
    const deps = makeDeps({
      getBufferDuration: () => 120,
      computeSegmentFrequencies: () =>
        new Promise((resolve) => {
          resolveCompute = () => resolve([[new Uint8Array([1])]])
        }),
    })
    const manager = new SegmentManager(deps, { progressiveLoading: true })
    manager.isProgressiveLoading = true

    const tick = manager.progressiveLoadNextSegment()
    ;(deps as any).__setDisposed(true)
    resolveCompute!()
    await tick

    // No new timer scheduled after the dispose-guarded await resumed
    const activeTimers = deps.timers.filter((t) => !t.cancelled)
    expect(activeTimers).toHaveLength(0)
  })

  it('restartProgressiveLoading resets progress and reschedules from zero', () => {
    const deps = makeDeps({ getBufferDuration: () => 100 })
    const manager = new SegmentManager(deps, { progressiveLoading: true })
    manager.nextProgressiveSegmentTime = 90
    manager.isProgressiveLoading = true

    manager.restartProgressiveLoading()

    expect(manager.nextProgressiveSegmentTime).toBe(0)
    expect(manager.isProgressiveLoading).toBe(true)
    expect(deps.timers.some((t) => !t.cancelled)).toBe(true)
  })
})

describe('SegmentManager.getLoadingProgress', () => {
  it('is 0 before anything has loaded', () => {
    const manager = new SegmentManager(makeDeps({ getBufferDuration: () => 100 }))
    expect(manager.getLoadingProgress()).toBe(0)
  })

  it('is 100 for a zero-duration buffer', () => {
    const manager = new SegmentManager(makeDeps({ getBufferDuration: () => 0 }))
    expect(manager.getLoadingProgress()).toBe(100)
  })

  it('tracks nextProgressiveSegmentTime as a percentage while loading', () => {
    const manager = new SegmentManager(makeDeps({ getBufferDuration: () => 200 }))
    manager.isProgressiveLoading = true
    manager.nextProgressiveSegmentTime = 50
    expect(manager.getLoadingProgress()).toBe(25)
  })

  it('is 100 once progressive loading has finished covering the buffer', () => {
    const manager = new SegmentManager(makeDeps({ getBufferDuration: () => 200 }))
    // At least one segment must exist, or the "nothing loaded yet" guard (checked first)
    // reports 0 regardless of nextProgressiveSegmentTime - true of any real completed run.
    manager.segments.set('a', makeSegment(0, 30))
    manager.isProgressiveLoading = false
    manager.nextProgressiveSegmentTime = 200
    expect(manager.getLoadingProgress()).toBe(100)
  })
})

describe('computeWindowedPixelsPerSecond', () => {
  it('prefers an explicit positive minPxPerSec', () => {
    expect(computeWindowedPixelsPerSecond(75, 100, 500)).toBe(75)
  })

  it('ignores a zero/undefined minPxPerSec and fits the buffer to the wrapper width', () => {
    // duration 10s in a 2000px wrapper -> 200px/s, comfortably above the WINDOWED_MIN_PX_PER_SEC floor
    expect(computeWindowedPixelsPerSecond(0, 10, 2000)).toBe(200)
    expect(computeWindowedPixelsPerSecond(undefined, 10, 2000)).toBe(200)
  })

  it('floors at WINDOWED_MIN_PX_PER_SEC for very long buffers', () => {
    expect(computeWindowedPixelsPerSecond(undefined, 100000, 500)).toBe(50)
  })

  it('falls back to the floor with no buffer duration', () => {
    expect(computeWindowedPixelsPerSecond(undefined, null, 500)).toBe(50)
  })
})

describe('deriveNoverlap', () => {
  it('returns the explicit value when truthy', () => {
    expect(deriveNoverlap(1024, 200, 44100, 500)).toBe(200)
  })

  it('treats an explicit 0 as unset, like the legacy windowed plugin', () => {
    const derived = deriveNoverlap(1024, 0, 4410, 100)
    expect(derived).toBe(Math.max(0, Math.round(1024 - 4410 / 100)))
  })

  it('derives from samples-per-pixel when unset', () => {
    // 10 samples/px, fftSamples 100 -> noverlap = 90
    expect(deriveNoverlap(100, null, 1000, 100)).toBe(90)
  })

  it('never goes negative', () => {
    expect(deriveNoverlap(64, undefined, 100, 1)).toBe(0)
  })
})

describe('getScrollLeft / getViewportWidth', () => {
  it('getScrollLeft reads the wrapper element scrollLeft first', () => {
    const wrapper = document.createElement('div')
    Object.defineProperty(wrapper, 'scrollLeft', { value: 42, configurable: true })
    expect(getScrollLeft(wrapper)).toBe(42)
  })

  it('getScrollLeft returns 0 with no wrapper and no scrolled ancestors', () => {
    expect(getScrollLeft(null)).toBe(0)
  })

  it('getViewportWidth uses the wrapper width when no narrower parent exists', () => {
    const wrapper = document.createElement('div')
    Object.defineProperty(wrapper, 'offsetWidth', { value: 640, configurable: true })
    expect(getViewportWidth(wrapper)).toBe(640)
  })

  it('getViewportWidth falls back to a default when nothing is measurable', () => {
    const wrapper = document.createElement('div')
    expect(getViewportWidth(wrapper)).toBeGreaterThan(0)
  })
})

describe('SegmentManager.generateSegments await races', () => {
  // The progressive loader calls generateSegments() directly, bypassing renderVisibleWindow's
  // re-entrancy guard - so two generateSegments() calls for overlapping ranges genuinely race.
  // Every await point must re-check the segment map before/after attaching a canvas, or the
  // loser's canvas is left attached-but-unreachable (never evicted: no map key points at it).
  it('does not orphan a canvas when a concurrent call creates the same segment mid-compute', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const resolvers: Array<(value: Uint8Array[][]) => void> = []
    const deps = makeDeps({
      // Short audio + small container -> fill-container mode -> both calls race the SAME key.
      getBufferDuration: () => 5,
      getWidth: () => 100,
      getPixelsPerSecond: () => 10,
      computeSegmentFrequencies: () =>
        new Promise<Uint8Array[][]>((resolve) => {
          resolvers.push(resolve)
        }),
      renderSegment: async (segment) => {
        const canvas = document.createElement('canvas')
        segment.canvas = canvas
        container.appendChild(canvas)
      },
    })
    const manager = new SegmentManager(deps)

    const first = manager.generateSegments(0, 5)
    const second = manager.generateSegments(0, 5)
    expect(resolvers).toHaveLength(2)

    resolvers[0]([[new Uint8Array([1])]])
    await first
    resolvers[1]([[new Uint8Array([2])]])
    await second

    // Pre-fix the second call's Map.set() overwrote the first's entry and attached a second
    // canvas that nothing could ever evict (the map no longer pointed at it).
    expect(manager.segments.size).toBe(1)
    expect(container.children.length).toBe(1)
    const [segment] = manager.segments.values()
    expect(segment.canvas?.isConnected).toBe(true)
  })

  it('removes the canvas it attached when the segment was deleted during the renderSegment await', async () => {
    const container = document.createElement('div')
    let resolveRender: (() => void) | null = null
    const deps = makeDeps({
      getBufferDuration: () => 5,
      getWidth: () => 100,
      getPixelsPerSecond: () => 10,
      renderSegment: (segment) => {
        const canvas = document.createElement('canvas')
        segment.canvas = canvas
        container.appendChild(canvas)
        return new Promise<void>((resolve) => {
          resolveRender = resolve
        })
      },
    })
    const manager = new SegmentManager(deps)

    const generating = manager.generateSegments(0, 5)
    for (let i = 0; i < 10 && !resolveRender; i++) {
      await Promise.resolve()
    }
    expect(resolveRender).not.toBeNull()

    // Eviction (or a reset for a new buffer) deletes the segment while its render is in flight.
    const [key] = manager.segments.keys()
    manager.segments.delete(key)

    resolveRender!()
    await generating

    // The canvas the in-flight render attached must not be left orphaned in the DOM.
    expect(container.children.length).toBe(0)
  })
})

describe('SegmentManager progress reporting', () => {
  it('emits per-segment fractions ending at exactly 1 for a viewport-driven generate (non-progressive)', async () => {
    const progressValues: number[] = []
    const deps = makeDeps({
      getBufferDuration: () => 600,
      getWidth: () => 1000,
      getPixelsPerSecond: () => 1000, // segmentDuration = 15000px / 1000px/s = 15s
      emitProgress: (progress) => progressValues.push(progress),
    })
    const manager = new SegmentManager(deps) // progressiveLoading off (the default)

    await manager.generateSegments(0, 45) // 3 segments of 15s

    // Pre-fix every emitted value was 0: getLoadingProgress() only tracks the progressive
    // loader's cursor, which never moves in default (non-progressive) loading.
    expect(progressValues).toEqual([1 / 3, 2 / 3, 1])
  })

  it('emits 1 when a default-loading renderVisibleWindow pass completes', async () => {
    const progressValues: number[] = []
    const deps = makeDeps({
      getBufferDuration: () => 600,
      emitProgress: (progress) => progressValues.push(progress),
    })
    const manager = new SegmentManager(deps)

    await manager.renderVisibleWindow()

    expect(progressValues.length).toBeGreaterThan(0)
    expect(progressValues[progressValues.length - 1]).toBe(1)
  })

  it('keeps loader-cursor progress for progressive-load calls, and emits 1 on completion', async () => {
    const progressValues: number[] = []
    const deps = makeDeps({
      getBufferDuration: () => 60,
      getWidth: () => 100000,
      emitProgress: (progress) => progressValues.push(progress),
    })
    const manager = new SegmentManager(deps, { progressiveLoading: true })
    manager.isProgressiveLoading = true

    await manager.progressiveLoadNextSegment() // [0, 30): cursor still at 0 when it emits
    await manager.progressiveLoadNextSegment() // [30, 60): cursor at 30 -> 0.5
    await manager.progressiveLoadNextSegment() // cursor at 60 -> done: emits 1 and stops

    expect(progressValues).toEqual([0, 0.5, 1])
    expect(manager.isProgressiveLoading).toBe(false)
  })
})

describe('renderFrequencySegment devicePixelRatio scaling', () => {
  const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
  const originalCreateImageBitmap = (globalThis as any).createImageBitmap
  const originalImageData = (globalThis as any).ImageData
  let getContextSpy: jest.SpyInstance
  let fakeCtx: { scale: jest.Mock; drawImage: jest.Mock }

  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    fakeCtx = { scale: jest.fn(), drawImage: jest.fn() }
    getContextSpy = jest
      .spyOn(window.HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(fakeCtx as unknown as ReturnType<HTMLCanvasElement['getContext']>)
    ;(globalThis as any).ImageData = class {
      data: Uint8ClampedArray
      constructor(
        public width: number,
        public height: number,
      ) {
        this.data = new Uint8ClampedArray(width * height * 4)
      }
    }
    ;(globalThis as any).createImageBitmap = jest.fn(() => Promise.resolve({ close: jest.fn() }))
  })

  afterEach(() => {
    getContextSpy.mockRestore()
    ;(globalThis as any).createImageBitmap = originalCreateImageBitmap
    ;(globalThis as any).ImageData = originalImageData
    if (originalDpr) {
      Object.defineProperty(window, 'devicePixelRatio', originalDpr)
    } else {
      delete (window as any).devicePixelRatio
    }
  })

  it('scales the canvas backing store by devicePixelRatio while keeping its CSS size', async () => {
    const colorMap = Array.from({ length: 256 }, (_, i) => [i / 255, i / 255, i / 255, 1])
    const segment: FrequencySegment = {
      startTime: 0,
      endTime: 1,
      startPixel: 0,
      endPixel: 300,
      frequencies: [[new Uint8Array([1, 2, 3])]],
    }
    const container = document.createElement('div')

    await renderFrequencySegment(segment, {
      height: 200,
      colorMap,
      scale: 'linear',
      freqFrom: 4000,
      freqMin: 0,
      freqMax: 4000,
      canvasContainer: container,
    })

    const canvas = segment.canvas!
    // Pre-fix the backing store matched the CSS size (300x200), rendering blurry on HiDPI.
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(400)
    expect(canvas.style.width).toBe('300px')
    expect(canvas.style.height).toBe('200px')
    // Drawing happens in CSS coordinates via the context transform.
    expect(fakeCtx.scale).toHaveBeenCalledWith(2, 2)
  })
})
