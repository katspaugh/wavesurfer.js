# WaveSurfer.js v8

> Modern, reactive audio visualization library

## Installation

```bash
npm install wavesurfer.js
```

## Quick Start

```javascript
import WaveSurfer from 'wavesurfer.js'

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple'
})

wavesurfer.load('audio.mp3')

wavesurfer.on('ready', () => {
  wavesurfer.play()
})
```

## What's New in v8

### Reactive Event Streams

Subscribe to events with powerful operators for cleaner, more maintainable code:

```javascript
// Debounce updates to improve performance
wavesurfer.getEventStream('timeupdate')
  .debounce(100)
  .subscribe(time => {
    updateUI(time)
  })

// Chain operations together
wavesurfer.getEventStream('ready')
  .take(1)
  .subscribe(() => {
    console.log('Ready to play!')
  })
```

### State Management

Access and react to application state changes:

```javascript
// Subscribe to playing state
wavesurfer.state
  .select(s => s.playback.isPlaying)
  .subscribe(isPlaying => {
    button.textContent = isPlaying ? 'Pause' : 'Play'
  })

// Combine multiple state values
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .subscribe(([time, duration]) => {
    const progress = (time / duration) * 100
    updateProgress(progress)
  })
```

### Stream Operators

Powerful operators for data transformation:

- **`map(fn)`** - Transform values
- **`filter(fn)`** - Filter values
- **`debounce(ms)`** - Debounce updates
- **`throttle(ms)`** - Throttle updates
- **`distinct()`** - Only emit unique values
- **`take(n)`** - Take first n emissions
- **`takeUntil(notifier)`** - Take until another stream emits

```javascript
// Complex example: Update UI at most once per second, only while playing
wavesurfer.getEventStream('timeupdate')
  .filter(() => wavesurfer.isPlaying())
  .throttle(1000)
  .map(time => Math.floor(time))
  .distinct()
  .subscribe(time => {
    console.log(`Second ${time}`)
  })
```

## Classic API (Still Supported)

All your existing code continues to work:

```javascript
// Events
wavesurfer.on('ready', () => console.log('Ready'))
wavesurfer.on('play', () => console.log('Playing'))
wavesurfer.on('pause', () => console.log('Paused'))

// Playback
wavesurfer.play()
wavesurfer.pause()
wavesurfer.stop()
wavesurfer.setTime(30) // seek to 30 seconds

// Properties
wavesurfer.setVolume(0.5)
wavesurfer.setPlaybackRate(1.5)
wavesurfer.zoom(100)
```

## Examples

### Basic Usage

```javascript
import WaveSurfer from 'wavesurfer.js'

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#4F4A85',
  progressColor: '#383351',
  height: 128
})

// Load audio
wavesurfer.load('audio.mp3')

// Play/pause on click
document.querySelector('#play').addEventListener('click', () => {
  wavesurfer.playPause()
})
```

### With Reactive Streams

```javascript
// Update time display
wavesurfer.getEventStream('timeupdate')
  .debounce(100)
  .subscribe(currentTime => {
    document.querySelector('#time').textContent =
      formatTime(currentTime)
  })

// Update play button
wavesurfer.state
  .select(s => s.playback.isPlaying)
  .subscribe(isPlaying => {
    document.querySelector('#play').textContent =
      isPlaying ? '⏸️' : '▶️'
  })

// Show loading progress
wavesurfer.getEventStream('loading')
  .subscribe(percent => {
    document.querySelector('#loading').textContent =
      `Loading... ${percent}%`
  })

// Hide loading when ready
wavesurfer.getEventStream('ready')
  .take(1)
  .subscribe(() => {
    document.querySelector('#loading').style.display = 'none'
  })
```

### Progress Bar

```javascript
// Calculate and update progress
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .map(([time, duration]) => {
    if (duration === 0) return 0
    return (time / duration) * 100
  })
  .subscribe(progress => {
    document.querySelector('#progress').style.width =
      `${progress}%`
  })
```

## Configuration Options

```javascript
WaveSurfer.create({
  // Required
  container: '#waveform',

  // Waveform style
  waveColor: '#999',
  progressColor: '#555',
  cursorColor: '#333',
  cursorWidth: 1,
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  height: 128,

  // Behavior
  interact: true,
  hideScrollbar: false,
  autoplay: false,
  autoCenter: true,
  autoScroll: true,

  // Rendering
  normalize: false,
  splitChannels: false,
  fillParent: true,
  minPxPerSec: 50,

  // Backend
  backend: 'WebAudio', // or 'MediaElement'
  media: existingAudioElement
})
```

## Available Events

| Event | Description |
|-------|-------------|
| `ready` | Waveform is ready for playback |
| `load` | Audio loading started |
| `loading` | Loading progress (percent) |
| `decode` | Audio decoding started |
| `play` | Playback started |
| `pause` | Playback paused |
| `finish` | Playback finished |
| `timeupdate` | Current time changed |
| `audioprocess` | While playing (high frequency) |
| `seeking` | Seeking started |
| `zoom` | Zoom level changed |
| `error` | Error occurred |

## Methods

```javascript
// Playback
wavesurfer.play()
wavesurfer.pause()
wavesurfer.stop()
wavesurfer.playPause()
wavesurfer.setTime(seconds)
wavesurfer.skip(seconds)
wavesurfer.seekTo(0.5) // 0 to 1

// Audio properties
wavesurfer.setVolume(0.5)
wavesurfer.setPlaybackRate(1.5)
wavesurfer.getVolume()
wavesurfer.getDuration()
wavesurfer.getCurrentTime()
wavesurfer.isPlaying()

// Visualization
wavesurfer.zoom(pxPerSec)
wavesurfer.setHeight(pixels)
wavesurfer.getWidth()
wavesurfer.getHeight()

// Loading
wavesurfer.load(url)
wavesurfer.loadBlob(blob)

// Export
wavesurfer.exportImage()
wavesurfer.exportPCM()

// Lifecycle
wavesurfer.empty()
wavesurfer.destroy()
```

## Plugins

WaveSurfer.js supports plugins for extended functionality. See the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) for details.

### Popular Plugins

- **Regions** - Visual markers for audio sections
- **Timeline** - Time labels below waveform
- **Minimap** - Overview of the entire waveform
- **Spectrogram** - Frequency visualization

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import WaveSurfer, { WaveSurferOptions } from 'wavesurfer.js'
import type { Stream } from 'wavesurfer.js/streams'

const options: WaveSurferOptions = {
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple'
}

const wavesurfer = WaveSurfer.create(options)
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## License

MIT License - see [LICENSE](../LICENSE) file for details

## Links

- **[GitHub](https://github.com/katspaugh/wavesurfer.js)**
- **[Examples](../examples/)**
- **[API Reference](./API.md)**
- **[Plugin Development](./PLUGIN_DEVELOPMENT_GUIDE.md)**

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and guidelines.

For plugin developers, see the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) for the new plugin architecture.

---

**WaveSurfer.js v8** - Modern, reactive, backward compatible 🎵
