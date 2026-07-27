# Reactive System

Signal-based reactivity for WaveSurfer.js: state management and event streams built on plain synchronous signals.

## Overview

The reactive system provides a lightweight, signal-based reactivity implementation similar to SolidJS signals. Signals are reactive values that notify subscribers when they change. Notification is **synchronous** by default; `batch()` is the only way to coalesce multiple writes into a single notification (see below).

## Core Concepts

### Signals

Reactive values that notify subscribers when they change.

```typescript
import { signal } from './store.js'

const count = signal(0)
console.log(count.value) // 0

count.set(5)
console.log(count.value) // 5

// Subscribe to changes
const unsubscribe = count.subscribe((value) => {
  console.log('Count changed:', value)
})

count.set(10) // Synchronously logs: "Count changed: 10"
unsubscribe() // Stop listening
```

### Computed Values

Derived values that recompute when their dependencies change. `computed()` is always disposable: calling `dispose()` unsubscribes it from its dependencies so it stops recomputing. Without a `dependencies` array, dependencies are auto-tracked from whichever signals are read during the function body, and are re-collected on every run so conditional reads stay correct.

```typescript
import { signal, computed } from './store.js'

const count = signal(0)

// Explicit dependencies
const doubled = computed(() => count.value * 2, [count])

// Auto-tracked dependencies (omit the array)
const tripled = computed(() => count.value * 3)

console.log(doubled.value) // 0
count.set(5)
console.log(doubled.value) // 10

// Stop recomputing and unsubscribe from dependencies
doubled.dispose()
tripled.dispose()
```

### Effects

Side effects that (re-)run when dependencies change. Like `computed`, `effect` supports both an explicit `dependencies` array and auto-tracking. The function may return a cleanup callback, which runs before the next invocation and on final teardown.

```typescript
import { signal, effect } from './store.js'

const count = signal(0)

const stop = effect(() => {
  console.log('Count is:', count.value)
  // Optional: return cleanup function
  return () => console.log('Cleanup')
}, [count])

count.set(5) // Logs: "Cleanup", "Count is: 5"
stop() // Stop effect and run final cleanup
```

### batch()

Signal writes notify subscribers synchronously, one `set()` call at a time — there is no automatic batching. To coalesce multiple writes into a single notification per signal, wrap them in `batch()`:

```typescript
import { signal, batch } from './store.js'

const count = signal(0)
count.subscribe((v) => console.log('count:', v))

count.set(1) // Logs "count: 1" immediately
count.set(2) // Logs "count: 2" immediately

batch(() => {
  count.set(3) // Queued, not yet delivered
  count.set(4) // Queued, replaces the previous queued notification
})
// Logs "count: 4" once, after the batch() call returns
```

Nested `batch()` calls are supported: notifications are only flushed once the outermost `batch()` returns. Writes triggered by a notification while flushing (e.g. one subscriber setting another signal) are queued rather than fired re-entrantly.

### Scope

`Scope` (in `../scope.ts`, one level up from `reactive/`) is the disposal-tree ownership primitive used throughout wavesurfer for listeners, timers, observers, signal subscriptions, and child lifetimes. Every `destroy()` in the codebase is expressed as disposing a `Scope`.

```typescript
import { Scope } from '../scope.js'

const scope = new Scope()

scope.add(() => console.log('cleanup'))
scope.listen(element, 'click', onClick)
scope.timeout(() => console.log('fired'), 100)
scope.interval(tick, 16)
scope.raf(onFrame)

// Child scopes dispose together with (and before) their parent's own disposers
const child = scope.child()

scope.dispose() // disposes children first, then own disposers, LIFO
```

Disposing a `Scope` is idempotent, disposes children before its own disposers (own disposers run LIFO), and any disposer added after disposal runs immediately instead of leaking.

## Module Architecture

### Core Reactive Primitives

- **`store.ts`** - Core signal, computed, effect and `batch()` implementations
  - `signal<T>(value)` - Create a writable reactive value
  - `computed<T>(fn, deps?)` - Create a disposable derived reactive value
  - `effect(fn, deps?)` - Run side effects on changes; returns a stop/dispose function
  - `batch(fn)` - Coalesce signal writes made inside `fn` into one notification per signal

### Event & Gesture Streams

- **`event-streams.ts`** - `fromEvent()` converts a DOM event into a signal; `cleanup()` tears down a stream's listener/subscription. Used by the hover, zoom, and regions plugins.
- **`drag-stream.ts`** - Drag gesture detection (`createDragStream`), the reactive replacement for the old `makeDraggable` helper.
- **`scroll-stream.ts`** - Scroll position tracking with percentages.

## Usage in WaveSurfer

### Accessing Reactive State

```typescript
const wavesurfer = WaveSurfer.create({ container: '#waveform' })
const state = wavesurfer.getState()

// Read current value
console.log(state.isPlaying.value)

// Subscribe to changes
state.isPlaying.subscribe((playing) => {
  console.log('Playing:', playing)
})

// Access computed values
console.log('Progress:', state.progressPercent.value)
```

### In Plugins

```typescript
class MyPlugin extends BasePlugin {
  onInit() {
    const state = this.wavesurfer.getState()

    // Subscribe to state changes
    this.subscriptions.push(
      state.isPlaying.subscribe((playing) => {
        if (playing) {
          this.startAnimation()
        } else {
          this.stopAnimation()
        }
      })
    )

    // Access current time
    const currentTime = state.currentTime.value
  }
}
```

## Testing

Run tests:
```bash
npx jest src/reactive/__tests__ src/__tests__/scope.test.ts
```

Test files:
- `store.test.ts` - Core reactive primitives: signal, computed, effect, batch
- `event-streams.test.ts` - DOM event streams (`fromEvent`, `cleanup`)
- `drag-stream.test.ts` - Drag gestures
- `scroll-stream.test.ts` - Scroll tracking
- `../../__tests__/scope.test.ts` - The `Scope` disposal-tree primitive

## Best Practices

1. **Always unsubscribe / dispose**: Store unsubscribe functions (or the `computed`/`effect`/`Scope` handle) and call them in cleanup.
   ```typescript
   const unsubscribe = signal.subscribe(...)
   // Later:
   unsubscribe()
   ```

2. **Use computed for derived values**: Don't manually recalculate, and dispose computeds you no longer need.
   ```typescript
   // Good
   const total = computed(() => price.value * quantity.value, [price, quantity])
   // Later:
   total.dispose()

   // Avoid
   let total = 0
   price.subscribe(p => total = p * quantity.value)
   quantity.subscribe(q => total = price.value * q)
   ```

3. **Use `batch()` when writing multiple signals together**: without it, each `set()` notifies synchronously on its own.
   ```typescript
   batch(() => {
     count.set(1)
     count.set(2)
     count.set(3)
   })
   // Subscribers notified once with value 3
   ```

4. **Prefer `Scope` for lifecycle-bound resources**: listeners, timers, observers, and child components should be registered on a `Scope` and released via a single `scope.dispose()` rather than tracked by hand.

## Performance Characteristics

- **O(1)** signal reads via property getter
- **O(n)** signal writes, where n = number of subscribers
- **Synchronous notification** - `set()` notifies subscribers immediately unless inside `batch()`
- **Change detection** - Uses `Object.is()` to detect changes
- **Memory efficient** - Subscriptions use `Set` for O(1) add/remove
