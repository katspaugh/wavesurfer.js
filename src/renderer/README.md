# Declarative Renderer

The `DeclarativeRenderer` is a reactive alternative to the imperative `Renderer` class. It automatically updates the UI when state changes, eliminating the need for manual `render()` calls.

## Key Benefits

- **Automatic Updates**: UI updates when state changes - no manual calls needed
- **No Timer Polling**: Updates only when time actually changes
- **Auto-scroll Support**: Intelligent scrolling during playback
- **Clean Lifecycle**: All effects cleaned up automatically
- **Better Performance**: Automatic batching of rapid updates

## Architecture Comparison

### Old Approach (Imperative)

```typescript
// Timer fires every 16ms
timer.on('tick', () => {
  const currentTime = player.getCurrentTime()
  const progress = currentTime / duration
  
  // Manual render call
  renderer.renderProgress(progress, isPlaying)
})
```

**Problems:**
- Polls every 16ms even when nothing changes
- Manual coordination between timer and renderer
- Easy to forget cleanup
- Hard to test

### New Approach (Reactive)

```typescript
// Set up once
const { state, actions } = createWaveSurferState()
const renderer = new DeclarativeRenderer(container, state, options)

// Effects set up automatically:
effect(() => {
  const progress = state.progressPercent.value
  cursor.update({ position: progress })
}, [state.progressPercent])

// Just update state - UI updates automatically!
actions.setCurrentTime(50)
```

**Benefits:**
- Updates only when state actually changes
- Automatic effect cleanup
- Declarative and testable
- Clear data flow

## Usage

```typescript
import { createWaveSurferState } from '../state/wavesurfer-state.js'
import { DeclarativeRenderer } from './declarative-renderer.js'

// Create reactive state
const { state, actions } = createWaveSurferState()

// Create renderer (automatically sets up reactive effects)
const renderer = new DeclarativeRenderer(container, state, {
  container: '#waveform',
  height: 128,
  cursorColor: '#333',
  cursorWidth: 2,
  progressColor: 'rgba(255, 255, 255, 0.5)',
  autoScroll: true,
  autoCenter: true
})

// Update state - cursor and progress update automatically!
actions.setDuration(180)
actions.setCurrentTime(90)  // Cursor moves to 50%
actions.setPlaying(true)     // Auto-scroll activates

// Cleanup (all effects cleaned up automatically)
renderer.destroy()
```

## Options

```typescript
interface DeclarativeRendererOptions {
  /** Container element or selector */
  container: HTMLElement | string
  
  /** Height in pixels or 'auto' */
  height: number | 'auto'
  
  /** Cursor color (defaults to progressColor) */
  cursorColor?: string
  
  /** Cursor width in pixels (default: 2) */
  cursorWidth?: number
  
  /** Progress bar color */
  progressColor?: string
  
  /** Enable auto-scroll during playback (default: false) */
  autoScroll?: boolean
  
  /** Keep cursor centered during auto-scroll (default: true) */
  autoCenter?: boolean
}
```

## API

### Constructor

```typescript
new DeclarativeRenderer(
  container: HTMLElement | string,
  state: WaveSurferState,
  options: DeclarativeRendererOptions
)
```

### Methods

#### `getWrapper(): HTMLElement`
Get the wrapper element.

#### `getCanvasWrapper(): HTMLElement`
Get the canvas wrapper element.

#### `getWidth(): number`
Get the current width.

#### `getScroll(): number`
Get current scroll position in pixels.

#### `setScroll(pixels: number): void`
Set scroll position in pixels.

#### `setScrollPercentage(percent: number): void`
Set scroll position by percentage (0-1).

#### `renderProgress(progress: number): void`
Manually render progress (for backward compatibility). Not needed with reactive updates!

#### `updateCursorStyle(color?: string, width?: number): void`
Update cursor styling.

#### `updateProgressStyle(color?: string): void`
Update progress bar styling.

#### `destroy(): void`
Clean up all effects and DOM elements.

## Reactive Effects

The renderer sets up these effects automatically:

### 1. Cursor Position
```typescript
effect(() => {
  const position = state.progressPercent.value
  cursor.update({ position })
}, [state.progressPercent])
```

Updates cursor position when progress changes.

### 2. Progress Bar
```typescript
effect(() => {
  const progress = state.progressPercent.value
  progress.update({ progress })
}, [state.progressPercent])
```

Updates progress bar width when progress changes.

### 3. Auto-scroll
```typescript
effect(() => {
  const isPlaying = state.isPlaying.value
  const progress = state.progressPercent.value
  
  if (isPlaying && options.autoScroll) {
    scrollIntoView(progress)
  }
}, [state.isPlaying, state.progressPercent])
```

Automatically scrolls during playback to keep cursor visible.

## Testing

The renderer is fully tested with:
- 29 unit tests
- 100% statement coverage
- Tests for reactive updates, auto-scroll, styling, and cleanup

See `__tests__/declarative-renderer.test.ts` for examples.

## Example

See `examples/reactive-progress.html` for a working demo.

## Migration Guide

### From Renderer to DeclarativeRenderer

**Before:**
```typescript
const renderer = new Renderer(options, audioElement)

// Manual update in timer
timer.on('tick', () => {
  renderer.renderProgress(getCurrentTime() / getDuration())
})
```

**After:**
```typescript
const { state, actions } = createWaveSurferState()
const renderer = new DeclarativeRenderer(container, state, options)

// No manual updates needed!
// Just update state:
actions.setCurrentTime(time)  // UI updates automatically
```

## Performance

The declarative approach is more efficient because:
- Updates only when state actually changes (not every 16ms)
- Automatic batching of rapid updates
- No polling overhead
- Clean effect cleanup prevents memory leaks

## Future Enhancements

Planned features:
- Reactive waveform rendering
- Reactive canvas updates
- Reactive zoom handling
- Plugin integration
