# WaveSurfer.js v7 → v8 Migration Guide

## Overview

WaveSurfer.js v8 introduces significant architectural improvements while maintaining backward compatibility for most use cases. This guide will help you migrate from v7 to v8.

## Quick Start

### Installation

```bash
npm install wavesurfer.js@8
```

### Breaking Changes Summary

1. **Plugin System**: New composition-based architecture (v7 plugins still work with compatibility layer)
2. **Event System**: Classic `.on()` API maintained, new reactive streams added
3. **State Management**: Centralized immutable state (internal change, minimal API impact)
4. **Build System**: Switched from Rollup to Vite (faster builds, better DX)

### Minimal Changes Required

Most v7 code will continue to work:

```javascript
// This still works in v8!
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple'
})

wavesurfer.load('audio.mp3')

wavesurfer.on('ready', () => {
  console.log('Ready!')
})

wavesurfer.on('play', () => {
  console.log('Playing')
})
```

## Migration Paths

### Level 1: No Changes Required

**Who**: Users of the basic API (create, load, play, pause, events)

**What to do**: Nothing! Your code should work as-is.

**Example**:
```javascript
// v7 code - works in v8
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple',
  backend: 'WebAudio'
})

wavesurfer.load('audio.mp3')
wavesurfer.on('ready', () => wavesurfer.play())
```

### Level 2: Optional Enhancements

**Who**: Users who want to leverage new v8 features

**What to do**: Gradually adopt streams, state management, and new APIs

**Example**:
```javascript
// v8 enhanced - use reactive streams
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple'
})

// Use streams instead of events (optional)
wavesurfer.getEventStream('ready')
  .subscribe(() => {
    console.log('Ready!')
    wavesurfer.play()
  })

// React to state changes
wavesurfer.state
  .select(s => s.playback.isPlaying)
  .subscribe(isPlaying => {
    console.log('Playing:', isPlaying)
  })

// Combine multiple state slices
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .subscribe(([currentTime, duration]) => {
    const progress = (currentTime / duration) * 100
    console.log(`Progress: ${progress.toFixed(1)}%`)
  })
```

### Level 3: Plugin Migration

**Who**: Plugin developers

**What to do**: Migrate to composition-based plugin architecture

See [Plugin Migration](#plugin-migration) section below.

## API Changes

### No Changes (Fully Compatible)

These APIs work exactly the same in v8:

- `WaveSurfer.create(options)`
- `.load(url)`, `.loadBlob(blob)`, `.loadDecodedBuffer(buffer)`
- `.play()`, `.pause()`, `.stop()`, `.setTime(seconds)`
- `.on(event, callback)`, `.un(event, callback)`, `.once(event, callback)`
- `.setVolume(volume)`, `.setPlaybackRate(rate)`
- `.zoom(pixels)`, `.seekTo(progress)`
- `.exportImage()`, `.exportPCM()`
- `.getDuration()`, `.getCurrentTime()`
- `.getWidth()`, `.getHeight()`, `.setHeight(height)`

### Deprecated (Still Work, But Discouraged)

None yet - v8 maintains full backward compatibility.

### New APIs

#### Reactive Streams

```javascript
// Get event as a stream
const readyStream = wavesurfer.getEventStream('ready')
readyStream.subscribe(() => console.log('Ready!'))

// Get event values (first argument only)
const timeStream = wavesurfer.getEventValue('timeupdate')
timeStream
  .debounce(100)
  .subscribe(currentTime => {
    console.log('Time:', currentTime)
  })
```

#### State Management

```javascript
// Access centralized state
const state = wavesurfer.state.snapshot

// Select specific state slice
wavesurfer.state
  .select(s => s.playback.currentTime)
  .subscribe(time => console.log('Time:', time))

// Select multiple slices
wavesurfer.state
  .selectMany(
    s => s.playback.isPlaying,
    s => s.playback.currentTime
  )
  .subscribe(([isPlaying, currentTime]) => {
    console.log('Playing:', isPlaying, 'Time:', currentTime)
  })
```

#### Resource Management

```javascript
// Manual resource cleanup (optional)
const resources = new ResourcePool()

// Add cleanup functions
resources.addCleanup(() => {
  console.log('Cleaning up')
})

// Dispose all resources
await resources.dispose()
```

## Plugin Migration

### v7 Plugin Structure

```javascript
// v7 plugin
class RegionsPlugin extends BasePlugin {
  constructor(wavesurfer, options) {
    super(wavesurfer, options)
    this.regions = []
  }

  onInit() {
    this.wavesurfer.on('ready', () => {
      this.render()
    })
  }

  addRegion(params) {
    const region = new Region(params)
    this.regions.push(region)
    this.emit('region-added', region)
    return region
  }

  destroy() {
    this.regions.forEach(r => r.destroy())
    super.destroy()
  }
}

// v7 usage
const regions = wavesurfer.addPlugin(RegionsPlugin.create({
  dragSelection: true
}))
```

### v8 Plugin Structure

```javascript
// v8 plugin
import { createPlugin } from 'wavesurfer.js/plugins-v8'
import { BehaviorSubject } from 'wavesurfer.js/streams'

export const RegionsPlugin = createPlugin(
  {
    id: 'regions',
    version: '8.0.0',
    description: 'Visual overlays for audio regions'
  },
  (context, options) => {
    // Reactive state
    const regionsSubject = new BehaviorSubject([])
    let regions = []

    // Subscribe to ready state
    context.store
      .select(s => s.audio.duration)
      .filter(duration => duration > 0)
      .subscribe(() => render())

    function addRegion(params) {
      const region = createRegion(params)
      regions.push(region)
      regionsSubject.next([...regions])
      return region
    }

    // Automatic cleanup
    context.resources.addCleanup(() => {
      regions.forEach(r => r.element?.remove())
    })

    return {
      streams: {
        regions: regionsSubject
      },
      actions: {
        addRegion,
        getRegions: () => [...regions],
        clearRegions: () => {
          regions.forEach(r => r.remove())
          regions = []
          regionsSubject.next([])
        }
      }
    }
  }
)

// v8 usage
import { RegionsPlugin } from 'wavesurfer.js/plugins-v8'

const manager = wavesurfer.getPluginManager()
const regions = await manager.register(
  RegionsPlugin({ dragSelection: true }),
  context
)

// Subscribe to changes
regions.instance.streams.regions.subscribe(regions => {
  console.log('Regions:', regions)
})

// Call actions
regions.instance.actions.addRegion({
  start: 10,
  end: 20,
  color: 'rgba(255, 0, 0, 0.3)'
})
```

### Key Differences

| Aspect | v7 | v8 |
|--------|----|----|
| Base Class | `extends BasePlugin` | Factory function |
| Lifecycle | `onInit()`, `destroy()` | `initialize()` callback |
| State | `this.wavesurfer` | `context.store` |
| Events | `this.emit()`, `this.on()` | Reactive streams |
| Cleanup | Manual in `destroy()` | Automatic via `ResourcePool` |
| Access | `this.regions` | Return object with streams/actions |
| Dependencies | Implicit | Explicit in manifest |

### Plugin Creation Helpers

v8 provides 4 different ways to create plugins:

#### 1. Basic Plugin (Full Control)

```javascript
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context, options) => {
    // Full control over initialization

    return {
      streams: { /* ... */ },
      actions: { /* ... */ }
    }
  }
)
```

#### 2. Plugin Builder (Fluent API)

```javascript
export const MyPlugin = new PluginBuilder()
  .setManifest({ id: 'my-plugin', version: '1.0.0' })
  .addStream('data', initialValue)
  .addAction('doSomething', (arg) => { /* ... */ })
  .onInitialize((context, options) => {
    // Initialization code
  })
  .onDestroyHandler(() => {
    // Cleanup code
  })
  .build()
```

#### 3. Action-Only Plugin

```javascript
export const UtilsPlugin = createActionPlugin(
  { id: 'utils', version: '1.0.0' },
  (context, options) => ({
    formatTime: (seconds) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    },
    getDuration: () => context.getDuration()
  })
)
```

#### 4. Stream-Only Plugin

```javascript
export const AnalyticsPlugin = createStreamPlugin(
  { id: 'analytics', version: '1.0.0' },
  (context, options) => {
    const events = new Subject()

    context.store
      .select(s => s.playback.isPlaying)
      .subscribe(isPlaying => {
        events.next({ type: 'playback', data: { isPlaying } })
      })

    return { events }
  }
)
```

## Common Migration Patterns

### Pattern 1: Event Listeners → Streams

```javascript
// v7
wavesurfer.on('audioprocess', (currentTime) => {
  updateProgressBar(currentTime)
})

// v8 (option 1: still works)
wavesurfer.on('audioprocess', (currentTime) => {
  updateProgressBar(currentTime)
})

// v8 (option 2: streams)
wavesurfer.getEventValue('audioprocess')
  .debounce(100)
  .subscribe(currentTime => {
    updateProgressBar(currentTime)
  })

// v8 (option 3: state)
wavesurfer.state
  .select(s => s.playback.currentTime)
  .debounce(100)
  .subscribe(currentTime => {
    updateProgressBar(currentTime)
  })
```

### Pattern 2: Manual Cleanup → Automatic

```javascript
// v7
class MyPlugin extends BasePlugin {
  onInit() {
    this.timer = setInterval(() => {
      // Do something
    }, 1000)
  }

  destroy() {
    clearInterval(this.timer)
    super.destroy()
  }
}

// v8
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    const timer = setInterval(() => {
      // Do something
    }, 1000)

    // Cleanup happens automatically
    context.resources.addCleanup(() => clearInterval(timer))

    return { /* ... */ }
  }
)
```

### Pattern 3: State Access

```javascript
// v7
class MyPlugin extends BasePlugin {
  onInit() {
    const duration = this.wavesurfer.getDuration()
    const currentTime = this.wavesurfer.getCurrentTime()
  }
}

// v8
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    // Direct access
    const duration = context.getDuration()

    // Or via state
    const state = context.store.snapshot
    const duration = state.audio.duration
    const currentTime = state.playback.currentTime

    // Or reactive
    context.store
      .select(s => s.audio.duration)
      .subscribe(duration => {
        console.log('Duration:', duration)
      })

    return { /* ... */ }
  }
)
```

### Pattern 4: DOM Manipulation

```javascript
// v7
class MyPlugin extends BasePlugin {
  onInit() {
    this.container = document.createElement('div')
    this.wavesurfer.drawer.wrapper.appendChild(this.container)
  }

  destroy() {
    this.container.remove()
    super.destroy()
  }
}

// v8
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    const container = document.createElement('div')
    context.getWrapper().appendChild(container)

    // Automatic cleanup
    context.resources.addCleanup(() => container.remove())

    return { /* ... */ }
  }
)
```

## Testing Changes

### v7 Testing

```javascript
// v7
describe('MyPlugin', () => {
  let wavesurfer
  let plugin

  beforeEach(() => {
    wavesurfer = WaveSurfer.create({ container: '#waveform' })
    plugin = wavesurfer.addPlugin(MyPlugin.create())
  })

  it('should work', () => {
    expect(plugin).toBeDefined()
  })
})
```

### v8 Testing

```javascript
// v8
import { describe, it, expect, beforeEach } from 'vitest'
import { MyPlugin } from './my-plugin'
import { createStore, createInitialState } from 'wavesurfer.js/state'
import { ResourcePool } from 'wavesurfer.js/utils'

describe('MyPlugin', () => {
  let context

  beforeEach(() => {
    const store = createStore(createInitialState())
    const resources = new ResourcePool()

    context = {
      store,
      resources,
      container: document.createElement('div'),
      getWrapper: () => document.createElement('div'),
      getScroll: () => 0,
      setScroll: () => {},
      getWidth: () => 1000,
      getDuration: () => 100,
      getDecodedData: () => null,
      getMediaElement: () => document.createElement('audio')
    }
  })

  it('should initialize', async () => {
    const plugin = MyPlugin({ option: 'value' })
    const instance = await plugin.initialize(context)

    expect(instance.actions).toBeDefined()
  })

  it('should cleanup', async () => {
    const plugin = MyPlugin()
    await plugin.initialize(context)

    // Should not throw
    await context.resources.dispose()
  })
})
```

## Performance Improvements

### v8 Performance Benefits

1. **Immutable State**: Predictable updates, easier to optimize
2. **Stream Debouncing**: Built-in operators reduce unnecessary updates
3. **Resource Pooling**: Efficient cleanup prevents memory leaks
4. **Pure Functions**: Easier to optimize, test, and reason about
5. **Vite Build**: 10-100x faster builds than Rollup

### Performance Tips

```javascript
// Debounce frequent updates
wavesurfer.state
  .select(s => s.playback.currentTime)
  .debounce(100) // Only emit once per 100ms
  .subscribe(updateUI)

// Throttle expensive operations
wavesurfer.getEventValue('audioprocess')
  .throttle(16) // ~60fps
  .subscribe(updateWaveform)

// Combine multiple values efficiently
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .distinct() // Only emit when values change
  .subscribe(([time, duration]) => {
    updateProgress(time, duration)
  })

// Take limited values
wavesurfer.getEventValue('ready')
  .take(1) // Only first emission
  .subscribe(initialize)
```

## Troubleshooting

### Issue: Plugin Not Working

**v7 Plugin**: Check if compatibility layer is loaded
**v8 Plugin**: Verify manifest and initialize function

```javascript
// Check plugin registration
const has = manager.has('my-plugin')
console.log('Plugin registered:', has)

// Check plugin instance
const plugin = manager.get('my-plugin')
console.log('Plugin:', plugin)
```

### Issue: Memory Leaks

**Solution**: Use ResourcePool for all cleanup

```javascript
// Bad - manual cleanup required
const subscription = stream.subscribe(callback)
// Forgot to unsubscribe!

// Good - automatic cleanup
context.resources.add({
  dispose: () => subscription.unsubscribe()
})
```

### Issue: TypeScript Errors

**Solution**: Update type imports

```javascript
// v7
import WaveSurfer from 'wavesurfer.js'

// v8
import WaveSurfer from 'wavesurfer.js'
import type { WaveSurferOptions } from 'wavesurfer.js/types'
import type { Stream } from 'wavesurfer.js/streams'
```

## FAQ

### Q: Do I need to rewrite all my code?

**A**: No! v8 maintains backward compatibility. The classic API still works.

### Q: Can I use v7 and v8 plugins together?

**A**: Yes, with the compatibility layer. But consider migrating v7 plugins to v8 for better performance and type safety.

### Q: Are there breaking changes?

**A**: Minimal. The core API is unchanged. Plugin developers need to migrate to the new architecture.

### Q: When should I migrate?

**A**: Start with new projects. Migrate existing projects gradually by adopting new features incrementally.

### Q: How do I migrate a complex plugin?

**A**: Start with the plugin structure, then migrate features one at a time. Use the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) for reference.

### Q: What about performance?

**A**: v8 is faster due to immutable state, stream operators, and better build system. No regressions expected.

## Next Steps

1. **Read the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)** for detailed plugin migration
2. **Check the [API Documentation](./API.md)** for complete API reference
3. **See [Examples](../../examples/)** for working code samples
4. **Join the community** for help and discussions

## Resources

- [WaveSurfer.js v8 Documentation](https://wavesurfer.xyz/docs/v8)
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md)
- [API Reference](./API.md)
- [GitHub Repository](https://github.com/katspaugh/wavesurfer.js)
- [Examples](../../examples/)

---

**Questions or issues?** [Open an issue](https://github.com/katspaugh/wavesurfer.js/issues) on GitHub.
