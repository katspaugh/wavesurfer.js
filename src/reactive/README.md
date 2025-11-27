# Reactive System

Signal-based reactivity for WaveSurfer.js, providing automatic state management and efficient updates.

## Overview

The reactive system provides a lightweight, signal-based reactivity implementation similar to SolidJS signals. Signals are reactive values that automatically notify subscribers when they change, enabling efficient state management and UI updates.

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

count.set(10) // Logs: "Count changed: 10"
unsubscribe() // Stop listening
```

### Computed Values

Automatically derived values that update when dependencies change.

```typescript
import { signal, computed } from './store.js'

const count = signal(0)
const doubled = computed(() => count.value * 2, [count])

console.log(doubled.value) // 0
count.set(5)
console.log(doubled.value) // 10
```

### Effects

Side effects that run automatically when dependencies change.

```typescript
import { signal, effect } from './store.js'

const count = signal(0)

const cleanup = effect(() => {
  console.log('Count is:', count.value)
  // Optional: return cleanup function
  return () => console.log('Cleanup')
}, [count])

count.set(5) // Logs: "Cleanup", "Count is: 5"
cleanup() // Stop effect and run cleanup
```

## Module Architecture

### Core Reactive Primitives

- **`store.ts`** - Core signal, computed, and effect implementations
  - `signal<T>(value)` - Create a writable reactive value
  - `computed<T>(fn, deps)` - Create a derived reactive value
  - `effect(fn, deps)` - Run side effects on changes

### Event Streams

- **`event-stream-emitter.ts`** - Convert EventEmitter to reactive streams
- **`event-streams.ts`** - DOM event streams (click, drag, scroll, zoom)
- **`drag-stream.ts`** - Drag gesture detection and handling
- **`scroll-stream.ts`** - Scroll position tracking with percentages

### Bridges

- **`state-event-emitter.ts`** - Bridge reactive state to EventEmitter API (backwards compatibility)
- **`media-event-bridge.ts`** - Bridge HTML media events to reactive state

### Utilities

- **`render-scheduler.ts`** - Efficient render scheduling with RAF batching

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
npm test src/reactive/__tests__
```

Test coverage: **97.66%**

Test files:
- `store.test.ts` - Core reactive primitives (362 tests)
- `event-stream-emitter.test.ts` - EventEmitter streams (335 tests)
- `event-streams.test.ts` - DOM event streams (375 tests)
- `drag-stream.test.ts` - Drag gestures (253 tests)
- `scroll-stream.test.ts` - Scroll tracking (250 tests)
- `state-event-emitter.test.ts` - State bridging (368 tests)
- `media-event-bridge.test.ts` - Media events (277 tests)
- `render-scheduler.test.ts` - Render scheduling (278 tests)

## Best Practices

1. **Always unsubscribe**: Store unsubscribe functions and call them in cleanup
   ```typescript
   const unsubscribe = signal.subscribe(...)
   // Later:
   unsubscribe()
   ```

2. **Use computed for derived values**: Don't manually recalculate
   ```typescript
   // Good
   const total = computed(() => price.value * quantity.value, [price, quantity])
   
   // Avoid
   let total = 0
   price.subscribe(p => total = p * quantity.value)
   quantity.subscribe(q => total = price.value * q)
   ```

3. **Batch updates**: Multiple signal updates in the same tick are batched
   ```typescript
   count.set(1)
   count.set(2)
   count.set(3)
   // Subscribers notified once with value 3
   ```

4. **Memory safety**: Cleanup subscriptions in destroy/cleanup methods
   ```typescript
   class Component {
     private cleanups: Array<() => void> = []
     
     init() {
       this.cleanups.push(
         state.subscribe(...)
       )
     }
     
     destroy() {
       this.cleanups.forEach(fn => fn())
     }
   }
   ```

## Performance Characteristics

- **O(1)** signal reads via property getter
- **O(n)** signal writes, where n = number of subscribers
- **Automatic batching** - Multiple updates in same tick are batched
- **Change detection** - Uses `Object.is()` to detect changes
- **Memory efficient** - Subscriptions use `Set` for O(1) add/remove

## Future Enhancements

Potential improvements for future versions:

- Optional debug mode for tracking signal updates
- WeakMap-based subscriptions for large objects
- Automatic dependency tracking (like SolidJS)
- Transaction support for atomic multi-signal updates
