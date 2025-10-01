# WaveSurfer.js v8 Beta - Try It Now! 🎉

We're excited to announce the **beta release of WaveSurfer.js v8**! This major update brings modern features and improvements while maintaining **100% backward compatibility** with your existing code.

## 🚀 What's New

### Reactive Event Streams

Subscribe to events with powerful operators:

```javascript
// Old way (still works!)
wavesurfer.on('timeupdate', (time) => {
  console.log(time)
})

// New declarative way
wavesurfer.getEventStream('timeupdate')
  .debounce(100)
  .subscribe(time => {
    console.log(time)
  })
```

### Composable Stream Operators

Chain operations for cleaner code:

```javascript
// Only log when playing
wavesurfer.getEventStream('timeupdate')
  .filter(() => wavesurfer.isPlaying())
  .throttle(1000)
  .map(time => Math.floor(time))
  .distinct()
  .subscribe(time => {
    updateUI(time)
  })
```

### Reactive State Management

Access centralized state reactively:

```javascript
// Subscribe to state changes
wavesurfer.state
  .select(s => s.playback.currentTime)
  .subscribe(time => {
    updateProgressBar(time)
  })

// Combine multiple state values
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .subscribe(([time, duration]) => {
    const progress = (time / duration) * 100
    console.log(`${progress.toFixed(1)}%`)
  })
```

## ✅ Fully Backward Compatible

**Your existing code will work without any changes!**

```javascript
// This still works exactly as before
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple'
})

wavesurfer.load('audio.mp3')

wavesurfer.on('ready', () => {
  wavesurfer.play()
})

wavesurfer.on('pause', () => {
  console.log('Paused')
})
```

No breaking changes. No required migrations. Just new features when you want them.

## 🎯 Key Features

### Modern Architecture
- **Reactive streams** for elegant data flow
- **Immutable state** for predictable updates
- **Automatic cleanup** to prevent memory leaks
- **TypeScript** support throughout

### Better Performance
- **10-100x faster builds** (Vite instead of Rollup)
- **Optimized rendering** with stream-based updates
- **Efficient state management** with structural sharing
- **Zero runtime dependencies**

### Enhanced Developer Experience
- **Full TypeScript** types for better autocomplete
- **Stream operators** (map, filter, debounce, throttle, etc.)
- **State selectors** for reactive data access
- **Better error messages** with typed errors

## 📦 Installation

Try the beta now:

```bash
npm install wavesurfer.js@beta
```

Or with a CDN:

```html
<script src="https://unpkg.com/wavesurfer.js@beta"></script>
```

## 📚 Documentation

- **[Examples](../examples/)** - Live examples with the new features
- **[API Reference](./v8/API.md)** - Complete API documentation
- **[Plugin Development](./v8/PLUGIN_DEVELOPMENT_GUIDE.md)** - For plugin developers

## 🔥 Try These Examples

### Example 1: Debounced Progress Updates

```javascript
// Update UI only every 100ms instead of every frame
wavesurfer.getEventStream('timeupdate')
  .debounce(100)
  .subscribe(currentTime => {
    document.getElementById('time').textContent =
      formatTime(currentTime)
  })
```

### Example 2: Play/Pause State

```javascript
// Get playing state as a stream
wavesurfer.state
  .select(s => s.playback.isPlaying)
  .subscribe(isPlaying => {
    playButton.textContent = isPlaying ? 'Pause' : 'Play'
  })
```

### Example 3: Progress Bar

```javascript
// Calculate progress from state
wavesurfer.state
  .selectMany(
    s => s.playback.currentTime,
    s => s.audio.duration
  )
  .map(([time, duration]) => (time / duration) * 100)
  .subscribe(progress => {
    progressBar.style.width = `${progress}%`
  })
```

### Example 4: Take Only First Event

```javascript
// Run initialization code once
wavesurfer.getEventStream('ready')
  .take(1)
  .subscribe(() => {
    console.log('Waveform is ready!')
    initializeUI()
  })
```

## 🛠️ For Plugin Developers

We've completely redesigned the plugin system with a modern, composition-based architecture. If you maintain a plugin, check out the [Plugin Development Guide](./v8/PLUGIN_DEVELOPMENT_GUIDE.md).

**Note**: Old v7 plugins will continue to work during the transition period.

## 💬 Feedback

We'd love to hear your thoughts on v8!

- **Try it out** in your projects
- **Report issues** on [GitHub Issues](https://github.com/katspaugh/wavesurfer.js/issues)
- **Share your experience** - What do you like? What can we improve?
- **Ask questions** in [Discussions](https://github.com/katspaugh/wavesurfer.js/discussions)

## 🗺️ Roadmap to Stable

**Beta Phase (Now)**
- Gather feedback from the community
- Fix bugs and edge cases
- Refine APIs based on real-world usage

**Release Candidate**
- API freeze
- Final performance optimizations
- Complete migration guide

**Stable Release**
- v8 becomes the default version
- Long-term support

## ❓ FAQ

### Do I need to update my code?
**No!** v8 is 100% backward compatible. Your existing code will work without changes.

### What if I find a bug?
Please [open an issue](https://github.com/katspaugh/wavesurfer.js/issues) with details. We'll fix it quickly during the beta period.

### When will v8 be stable?
After we've gathered feedback and addressed any issues. We expect a few weeks to months depending on community feedback.

### Can I use v8 in production?
The beta is stable enough for testing, but we recommend waiting for the stable release for production apps. However, if you're starting a new project, v8 is a great choice!

### Will v7 be maintained?
Yes! v7 will continue to receive bug fixes until v8 is stable and widely adopted.

### Are there breaking changes?
**For end users**: No breaking changes. Your code will work as-is.

**For plugin developers**: The plugin API has changed, but old plugins continue to work with a compatibility layer.

## 🎁 What You Get

### Immediate Benefits (No Code Changes)
- ✅ Faster build times if you're building from source
- ✅ Better TypeScript types
- ✅ Improved memory management
- ✅ More predictable behavior

### Optional Enhancements (When You Want Them)
- ✅ Reactive streams for elegant code
- ✅ State management for complex apps
- ✅ Stream operators for data flow
- ✅ Modern plugin system

## 🙏 Thank You

A huge thank you to all contributors and the WaveSurfer.js community. Your feedback and support have been invaluable.

Special thanks to everyone who participated in v8 discussions and testing!

## 🚀 Get Started

```bash
npm install wavesurfer.js@beta
```

```javascript
import WaveSurfer from 'wavesurfer.js'

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'violet',
  progressColor: 'purple'
})

// Your existing code works!
wavesurfer.load('audio.mp3')
wavesurfer.on('ready', () => wavesurfer.play())

// Plus new features when you want them!
wavesurfer.getEventStream('timeupdate')
  .debounce(100)
  .subscribe(time => console.log(time))
```

**Happy coding! 🎵**

---

*WaveSurfer.js v8 - Modern, reactive, backward compatible*
