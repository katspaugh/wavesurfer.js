# <img src="https://user-images.githubusercontent.com/381895/226091100-f5567a28-7736-4d37-8f84-e08f297b7e1a.png" alt="logo" height="60" valign="middle" /> wavesurfer.js

[![npm](https://img.shields.io/npm/v/wavesurfer.js)](https://www.npmjs.com/package/wavesurfer.js) [![sponsor](https://img.shields.io/badge/sponsor_us-🤍-%23B14586)](https://github.com/sponsors/katspaugh)

**Wavesurfer.js** is an interactive waveform rendering and audio playback library, perfect for web applications. It leverages modern web technologies to provide a robust and visually engaging audio experience.

<img width="626" alt="waveform screenshot" src="https://github.com/katspaugh/wavesurfer.js/assets/381895/05f03bed-800e-4fa1-b09a-82a39a1c62ce">

**Gold sponsor 💖** [Closed Caption Creator](https://www.closedcaptioncreator.com)

> **🎉 v8 Beta Available!** Try the new reactive streams and state management features. [Learn more →](docs/BETA_ANNOUNCEMENT.md)

# Table of contents

1. [Getting started](#getting-started)
2. [What's new in v8](#whats-new-in-v8)
3. [API reference](#api-reference)
4. [Plugins](#plugins)
5. [CSS styling](#css-styling)
6. [Frequent questions](#questions)
7. [Contributing](#contributing)
8. [Tests](#tests)
9. [Feedback](#feedback)

## Getting started

Install and import the package:

```bash
npm install wavesurfer.js
```

```js
import WaveSurfer from 'wavesurfer.js'
```

Alternatively, insert a UMD script tag which exports the library as a global `WaveSurfer` variable:
```html
<script src="https://unpkg.com/wavesurfer.js@7"></script>
```

Create a wavesurfer instance and pass various [options](http://wavesurfer.xyz/docs/options):
```js
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#4F4A85',
  progressColor: '#383351',
  url: '/audio.mp3',
})

// Subscribe to events
wavesurfer.on('ready', () => {
  wavesurfer.play()
})
```

TypeScript types are included in the package, so there's no need to install `@types/wavesurfer.js`.

See more [examples](https://wavesurfer.xyz/examples).

## What's new in v8

**v8 is 100% backward compatible** – your existing code works without changes!

### Reactive Event Streams

Subscribe to events with powerful stream operators:

```js
// Debounce time updates for better performance
wavesurfer.getEventStream('timeupdate')
  .debounce(100)
  .subscribe(time => {
    updateUI(time)
  })

// Chain multiple operators
wavesurfer.getEventStream('timeupdate')
  .filter(() => wavesurfer.isPlaying())
  .throttle(1000)
  .map(time => Math.floor(time))
  .distinct()
  .subscribe(time => {
    console.log(`Second ${time}`)
  })
```

### State Management

React to application state changes:

```js
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
    updateProgressBar(progress)
  })
```

### Available Stream Operators

- **`map(fn)`** – Transform values
- **`filter(fn)`** – Filter values
- **`debounce(ms)`** – Debounce updates
- **`throttle(ms)`** – Throttle updates
- **`distinct()`** – Only emit unique values
- **`take(n)`** – Take first n emissions
- **`takeUntil(notifier)`** – Take until another stream emits

**Try the beta:**
```bash
npm install wavesurfer.js@beta
```

**Learn more:**
- [Beta Announcement](docs/BETA_ANNOUNCEMENT.md) – What's new and how to try it
- [User Guide](docs/v8/USER_README.md) – Complete v8 documentation
- [Migration Guide](docs/v8/MIGRATION_GUIDE.md) – Upgrading from v7 (if you want to)

## API reference

See the wavesurfer.js documentation on our website:

 * [methods](https://wavesurfer.xyz/docs/methods)
 * [options](http://wavesurfer.xyz/docs/options)
 * [events](http://wavesurfer.xyz/docs/events)

For v8 features, see the [v8 API Reference](docs/v8/API.md).

## Plugins

We maintain a number of official plugins that add various extra features:

 * [Regions](https://wavesurfer.xyz/examples/?regions.js) – visual overlays and markers for regions of audio
 * [Timeline](https://wavesurfer.xyz/examples/?timeline.js) – displays notches and time labels below the waveform
 * [Minimap](https://wavesurfer.xyz/examples/?minimap.js) – a small waveform that serves as a scrollbar for the main waveform
 * [Envelope](https://wavesurfer.xyz/examples/?envelope.js) – a graphical interface to add fade-in and -out effects and control volume
 * [Record](https://wavesurfer.xyz/examples/?record.js) – records audio from the microphone and renders a waveform
 * [Spectrogram](https://wavesurfer.xyz/examples/?spectrogram.js) – visualization of an audio frequency spectrum (written by @akreal)
 * [Hover](https://wavesurfer.xyz/examples/?hover.js) – shows a vertical line and timestamp on waveform hover

To import a plugin (v7):
```js
import Regions from 'wavesurfer.js/dist/plugins/regions.esm.js'
```

Or as a script tag:
```html
<script src="https://unpkg.com/wavesurfer.js@7/dist/plugins/regions.min.js"></script>
```

## CSS styling

wavesurfer.js v7 is rendered into a Shadow DOM tree. This isolates its CSS from the rest of the web page.
However, it's still possible to style various wavesurfer.js elements with CSS via the `::part()` pseudo-selector.
For example:

```css
#waveform ::part(cursor):before {
  content: '🏄';
}
#waveform ::part(region) {
  font-family: fantasy;
}
```

You can see which elements you can style in the DOM inspector – they will have a `part` attribute.
See [this example](https://wavesurfer.xyz/examples/?styling.js) to play around with styling.

## Questions

Have a question about integrating wavesurfer.js on your website? Feel free to ask in our [Discussions forum](https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a).

However, please keep in mind that this forum is dedicated to wavesurfer-specific questions. If you're new to JavaScript and need help with the general basics like importing NPM modules, please consider asking ChatGPT or StackOverflow first.

### FAQ

<details>
  <summary>I'm having CORS issues</summary>
  Wavesurfer fetches audio from the URL you specify in order to decode it. Make sure this URL allows fetching data from your domain. In browser JavaScript, you can only fetch data either from <b>the same domain</b> or another domain if and only if that domain enables <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS">CORS</a>. So if your audio file is on an external domain, make sure that domain sends the right Access-Control-Allow-Origin headers. There's nothing you can do about it from the requesting side (i.e. your JS code).
</details>

<details>
  <summary>Does wavesurfer support large files?</summary>
  Since wavesurfer decodes audio entirely in the browser using Web Audio, large clips may fail to decode due to memory constraints. We recommend using pre-decoded peaks for large files (see <a href="https://wavesurfer.xyz/examples/?predecoded.js">this example</a>). You can use a tool like <a href="https://github.com/bbc/audiowaveform">bbc/audiowaveform</a> to generate peaks.
</details>

<details>
  <summary>What about streaming audio?</summary>
  Streaming audio is supported only with <a href="https://wavesurfer.xyz/examples/?predecoded.js">pre-decoded peaks and duration</a>.
</details>

<details>
  <summary>There is a mismatch between my audio and the waveform. How do I fix it?</summary>
  If you're using a VBR (variable bit rate) audio file, there might be a mismatch between the audio and the waveform. This can be fixed by converting your file to CBR (constant bit rate).
  <p>Alternatively, you can use the <a href="https://wavesurfer.xyz/examples/?webaudio-shim.js">Web Audio shim</a> which is more accurate.</p>
</details>

<details>
  <summary>How do I connect wavesurfer.js to Web Audio effects?</summary>
  Generally, wavesurfer.js doesn't aim to be a wrapper for all things Web Audio. It's just a player with a waveform visualization. It does allow connecting itself to a Web Audio graph by exporting its audio element (see <a href="https://wavesurfer.xyz/examples/?4436ec40a2ab943243755e659ae32196">this example</a>) but nothing more than that. Please don't expect wavesurfer to be able to cut, add effects, or process your audio in any way.
</details>

## Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

This command will start the Vite dev server with live reload at http://localhost:5173.

3. Run tests:

```bash
npm test
```

### Plugin Development

Interested in building plugins for wavesurfer.js? Check out our comprehensive guides:

- **[Plugin Development Guide](docs/v8/PLUGIN_DEVELOPMENT_GUIDE.md)** – Complete guide to building plugins
- **[Contributing Guide](docs/v8/CONTRIBUTING.md)** – Development workflow and guidelines
- **[API Reference](docs/v8/API.md)** – Full API documentation

### Project Structure

```
wavesurfer.js/
├── src/
│   ├── streams/          # Reactive streams
│   ├── state/            # State management
│   ├── core/             # Pure functions
│   ├── plugins/          # Plugin system
│   └── ...               # Core components
├── examples/             # Example files
└── docs/                 # Documentation
```

## Tests

The project uses Vitest for unit tests and Cypress for e2e/visual regression tests.

### Running Unit Tests

```bash
npm test
```

### Running E2E Tests

First build the project:
```bash
npm run build
```

Then launch the tests:
```bash
npm run cypress
```

## Feedback

We appreciate your feedback and contributions!

If you encounter any issues or have suggestions for improvements, please don't hesitate to post in our [forum](https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a).

We hope you enjoy using wavesurfer.js and look forward to hearing about your experiences with the library!

---

**License:** BSD-3-Clause

**Made with ♥ by the wavesurfer.js community**
