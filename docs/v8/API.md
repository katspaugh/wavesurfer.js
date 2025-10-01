# WaveSurfer.js v8 API Reference

## Table of Contents

- [Core API](#core-api)
  - [WaveSurfer.create()](#wavesurfercreate)
  - [Instance Methods](#instance-methods)
  - [Events](#events)
  - [Options](#options)
- [Streams API](#streams-api)
  - [Stream Interface](#stream-interface)
  - [Stream Operators](#stream-operators)
  - [Subject & BehaviorSubject](#subject--behaviorsubject)
- [State Management](#state-management)
  - [StateStore](#statestore)
  - [State Structure](#state-structure)
  - [Selectors](#selectors)
- [Plugin API](#plugin-api)
  - [PluginManager](#pluginmanager)
  - [Creating Plugins](#creating-plugins)
  - [Plugin Context](#plugin-context)
- [Utility APIs](#utility-apis)
  - [ResourcePool](#resourcepool)
  - [Error Handling](#error-handling)
  - [Pure Functions](#pure-functions)

---

## Core API

### WaveSurfer.create()

Create a new WaveSurfer instance.

```typescript
static create(options: WaveSurferOptions): WaveSurfer
```

**Parameters:**
- `options` - Configuration object

**Returns:** WaveSurfer instance

**Example:**
```javascript
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple',
  height: 128,
  normalize: true,
  backend: 'WebAudio'
})
```

---

### Instance Methods

#### Loading Audio

##### `.load(url, peaks?, duration?)`

Load audio from URL.

```typescript
load(url: string, peaks?: number[][], duration?: number): Promise<void>
```

**Parameters:**
- `url` - Audio file URL
- `peaks` - Optional pre-computed peaks
- `duration` - Optional duration (for peaks)

**Returns:** Promise that resolves when loading is complete

**Example:**
```javascript
await wavesurfer.load('audio.mp3')

// With pre-computed peaks
await wavesurfer.load('audio.mp3', peaks, duration)
```

##### `.loadBlob(blob)`

Load audio from Blob or File.

```typescript
loadBlob(blob: Blob): Promise<void>
```

**Example:**
```javascript
const blob = new Blob([audioData], { type: 'audio/mp3' })
await wavesurfer.loadBlob(blob)
```

##### `.loadDecodedBuffer(buffer)`

Load pre-decoded AudioBuffer.

```typescript
loadDecodedBuffer(buffer: AudioBuffer): Promise<void>
```

**Example:**
```javascript
const audioContext = new AudioContext()
const buffer = await audioContext.decodeAudioData(arrayBuffer)
await wavesurfer.loadDecodedBuffer(buffer)
```

#### Playback Control

##### `.play()`

Start playback.

```typescript
play(): Promise<void>
```

**Example:**
```javascript
wavesurfer.play()
```

##### `.pause()`

Pause playback.

```typescript
pause(): void
```

##### `.stop()`

Stop and reset to beginning.

```typescript
stop(): void
```

##### `.setTime(seconds)`

Seek to specific time.

```typescript
setTime(seconds: number): void
```

**Parameters:**
- `seconds` - Time in seconds

**Example:**
```javascript
wavesurfer.setTime(30) // Seek to 30 seconds
```

##### `.skip(seconds)`

Skip forward or backward.

```typescript
skip(seconds: number): void
```

**Parameters:**
- `seconds` - Seconds to skip (positive or negative)

**Example:**
```javascript
wavesurfer.skip(5)   // Skip forward 5 seconds
wavesurfer.skip(-5)  // Skip backward 5 seconds
```

##### `.seekTo(progress)`

Seek to normalized position (0-1).

```typescript
seekTo(progress: number): void
```

**Parameters:**
- `progress` - Position from 0 to 1

**Example:**
```javascript
wavesurfer.seekTo(0.5) // Seek to middle
```

#### Audio Properties

##### `.setVolume(volume)`

Set playback volume.

```typescript
setVolume(volume: number): void
```

**Parameters:**
- `volume` - Volume from 0 to 1

**Example:**
```javascript
wavesurfer.setVolume(0.5) // 50% volume
```

##### `.getVolume()`

Get current volume.

```typescript
getVolume(): number
```

**Returns:** Volume from 0 to 1

##### `.setPlaybackRate(rate)`

Set playback speed.

```typescript
setPlaybackRate(rate: number): void
```

**Parameters:**
- `rate` - Playback rate (0.5 = half speed, 2 = double speed)

**Example:**
```javascript
wavesurfer.setPlaybackRate(1.5) // 1.5x speed
```

##### `.getPlaybackRate()`

Get current playback rate.

```typescript
getPlaybackRate(): number
```

#### Information

##### `.getDuration()`

Get audio duration in seconds.

```typescript
getDuration(): number
```

**Returns:** Duration in seconds

##### `.getCurrentTime()`

Get current playback position in seconds.

```typescript
getCurrentTime(): number
```

**Returns:** Current time in seconds

##### `.isPlaying()`

Check if audio is playing.

```typescript
isPlaying(): boolean
```

**Returns:** `true` if playing

##### `.getDecodedData()`

Get decoded audio buffer.

```typescript
getDecodedData(): AudioBuffer | null
```

**Returns:** AudioBuffer or null if not loaded

#### Visualization

##### `.zoom(pxPerSec)`

Set zoom level.

```typescript
zoom(pxPerSec: number): void
```

**Parameters:**
- `pxPerSec` - Pixels per second of audio

**Example:**
```javascript
wavesurfer.zoom(100) // 100 pixels per second
```

##### `.setHeight(height)`

Set waveform height.

```typescript
setHeight(height: number): void
```

**Parameters:**
- `height` - Height in pixels

##### `.getWidth()`

Get waveform width.

```typescript
getWidth(): number
```

**Returns:** Width in pixels

##### `.getHeight()`

Get waveform height.

```typescript
getHeight(): number
```

**Returns:** Height in pixels

#### Export

##### `.exportImage(format?, quality?, type?)`

Export waveform as image.

```typescript
exportImage(
  format?: string,
  quality?: number,
  type?: 'dataURL' | 'blob'
): Promise<string | Blob>
```

**Parameters:**
- `format` - Image format ('image/png', 'image/jpeg')
- `quality` - Quality from 0 to 1 (for JPEG)
- `type` - Return type ('dataURL' or 'blob')

**Returns:** Promise resolving to data URL or Blob

**Example:**
```javascript
const dataUrl = await wavesurfer.exportImage('image/png', 1, 'dataURL')
const blob = await wavesurfer.exportImage('image/png', 1, 'blob')
```

##### `.exportPCM(length?, accuracy?, noWindow?, start?)`

Export audio as PCM data.

```typescript
exportPCM(
  length?: number,
  accuracy?: number,
  noWindow?: boolean,
  start?: number
): Promise<Float32Array[]>
```

**Returns:** Promise resolving to array of Float32Arrays (one per channel)

#### Lifecycle

##### `.destroy()`

Destroy the instance and clean up resources.

```typescript
destroy(): Promise<void>
```

**Example:**
```javascript
await wavesurfer.destroy()
```

##### `.empty()`

Clear the waveform display.

```typescript
empty(): void
```

---

### Events

Subscribe to events using `.on()`, `.once()`, or `.un()`.

#### Event Methods

##### `.on(event, callback, options?)`

Subscribe to an event.

```typescript
on<E extends keyof EventTypes>(
  event: E,
  callback: EventCallback<E>,
  options?: { once?: boolean }
): UnsubscribeFn
```

**Returns:** Unsubscribe function

**Example:**
```javascript
const unsubscribe = wavesurfer.on('ready', () => {
  console.log('Ready!')
})

// Later...
unsubscribe()
```

##### `.once(event, callback)`

Subscribe to an event (fires once).

```typescript
once<E extends keyof EventTypes>(
  event: E,
  callback: EventCallback<E>
): UnsubscribeFn
```

##### `.un(event, callback)`

Unsubscribe from an event.

```typescript
un<E extends keyof EventTypes>(
  event: E,
  callback: EventCallback<E>
): void
```

##### `.unAll()`

Unsubscribe from all events.

```typescript
unAll(): void
```

#### Event List

| Event | Arguments | Description |
|-------|-----------|-------------|
| `audioprocess` | `currentTime: number` | Fired continuously during playback |
| `finish` | - | Fired when playback finished |
| `load` | `url: string` | Fired when load starts |
| `loading` | `percent: number` | Fired during loading |
| `decode` | `duration: number` | Fired after audio is decoded |
| `ready` | - | Fired when waveform is ready |
| `play` | - | Fired when playback starts |
| `pause` | - | Fired when playback pauses |
| `seeking` | `currentTime: number` | Fired when seeking |
| `timeupdate` | `currentTime: number` | Fired on time update |
| `volume` | `volume: number` | Fired on volume change |
| `zoom` | `minPxPerSec: number` | Fired on zoom |
| `redraw` | - | Fired when waveform redraws |
| `destroy` | - | Fired before destruction |
| `error` | `error: Error` | Fired on error |

**Example:**
```javascript
wavesurfer.on('ready', () => {
  console.log('Duration:', wavesurfer.getDuration())
})

wavesurfer.on('play', () => {
  console.log('Playing')
})

wavesurfer.on('pause', () => {
  console.log('Paused')
})

wavesurfer.on('audioprocess', (currentTime) => {
  console.log('Current time:', currentTime)
})

wavesurfer.on('error', (error) => {
  console.error('Error:', error)
})
```

---

### Options

Configuration options for `WaveSurfer.create()`.

#### Container Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `string \| HTMLElement` | **required** | CSS selector or element |
| `height` | `number` | `128` | Height in pixels |
| `width` | `number \| 'auto'` | `'auto'` | Width (auto = container width) |

#### Waveform Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `waveColor` | `string \| CanvasGradient` | `'#999'` | Waveform color |
| `progressColor` | `string \| CanvasGradient` | `'#555'` | Progress color |
| `cursorColor` | `string` | `'#333'` | Playback cursor color |
| `cursorWidth` | `number` | `1` | Cursor width in pixels |
| `barWidth` | `number` | `undefined` | Bar width in pixels |
| `barGap` | `number` | `undefined` | Gap between bars |
| `barRadius` | `number` | `0` | Bar border radius |
| `barHeight` | `number` | `1` | Bar height multiplier |
| `minPxPerSec` | `number` | `50` | Minimum pixels per second |
| `fillParent` | `boolean` | `true` | Fill container width |
| `normalize` | `boolean` | `false` | Normalize waveform amplitude |
| `splitChannels` | `boolean` | `false` | Render channels separately |

#### Audio Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backend` | `'WebAudio' \| 'MediaElement'` | `'WebAudio'` | Audio backend |
| `audioContext` | `AudioContext` | `undefined` | Custom AudioContext |
| `audioRate` | `number` | `1` | Speed to decode at |
| `autoplay` | `boolean` | `false` | Auto-start playback |
| `interact` | `boolean` | `true` | Enable interaction |
| `hideScrollbar` | `boolean` | `false` | Hide scrollbar |
| `sampleRate` | `number` | `8000` | Sample rate for peaks |

#### Media Element Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `media` | `HTMLMediaElement` | `undefined` | Existing media element |
| `mediaControls` | `boolean` | `false` | Show media controls |
| `autoCenter` | `boolean` | `true` | Center on play |
| `autoScroll` | `boolean` | `true` | Auto-scroll on play |

#### Rendering Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `renderFunction` | `Function` | `undefined` | Custom render function |
| `barMinHeight` | `number` | `undefined` | Minimum bar height |
| `fetchParams` | `RequestInit` | `{}` | Fetch options for load |

**Example:**
```javascript
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  height: 128,
  waveColor: 'violet',
  progressColor: 'purple',
  cursorColor: 'white',
  barWidth: 3,
  barGap: 2,
  barRadius: 3,
  normalize: true,
  minPxPerSec: 50,
  fillParent: true,
  backend: 'WebAudio',
  interact: true,
  autoplay: false
})
```

---

## Streams API

### Stream Interface

Reactive streams for data flow.

```typescript
interface Stream<T> {
  subscribe(observer: Observer<T>): Subscription
  map<U>(fn: (value: T) => U): Stream<U>
  filter(predicate: (value: T) => boolean): Stream<T>
  distinct(compareFn?: (prev: T, curr: T) => boolean): Stream<T>
  debounce(ms: number): Stream<T>
  throttle(ms: number): Stream<T>
  take(count: number): Stream<T>
  takeUntil(notifier: Stream<any>): Stream<T>
  combine<U, R>(other: Stream<U>, fn: (a: T, b: U) => R): Stream<R>
  share(): Stream<T>
}
```

#### subscribe(observer)

Subscribe to stream emissions.

```typescript
subscribe(observer: (value: T) => void): Subscription
```

**Example:**
```javascript
const subscription = stream.subscribe(value => {
  console.log('Value:', value)
})

// Unsubscribe
subscription.unsubscribe()
```

---

### Stream Operators

#### map(fn)

Transform emitted values.

```typescript
map<U>(fn: (value: T) => U): Stream<U>
```

**Example:**
```javascript
stream
  .map(x => x * 2)
  .subscribe(result => console.log(result))
```

#### filter(predicate)

Filter emitted values.

```typescript
filter(predicate: (value: T) => boolean): Stream<T>
```

**Example:**
```javascript
stream
  .filter(x => x > 10)
  .subscribe(value => console.log(value))
```

#### distinct(compareFn?)

Only emit when value changes.

```typescript
distinct(compareFn?: (prev: T, curr: T) => boolean): Stream<T>
```

**Example:**
```javascript
stream
  .distinct()
  .subscribe(value => console.log('Changed:', value))
```

#### debounce(ms)

Emit only after silence period.

```typescript
debounce(ms: number): Stream<T>
```

**Example:**
```javascript
stream
  .debounce(300)
  .subscribe(value => console.log('Debounced:', value))
```

#### throttle(ms)

Emit at most once per time period.

```typescript
throttle(ms: number): Stream<T>
```

**Example:**
```javascript
stream
  .throttle(100)
  .subscribe(value => console.log('Throttled:', value))
```

#### take(count)

Take first N emissions.

```typescript
take(count: number): Stream<T>
```

**Example:**
```javascript
stream
  .take(5)
  .subscribe(value => console.log(value))
```

#### takeUntil(notifier)

Take until notifier emits.

```typescript
takeUntil(notifier: Stream<any>): Stream<T>
```

**Example:**
```javascript
const stop = new Subject()

stream
  .takeUntil(stop)
  .subscribe(value => console.log(value))

// Stop after 5 seconds
setTimeout(() => stop.next(), 5000)
```

#### combine(other, fn)

Combine with another stream.

```typescript
combine<U, R>(
  other: Stream<U>,
  fn: (a: T, b: U) => R
): Stream<R>
```

**Example:**
```javascript
stream1
  .combine(stream2, (a, b) => a + b)
  .subscribe(sum => console.log(sum))
```

---

### Subject & BehaviorSubject

Manual stream control.

#### Subject

```typescript
class Subject<T> extends Stream<T> {
  next(value: T): void
  complete(): void
  get closed(): boolean
  get observerCount(): number
}
```

**Example:**
```javascript
const subject = new Subject()

subject.subscribe(value => console.log(value))

subject.next(1)
subject.next(2)
subject.complete()
```

#### BehaviorSubject

Subject that stores current value.

```typescript
class BehaviorSubject<T> extends Stream<T> {
  constructor(initialValue: T)
  next(value: T): void
  getValue(): T
  complete(): void
  get closed(): boolean
}
```

**Example:**
```javascript
const subject = new BehaviorSubject(0)

// Gets current value immediately
subject.subscribe(value => console.log(value)) // 0

subject.next(1) // 1
subject.next(2) // 2

const current = subject.getValue() // 2
```

---

## State Management

### StateStore

Centralized immutable state management.

```typescript
class StateStore<S> {
  get snapshot(): S
  update(updater: (state: S) => S): void
  set(state: S): void
  get stream(): Stream<S>
  select<T>(selector: (state: S) => T): Stream<T>
  selectMany<T>(...selectors): Stream<T>
  subscribe(observer: (state: S) => void): Subscription
  complete(): void
}
```

#### snapshot

Get current state snapshot.

```typescript
get snapshot(): S
```

**Example:**
```javascript
const state = wavesurfer.state.snapshot
console.log('Duration:', state.audio.duration)
```

#### update(updater)

Update state immutably.

```typescript
update(updater: (state: S) => S): void
```

**Example:**
```javascript
wavesurfer.state.update(state => ({
  ...state,
  playback: {
    ...state.playback,
    isPlaying: true
  }
}))
```

#### select(selector)

Select and subscribe to state slice.

```typescript
select<T>(selector: (state: S) => T): Stream<T>
```

**Example:**
```javascript
wavesurfer.state
  .select(s => s.playback.currentTime)
  .subscribe(time => {
    console.log('Time:', time)
  })
```

#### selectMany(...selectors)

Select multiple state slices.

```typescript
selectMany<T>(...selectors): Stream<T>
```

**Example:**
```javascript
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .subscribe(([time, duration]) => {
    console.log(`${time} / ${duration}`)
  })
```

---

### State Structure

```typescript
interface WaveSurferState {
  audio: AudioState
  playback: PlaybackState
  view: ViewState
  plugins: PluginState
}

interface AudioState {
  duration: number
  decodedData: AudioBuffer | null
  peaks: number[][] | null
  sampleRate: number
  numberOfChannels: number
}

interface PlaybackState {
  isPlaying: boolean
  currentTime: number
  volume: number
  playbackRate: number
}

interface ViewState {
  containerWidth: number
  containerHeight: number
  waveformWidth: number
  scrollLeft: number
  minPxPerSec: number
  fillParent: boolean
}

interface PluginState {
  pluginData: Record<string, unknown>
}
```

---

### Selectors

Pre-built selectors for common queries.

```typescript
// Audio selectors
selectDuration(state): number
selectDecodedData(state): AudioBuffer | null
selectPeaks(state): number[][] | null

// Playback selectors
selectIsPlaying(state): boolean
selectCurrentTime(state): number
selectVolume(state): number
selectPlaybackRate(state): number

// View selectors
selectContainerWidth(state): number
selectWaveformWidth(state): number
selectScrollLeft(state): number
selectMinPxPerSec(state): number

// Computed selectors
selectProgress(state): number  // currentTime / duration
selectIsScrollable(state): boolean
```

**Example:**
```javascript
import { selectProgress } from 'wavesurfer.js/state/selectors'

wavesurfer.state
  .select(selectProgress)
  .subscribe(progress => {
    console.log(`Progress: ${(progress * 100).toFixed(1)}%`)
  })
```

---

## Plugin API

### PluginManager

Manage plugin lifecycle.

```typescript
class PluginManager {
  async register(plugin: Plugin, context: PluginContext): Promise<RegisteredPlugin>
  async unregister(pluginId: string): Promise<void>
  async unregisterAll(): Promise<void>
  has(pluginId: string): boolean
  get(pluginId: string): RegisteredPlugin | undefined
  getAll(): RegisteredPlugin[]
  invoke<T>(pluginId: string, actionName: string, ...args: any[]): T
  getStream<T>(pluginId: string, streamName: string): Stream<T>
  get count(): number
}
```

**Example:**
```javascript
const manager = new PluginManager()

// Register plugin
const registered = await manager.register(
  MyPlugin({ option: 'value' }),
  context
)

// Check if registered
if (manager.has('my-plugin')) {
  // Invoke action
  const result = manager.invoke('my-plugin', 'doSomething', arg)

  // Get stream
  const stream = manager.getStream('my-plugin', 'data')
  stream.subscribe(value => console.log(value))
}

// Unregister
await manager.unregister('my-plugin')
```

---

### Creating Plugins

#### createPlugin()

Create a basic plugin.

```typescript
function createPlugin<TOptions, TInstance>(
  manifest: PluginManifest,
  initializer: (context: PluginContext, options: TOptions) => TInstance
): PluginFactory<TOptions>
```

**Example:**
```javascript
export const MyPlugin = createPlugin(
  {
    id: 'my-plugin',
    version: '1.0.0',
    description: 'My plugin'
  },
  (context, options) => {
    // Plugin code

    return {
      streams: { /* ... */ },
      actions: { /* ... */ }
    }
  }
)
```

#### PluginBuilder

Fluent API for building plugins.

```typescript
class PluginBuilder<TOptions> {
  setManifest(manifest: PluginManifest): this
  addStream<T>(name: string, initialValue?: T): this
  addAction(name: string, action: Function): this
  addProperty(name: string, value: unknown): this
  onInitialize(handler: Function): this
  onDestroyHandler(handler: Function): this
  build(): PluginFactory<TOptions>
}
```

**Example:**
```javascript
export const MyPlugin = new PluginBuilder()
  .setManifest({ id: 'my-plugin', version: '1.0.0' })
  .addStream('data', 0)
  .addAction('increment', () => { /* ... */ })
  .onInitialize((context, options) => {
    // Init code
  })
  .build()
```

#### createActionPlugin()

Create action-only plugin.

```typescript
function createActionPlugin<TOptions>(
  manifest: PluginManifest,
  actions: (context, options) => Record<string, Function>
): PluginFactory<TOptions>
```

#### createStreamPlugin()

Create stream-only plugin.

```typescript
function createStreamPlugin<TOptions>(
  manifest: PluginManifest,
  setup: (context, options) => Record<string, Stream<unknown>>
): PluginFactory<TOptions>
```

---

### Plugin Context

Context provided to plugins.

```typescript
interface PluginContext {
  // State management
  store: StateStore<WaveSurferState>

  // Resource cleanup
  resources: ResourcePool

  // DOM access
  container: HTMLElement
  getWrapper(): HTMLElement

  // Waveform controls
  getScroll(): number
  setScroll(pixels: number): void
  getWidth(): number

  // Audio data
  getDuration(): number
  getDecodedData(): AudioBuffer | null
  getMediaElement(): HTMLMediaElement
}
```

**Example:**
```javascript
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    // Access state
    const duration = context.getDuration()

    // Subscribe to state changes
    context.store
      .select(s => s.playback.currentTime)
      .subscribe(time => {
        console.log('Time:', time)
      })

    // Add DOM element
    const element = document.createElement('div')
    context.getWrapper().appendChild(element)

    // Cleanup
    context.resources.addCleanup(() => element.remove())

    return { /* ... */ }
  }
)
```

---

## Utility APIs

### ResourcePool

Automatic resource cleanup.

```typescript
class ResourcePool {
  add<T extends Resource>(resource: T): T
  addCleanup(cleanup: () => void | Promise<void>): void
  createScope(): ResourcePool
  async dispose(): Promise<void>
  get disposed(): boolean
}

interface Resource {
  dispose(): void | Promise<void>
}
```

**Example:**
```javascript
const resources = new ResourcePool()

// Add resource
const subscription = stream.subscribe(callback)
resources.add({
  dispose: () => subscription.unsubscribe()
})

// Add cleanup function
resources.addCleanup(() => {
  console.log('Cleaning up')
})

// Create scope
const scope = resources.createScope()
scope.addCleanup(() => console.log('Scope cleanup'))
await scope.dispose()

// Dispose all (LIFO order)
await resources.dispose()
```

---

### Error Handling

Type-safe error handling.

```typescript
enum ErrorCode {
  FETCH_ERROR = 'FETCH_ERROR',
  DECODE_ERROR = 'DECODE_ERROR',
  PLAYBACK_ERROR = 'PLAYBACK_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  INVALID_STATE = 'INVALID_STATE'
}

class WaveSurferError extends Error {
  readonly code: ErrorCode
  readonly context: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown>
  )
}

type Result<T, E = WaveSurferError> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

**Example:**
```javascript
import { withErrorBoundary, ErrorCode } from 'wavesurfer.js/utils/errors'

const result = await withErrorBoundary(
  async () => {
    return await fetchAudio(url)
  },
  ErrorCode.FETCH_ERROR,
  { url }
)

if (result.ok) {
  console.log('Success:', result.value)
} else {
  console.error('Error:', result.error.code, result.error.message)
}
```

---

### Pure Functions

Pure functions for calculations (in `core/` modules).

#### Waveform Functions

```typescript
// Calculate waveform dimensions
calculateWaveformDimensions(params: {
  duration: number
  minPxPerSec: number
  containerWidth: number
  fillParent: boolean
}): { width: number; isScrollable: boolean }

// Calculate progress
calculateProgress(currentTime: number, duration: number): number

// Calculate visible time range
calculateVisibleTimeRange(params: {
  scrollLeft: number
  containerWidth: number
  waveformWidth: number
  duration: number
}): { start: number; end: number }

// Time to pixels
timeToPixels(time: number, duration: number, width: number): number

// Pixels to time
pixelsToTime(pixels: number, duration: number, width: number): number
```

#### Audio Functions

```typescript
// Extract peaks from audio data
extractPeaks(params: {
  channelData: Float32Array
  maxLength: number
  precision?: number
}): number[]

// Normalize channel data
normalizeChannelData(channelData: Float32Array[]): Float32Array[]

// Apply fade in
applyFadeIn(
  channelData: Float32Array,
  fadeSamples: number
): Float32Array

// Apply fade out
applyFadeOut(
  channelData: Float32Array,
  fadeSamples: number
): Float32Array

// Merge channels to mono
mergeChannelsToMono(channels: Float32Array[]): Float32Array
```

**Example:**
```javascript
import { calculateProgress } from 'wavesurfer.js/core/waveform'
import { extractPeaks } from 'wavesurfer.js/core/audio'

const progress = calculateProgress(30, 100) // 0.3

const peaks = extractPeaks({
  channelData: audioBuffer.getChannelData(0),
  maxLength: 1000
})
```

---

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  WaveSurferOptions,
  WaveSurferState,
  PluginManifest,
  PluginContext,
  PluginInstance,
  Stream,
  Observer,
  Subscription
} from 'wavesurfer.js'
```

---

For more information, see:
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)
- [Examples](../../examples/)
