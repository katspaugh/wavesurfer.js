/**
 * Installs a `window.matchMedia` stub. jsdom doesn't implement it at all, but
 * `reactive/drag-stream.ts` calls `matchMedia('(pointer: coarse)').matches` synchronously to
 * detect touch devices, so any suite that constructs a real drag stream (directly, or indirectly
 * through a plugin/WaveSurfer instance) needs this or construction throws. Five suites
 * independently hand-rolled slightly different subsets of this same mock object (matches always
 * `false`) before it was pulled out here; only `.matches` is ever read by production code, so the
 * extra fields (media/onchange/dispatchEvent/etc.) below are a harmless superset kept for
 * consumers that also spy on add/removeEventListener.
 */
export function installMatchMediaStub(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}
