## WaveSurfer.js v8 - Plugin Development Guide

## Overview

WaveSurfer v8 introduces a completely new plugin architecture based on **composition over inheritance**. Plugins are now simple factory functions that return instances with streams and actions.

### Key Differences from v7

| v7 (Inheritance) | v8 (Composition) |
|------------------|------------------|
| Extend `BasePlugin` class | Return object with streams/actions |
| Access via `this.wavesurfer` | Receive `context` parameter |
| Manual cleanup | Automatic via `ResourcePool` |
| Event emitters | Reactive streams |
| Implicit lifecycle | Explicit initialization |

## Basic Plugin Structure

```typescript
import { createPlugin } from 'wavesurfer.js'

export const MyPlugin = createPlugin(
  {
    id: 'my-plugin',
    version: '1.0.0',
    description: 'My awesome plugin',
  },
  (context, options) => {
    // Plugin code here

    return {
      streams: { /* ... */ },
      actions: { /* ... */ },
    }
  }
)
```

## Plugin Context

Every plugin receives a `context` object with access to:

```typescript
interface PluginContext {
  // State management
  store: StateStore<WaveSurferState>

  // Resource cleanup
  resources: ResourcePool

  // DOM access
  container: HTMLElement
  getWrapper: () => HTMLElement

  // Waveform controls
  getScroll: () => number
  setScroll: (pixels: number) => void
  getWidth: () => number

  // Audio data
  getDuration: () => number
  getDecodedData: () => AudioBuffer | null
  getMediaElement: () => HTMLMediaElement
}
```

## Creating Plugins

### Method 1: Simple Plugin

```typescript
import { createPlugin, BehaviorSubject } from 'wavesurfer.js'

export const CounterPlugin = createPlugin<{ initialCount?: number }>(
  {
    id: 'counter',
    version: '1.0.0',
  },
  (context, options) => {
    const count = new BehaviorSubject(options?.initialCount ?? 0)

    function increment() {
      count.next(count.getValue() + 1)
    }

    function decrement() {
      count.next(count.getValue() - 1)
    }

    return {
      streams: { count },
      actions: { increment, decrement },
    }
  }
)

// Usage
const plugin = CounterPlugin({ initialCount: 10 })
```

### Method 2: Plugin Builder

```typescript
import { PluginBuilder } from 'wavesurfer.js'

export const MyPlugin = new PluginBuilder()
  .setManifest({
    id: 'my-plugin',
    version: '1.0.0',
  })
  .addStream('data', initialValue)
  .addAction('doSomething', (arg) => { /* ... */ })
  .addProperty('customProp', 'value')
  .onInitialize((context, options) => {
    // Initialization code
  })
  .onDestroyHandler(() => {
    // Cleanup code
  })
  .build()
```

### Method 3: Action-Only Plugin

```typescript
import { createActionPlugin } from 'wavesurfer.js'

export const UtilsPlugin = createActionPlugin(
  { id: 'utils', version: '1.0.0' },
  (context, options) => ({
    log: (msg: string) => console.log(msg),
    getDuration: () => context.getDuration(),
    formatTime: (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    },
  })
)
```

### Method 4: Stream-Only Plugin

```typescript
import { createStreamPlugin, Subject } from 'wavesurfer.js'

export const AnalyticsPlugin = createStreamPlugin(
  { id: 'analytics', version: '1.0.0' },
  (context, options) => {
    const events = new Subject<{ type: string; data: any }>()

    // Subscribe to playback changes
    context.store.select(s => s.playback.isPlaying)
      .subscribe(isPlaying => {
        events.next({ type: 'playback', data: { isPlaying } })
      })

    return { events }
  }
)
```

## Using Streams

Streams are the primary way to expose reactive data:

```typescript
import { createPlugin, BehaviorSubject, Subject } from 'wavesurfer.js'

export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    // BehaviorSubject - has current value
    const currentValue = new BehaviorSubject(0)

    // Subject - event stream
    const events = new Subject<string>()

    // Subscribe to state changes
    context.store.select(s => s.playback.currentTime)
      .subscribe(time => {
        events.next(`Time: ${time}`)
      })

    return {
      streams: {
        currentValue,
        events,
      },
      actions: {
        updateValue: (val: number) => currentValue.next(val),
        emit: (msg: string) => events.next(msg),
      },
    }
  }
)

// External usage
const plugin = await wavesurfer.registerPluginV8(MyPlugin())

// Subscribe to streams
plugin.streams.currentValue.subscribe(val => {
  console.log('Value:', val)
})

// Call actions
plugin.actions.updateValue(42)
```

## Resource Management

All cleanup is automatic via `ResourcePool`:

```typescript
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    // Add subscriptions
    const sub = context.store.subscribe(state => { /* ... */ })
    context.resources.add({ dispose: () => sub.unsubscribe() })

    // Add timers
    const timer = setInterval(() => { /* ... */ }, 1000)
    context.resources.addCleanup(() => clearInterval(timer))

    // Add DOM elements (automatic removal on dispose)
    const element = document.createElement('div')
    context.getWrapper().appendChild(element)
    context.resources.addCleanup(() => element.remove())

    // Add event listeners
    const handler = () => { /* ... */ }
    window.addEventListener('resize', handler)
    context.resources.addCleanup(() => {
      window.removeEventListener('resize', handler)
    })

    return { /* ... */ }
  }
)

// All resources cleaned up automatically when plugin is unregistered!
```

## Accessing State

Use the state store to react to changes:

```typescript
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    // Select specific state
    context.store.select(s => s.playback.isPlaying)
      .subscribe(isPlaying => {
        console.log('Playing:', isPlaying)
      })

    // Select multiple values
    context.store.selectMany(
      s => s.playback.currentTime,
      s => s.audio.duration
    ).subscribe(([time, duration]) => {
      console.log(`${time} / ${duration}`)
    })

    // Use operators
    context.store.select(s => s.playback.currentTime)
      .debounce(100)
      .map(time => formatTime(time))
      .subscribe(formattedTime => { /* ... */ })

    // Update state (if needed)
    context.store.update(state => ({
      ...state,
      plugins: {
        ...state.plugins,
        pluginData: {
          ...state.plugins.pluginData,
          myPlugin: { /* ... */ },
        },
      },
    }))

    return { /* ... */ }
  }
)
```

## Plugin Dependencies

Declare dependencies on other plugins:

```typescript
export const DependentPlugin = createPlugin(
  {
    id: 'dependent',
    version: '1.0.0',
    dependencies: ['regions', 'timeline'],  // Requires these plugins
  },
  (context) => {
    // This plugin will only load if regions and timeline are loaded

    return { /* ... */ }
  }
)
```

## Complete Example: Markers Plugin

```typescript
import { createPlugin, BehaviorSubject, createElement } from 'wavesurfer.js'

interface Marker {
  id: string
  time: number
  color: string
  label: string
}

interface MarkersPluginOptions {
  markers?: Marker[]
}

export const MarkersPlugin = createPlugin<MarkersPluginOptions>(
  {
    id: 'markers',
    version: '1.0.0',
    description: 'Add time markers to waveform',
  },
  (context, options) => {
    const { store, resources, getWrapper, getDuration } = context

    // State
    const markers = new BehaviorSubject<Marker[]>(options?.markers ?? [])

    // Container
    const container = createElement('div', {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      },
    })
    getWrapper().appendChild(container)
    resources.addCleanup(() => container.remove())

    // Render markers
    function render() {
      container.innerHTML = ''
      const duration = getDuration()
      if (duration === 0) return

      markers.getValue().forEach(marker => {
        const position = (marker.time / duration) * 100

        const el = createElement('div', {
          style: {
            position: 'absolute',
            left: `${position}%`,
            top: '0',
            height: '100%',
            width: '2px',
            backgroundColor: marker.color,
          },
        })

        const label = createElement('div', {
          style: {
            position: 'absolute',
            top: '5px',
            left: '5px',
            fontSize: '10px',
            color: marker.color,
            whiteSpace: 'nowrap',
            pointerEvents: 'all',
          },
        })
        label.textContent = marker.label
        el.appendChild(label)

        container.appendChild(el)
      })
    }

    // Re-render on state changes
    const sub = store.select(s => s.audio.duration)
      .subscribe(() => render())
    resources.add({ dispose: () => sub.unsubscribe() })

    // Re-render on markers change
    const markersSub = markers.subscribe(() => render())
    resources.add({ dispose: () => markersSub.unsubscribe() })

    // Actions
    function addMarker(marker: Omit<Marker, 'id'>): Marker {
      const newMarker = {
        ...marker,
        id: `marker-${Math.random().toString(32).slice(2)}`,
      }
      markers.next([...markers.getValue(), newMarker])
      return newMarker
    }

    function removeMarker(id: string) {
      markers.next(markers.getValue().filter(m => m.id !== id))
    }

    function clearMarkers() {
      markers.next([])
    }

    return {
      streams: { markers },
      actions: {
        addMarker,
        removeMarker,
        clearMarkers,
        render,
      },
    }
  }
)

export default MarkersPlugin
```

## Using Plugins

```typescript
import WaveSurfer from 'wavesurfer.js'
import { RegionsPlugin } from 'wavesurfer.js/plugins/regions'
import { TimelinePlugin } from 'wavesurfer.js/plugins/timeline'

// Create wavesurfer instance
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
})

// Register v8 plugins
const regions = await wavesurfer.registerPluginV8(
  RegionsPlugin({ dragSelection: true })
)

const timeline = await wavesurfer.registerPluginV8(
  TimelinePlugin({ height: 30 })
)

// Access plugin streams
regions.streams.regions.subscribe(regions => {
  console.log('Regions:', regions)
})

// Call plugin actions
regions.actions.addRegion({
  start: 10,
  end: 20,
  color: 'rgba(255, 0, 0, 0.3)',
})

// Get plugin by ID
const regionsPlugin = wavesurfer.getPluginV8('regions')
if (regionsPlugin) {
  regionsPlugin.actions.addRegion({ start: 30, end: 40 })
}

// Unregister plugin
await wavesurfer.unregisterPluginV8('regions')
```

## Testing Plugins

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MarkersPlugin } from './markers-plugin'
import { createStore, createInitialState, ResourcePool } from 'wavesurfer.js'

describe('MarkersPlugin', () => {
  it('should add markers', () => {
    const store = createStore(createInitialState())
    const resources = new ResourcePool()

    const context = {
      store,
      resources,
      container: document.createElement('div'),
      getWrapper: () => document.createElement('div'),
      getScroll: () => 0,
      setScroll: () => {},
      getWidth: () => 1000,
      getDuration: () => 100,
      getDecodedData: () => null,
      getMediaElement: () => document.createElement('audio'),
    }

    const plugin = MarkersPlugin()
    const instance = await plugin.initialize(context)

    // Add marker
    const marker = instance.actions.addMarker({
      time: 10,
      color: '#f00',
      label: 'Test',
    })

    expect(marker.id).toBeDefined()
    expect(marker.time).toBe(10)

    // Check stream
    let markers: any[] = []
    instance.streams.markers.subscribe(m => markers = m)
    expect(markers).toHaveLength(1)

    // Cleanup
    await resources.dispose()
  })
})
```

## Migration from v7

### v7 Plugin

```typescript
class MyPlugin extends BasePlugin {
  onInit() {
    this.wavesurfer.on('ready', () => {
      console.log('ready')
    })
  }

  destroy() {
    // Manual cleanup
  }
}
```

### v8 Plugin

```typescript
export const MyPlugin = createPlugin(
  { id: 'my-plugin', version: '1.0.0' },
  (context) => {
    // Subscribe to state instead
    context.store.select(s => s.audio.duration)
      .filter(duration => duration > 0)
      .subscribe(() => {
        console.log('ready')
      })

    // Cleanup is automatic!

    return { /* ... */ }
  }
)
```

## Best Practices

1. **Use Streams for Reactive Data**
   ```typescript
   const data = new BehaviorSubject(initialValue)
   return { streams: { data } }
   ```

2. **Always Clean Up Resources**
   ```typescript
   context.resources.addCleanup(() => { /* cleanup */ })
   ```

3. **Type Your Options**
   ```typescript
   interface MyPluginOptions {
     color: string
     enabled: boolean
   }
   createPlugin<MyPluginOptions>(...)
   ```

4. **Use Selectors**
   ```typescript
   context.store.select(selectors.selectIsPlaying)
   ```

5. **Debounce Expensive Operations**
   ```typescript
   context.store.select(s => s.view.scrollLeft)
     .debounce(100)
     .subscribe(render)
   ```

6. **Document Your Plugin**
   ```typescript
   {
     id: 'my-plugin',
     version: '1.0.0',
     description: 'Clear description of what it does',
     author: 'Your Name',
   }
   ```

## Conclusion

The v8 plugin system is:
- **Simpler**: No inheritance, just functions
- **Type-safe**: Full TypeScript support
- **Composable**: Combine plugins easily
- **Automatic**: Resource cleanup handled for you
- **Reactive**: Built on streams for reactivity

Happy plugin development! 🎉
