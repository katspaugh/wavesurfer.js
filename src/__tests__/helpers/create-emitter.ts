/**
 * Minimal typed pub/sub stand-in for the small slice of EventEmitter that plugin unit tests
 * drive through a fake wavesurfer's `on()` (and, for a few suites, `emit()` to fire events back
 * into the plugin under test). Six suites (hover, zoom, timeline, regions, minimap,
 * envelope-leaks) independently hand-rolled byte-identical copies of this before it was pulled
 * out here -- `emit` is a harmless no-op addition for the suites that only ever called `.on()`.
 */
type Listener = (...args: any[]) => void

export const createEmitter = () => {
  const listeners = new Map<string, Set<Listener>>()

  return {
    on: jest.fn((event: string, listener: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set())
      }

      listeners.get(event)!.add(listener)
      return () => listeners.get(event)?.delete(listener)
    }),
    emit: (event: string, ...args: any[]) => {
      listeners.get(event)?.forEach((listener) => listener(...args))
    },
  }
}
