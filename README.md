# <img src="https://user-images.githubusercontent.com/381895/226091100-f5567a28-7736-4d37-8f84-e08f297b7e1a.png" alt="logo" height="60" valign="middle" /> wavesurfer.js

[![npm](https://img.shields.io/npm/v/wavesurfer.js)](https://www.npmjs.com/package/wavesurfer.js)

## New TypeScript version

wavesurfer.js v7 is a TypeScript rewrite of wavesurfer.js that brings several improvements:

 * Typed API for better development experience
 * Enhanced decoding and rendering performance
 * New and improved plugins

<img width="626" alt="waveform screenshot" src="https://github.com/katspaugh/wavesurfer.js/assets/381895/05f03bed-800e-4fa1-b09a-82a39a1c62ce">

## Getting started

Install and import the package:

```bash
npm install --save wavesurfer.js
```
```js
import WaveSurfer from 'wavesurfer.js'
```

Alternatively, insert a UMD script tag which exports the library as a global `WaveSurfer` variable:
```html
<script src="https://unpkg.com/wavesurfer.js@7"></script>
```

Create a wavesurfer instance and pass various [options](#wavesurfer-options):
```js
const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#4F4A85',
  progressColor: '#383351',
  url: '/audio.mp3',
})
```

To import one of the plugins, e.g. the [Regions plugin](https://wavesurfer-js.org/examples/#regions.js):
```js
import Regions from 'wavesurfer.js/plugins/regions'
```

Or as a script tag that will export `WaveSurfer.Regions`:
```html
<script src="https://unpkg.com/wavesurfer.js@7/dist/plugins/regions.min.js"></script>
```

TypeScript types are included in the package, so there's no need to install `@types/wavesurfer.js`.

See more [examples](https://wavesurfer-js.org/examples).

## API reference

See the wavesurfer.js documentation on our website:

 * [methods](https://wavesurfer-js.org/docs/classes/wavesurfer.default)
 * [options](http://wavesurfer-js.org/docs/options)
 * [events](http://wavesurfer-js.org/docs/events)

## Plugins

The "official" plugins have been completely rewritten and enhanced:

 * [Regions](https://wavesurfer-js.org/examples/#regions.js) – visual overlays and markers for regions of audio
 * [Timeline](https://wavesurfer-js.org/examples/#timeline.js) – displays notches and time labels below the waveform
 * [Minimap](https://wavesurfer-js.org/examples/#minimap.js) – a small waveform that serves as a scrollbar for the main waveform
 * [Envelope](https://wavesurfer-js.org/examples/#envelope.js) – a graphical interface to add fade-in and -out effects and control volume
 * [Record](https://wavesurfer-js.org/examples/#record.js) – records audio from the microphone and renders a waveform
 * [Spectrogram](https://wavesurfer-js.org/examples/#spectrogram.js) – visualization of an audio frequency spectrum (written by @akreal)
 * [Hover](https://wavesurfer-js.org/examples/#hover.js) – shows a vertical line and timestmap on waveform hover

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
See [this example](https://wavesurfer-js.org/examples/#styling.js) for play around with styling.

## Upgrading from v6

Most options, events, and methods are similar to those in previous versions.

### Notable differences
 * The `backend` option is removed – [HTML5 audio (or video) is the only playback mechanism](https://github.com/katspaugh/wavesurfer.js/discussions/2762#discussioncomment-5669347). However, you can still connect wavesurfer to Web Audio via `MediaElementSourceNode`. See this [example](https://wavesurfer-js.org/examples/#webaudio.js).
 * The Markers plugin is removed – you should use the Regions plugin with just a `startTime`.
 * No Microphone plugin – superseded by the new Record plugin with more features.
 * The Cursor plugin is replaced by the Hover plugin.

### Removed options
 * `backend`, `audioContext`, `closeAudioContext`, `audioScriptProcessor` – there's no Web Audio backend, so no AudioContext
 * `autoCenterImmediately` – `autoCenter` is now always immediate unless the audio is playing
 * `backgroundColor`, `hideCursor` – this can be easily set via CSS
 * `mediaType`, `mediaControls` – you should instead pass an entire media element in the `media` option. [Example](https://wavesurfer-js.org/examples/#video.js).
 * `partialRender` – done by default
 * `pixelRatio` – `window.devicePixelRatio` is used by default
 * `renderer` – there's just one renderer for now, so no need for this option
 * `responsive` – responsiveness is enabled by default
 * `scrollParent` – the container will scroll if `minPxPerSec` is set to a higher value
 * `skipLength` – there's no `skipForward` and `skipBackward` methods anymore
 * `splitChannelsOptions` – you should now use `splitChannels` to pass the channel options. Pass `height: 0` to hide a channel. See [this example](https://wavesurfer-js.org/examples/#split-channels.js).
 * `drawingContextAttributes`, `maxCanvasWidth`, `forceDecode` – removed to reduce code complexity
 * `xhr` - please use `fetchParams` instead
 * `barMinHeight` - the minimum bar height is now 1 pixel by default

### Removed methods
 * `getFilters`, `setFilter` – as there's no Web Audio "backend"
 * `drawBuffer` – to redraw the waveform, use `setOptions` instead and pass new rendering options
 * `cancelAjax` – you can pass an [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) in `fetchParams`
 * `skipForward`, `skipBackward`, `setPlayEnd` – can be implemented using `setTime(time)`
 * `exportPCM` is replaced with `exportPeaks` that returns arrays of floats
 * `toggleMute` is now called `setMuted(true | false)`
 * `setHeight`, `setWaveColor`, `setCursorColor`, etc. – use `setOptions` with the corresponding params instead. E.g., `wavesurfer.setOptions({ height: 300, waveColor: '#abc' })`

See the complete [documentation of the new API](http://wavesurfer-js.org/docs).

## Questions

Have a question about integrating wavesurfer.js on your website? Feel free to ask in our [Discussions forum](https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a).

### FAQ

* **Q**: Does wavesurfer support large files?
* **A**: Since wavesurfer decodes audio entirely in the browser using Web Audio, large clips may fail to decode due to memory constraints. We recommend using pre-decoded peaks for large files (see [this example](https://wavesurfer-js.org/examples/#predecoded.js)). You can use a tool like [bbc/audiowaveform](https://github.com/bbc/audiowaveform) to generate peaks.

---

* **Q**: What about streaming audio?
* **A**: Streaming isn't supported because wavesurfer needs to download the entire audio file to decode and render it.

---

* **Q**: There is a mismatch between my audio and the waveform. How do I fix it?
* **A**: If you're using a VBR (variable bit rate) audio file, there might be a mismatch between the audio and the waveform. This can be fixed by converting your file to CBR (constant bit rate). See [this issue](https://github.com/katspaugh/wavesurfer.js/issues/2890#issuecomment-1601067822) for details.


## Development

To get started with development, follow these steps:

 1. Install dev dependencies:

```
yarn
```

 2. Start the TypeScript compiler in watch mode and launch an HTTP server:

```
yarn start
```

This command will open http://localhost:9090 in your browser with live reload, allowing you to see the changes as you develop.

## Tests

The tests are written in the Cypress framework. They are a mix of e2e and visual regression tests.

To run the test suite locally, first build the project:
```
yarn build
```

Then launch the tests:
```
yarn cypress
```

## Feedback

We appreciate your feedback and contributions!

If you encounter any issues or have suggestions for improvements, please don't hesitate to post in our [forum](https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a).

We hope you enjoy using wavesurfer.js and look forward to hearing about your experiences with the library!
