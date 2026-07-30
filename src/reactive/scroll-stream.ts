/**
 * Reactive scroll stream utilities
 *
 * Provides declarative scroll handling using reactive streams.
 * Automatically handles scroll event optimization and cleanup.
 */

import { signal, computed, type Signal } from './store.js'

export interface ScrollData {
  /** Current scroll position in pixels */
  scrollLeft: number
  /** Total scrollable width in pixels */
  scrollWidth: number
  /** Visible viewport width in pixels */
  clientWidth: number
}

export interface ScrollPercentages {
  /** Start position as percentage (0-1) */
  startX: number
  /** End position as percentage (0-1) */
  endX: number
}

// ============================================================================
// Pure Scroll Calculation Functions
// ============================================================================

/**
 * Calculate visible percentages from scroll data
 * Pure function - no side effects
 *
 * @param scrollData - Current scroll dimensions
 * @returns Start and end positions as percentages (0-1)
 */
export function calculateScrollPercentages(scrollData: ScrollData): ScrollPercentages {
  const { scrollLeft, scrollWidth, clientWidth } = scrollData

  if (scrollWidth === 0) {
    return { startX: 0, endX: 1 }
  }

  const startX = scrollLeft / scrollWidth
  const endX = (scrollLeft + clientWidth) / scrollWidth

  return {
    startX: Math.max(0, Math.min(1, startX)),
    endX: Math.max(0, Math.min(1, endX)),
  }
}

/**
 * Calculate scroll bounds in pixels
 * Pure function - no side effects
 *
 * @param scrollData - Current scroll dimensions
 * @returns Left and right scroll bounds in pixels
 */
export function calculateScrollBounds(scrollData: ScrollData): { left: number; right: number } {
  return {
    left: scrollData.scrollLeft,
    right: scrollData.scrollLeft + scrollData.clientWidth,
  }
}

// ============================================================================
// Reactive Scroll Stream
// ============================================================================

export interface ScrollStream {
  /** Signal containing current scroll data */
  scrollData: Signal<ScrollData>
  /** Computed signal with visible percentages */
  percentages: Signal<ScrollPercentages>
  /** Computed signal with scroll bounds */
  bounds: Signal<{ left: number; right: number }>
  /**
   * Re-reads the element's current scrollLeft/scrollWidth/clientWidth and
   * writes them into `scrollData` -- the same math the `scroll` event
   * listener runs. Call this after any layout change that doesn't dispatch a
   * DOM `scroll` event (initial render, zoom, container resize) so
   * `percentages`/`bounds` (and anything derived from them, e.g. the
   * renderer's `visibleRange`) reflect the real, current metrics instead of
   * whatever was true when the stream was created.
   */
  refresh: () => void
  /** Cleanup function to remove listeners */
  cleanup: () => void
}

/**
 * Create a reactive scroll stream from an element
 *
 * Emits scroll data as the user scrolls the element.
 * Automatically computes derived values (percentages, bounds).
 *
 * @example
 * ```typescript
 * const scrollStream = createScrollStream(container)
 *
 * effect(() => {
 *   const { startX, endX } = scrollStream.percentages.value
 *   console.log('Visible:', startX, 'to', endX)
 * }, [scrollStream.percentages])
 *
 * scrollStream.cleanup()
 * ```
 *
 * @param element - Scrollable element
 * @returns Scroll stream with signals and cleanup
 */
export function createScrollStream(element: HTMLElement): ScrollStream {
  // Reads the element's current scroll metrics. Shared by the initial value,
  // the scroll event handler, and refresh() so all three stay in sync.
  const readScrollData = (): ScrollData => ({
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  })

  // Create signals
  const scrollData = signal<ScrollData>(readScrollData())

  // Computed derived values
  const percentages = computed(() => {
    return calculateScrollPercentages(scrollData.value)
  }, [scrollData])

  const bounds = computed(() => {
    return calculateScrollBounds(scrollData.value)
  }, [scrollData])

  // Update scroll data on scroll event
  const onScroll = () => {
    scrollData.set(readScrollData())
  }

  // Attach scroll listener
  element.addEventListener('scroll', onScroll, { passive: true })

  const refresh = () => {
    const next = readScrollData()
    const current = scrollData.value
    // readScrollData() always returns a fresh object literal, so
    // scrollData.set(next) would always pass signal.set()'s Object.is
    // check (two distinct objects are never Object.is-equal) and always
    // notify, even when every field is identical to the current value --
    // making every call site (initial render, zoom, container resize; see
    // this function's doc comment) fire a spurious 'scroll' event downstream
    // and risking a re-render-triggers-refresh-triggers-notify recursion for
    // any consumer that re-renders from a scroll handler. Field-compare
    // first and only set() on a genuine change.
    if (
      current.scrollLeft === next.scrollLeft &&
      current.scrollWidth === next.scrollWidth &&
      current.clientWidth === next.clientWidth
    ) {
      return
    }
    scrollData.set(next)
  }

  // Cleanup function
  const cleanupFn = () => {
    element.removeEventListener('scroll', onScroll)
    percentages.dispose()
    bounds.dispose()
  }

  return {
    scrollData,
    percentages,
    bounds,
    refresh,
    cleanup: cleanupFn,
  }
}
