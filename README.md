# <img src="https://user-images.githubusercontent.com/381895/226091100-f5567a28-7736-4d37-8f84-e08f297b7e1a.png" alt="logo" height="60" valign="middle" /> wavesurfer.js

![npm](https://img.shields.io/npm/v/wavesurfer.js/beta)

## New TypeScript version

wavesurfer.js v7 beta is a TypeScript rewrite of wavesurfer.js that brings several improvements:

 * Typed API for better development experience
 * Enhanced decoding and rendering performance
 * New and improved plugins

<img width="674" alt="Screenshot" src="https://github.com/katspaugh/wavesurfer.ts/assets/381895/cde5fe51-be8a-46ff-934e-1d76a827b8bc">

---

ℹ️ Looking for the old stable version? V6 is here: https://github.com/katspaugh/wavesurfer.js/tree/master

---

Try it out:

```bash
npm install --save wavesurfer.js@beta
```
```js
import WaveSurfer from 'wavesurfer.js'
```

Alternatively, import it from a CDN as a ES6 module directly in the browser:

```html
<script type="module">
  import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'

  const wavesurfer = WaveSurfer.create({ ... })
</script>
```

Or, as a UMD script tag which exports the library as a global `WaveSurfer` variable:
```html
<script src="https://unpkg.com/wavesurfer.js@beta/dist/wavesurfer.min.js"></script>
```

To import a plugin, e.g. the Timeline plugin:
```js
import Timeline from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/timeline.js'
```

TypeScript types are included in the package, so there's no need to install `@types/wavesurfer.js`.

See more [examples](https://wavesurfer.pages.dev/examples/).

## Documentation

See the documentation on wavesurfer.js [methods](https://wavesurfer-ts.pages.dev/docs/classes/wavesurfer.WaveSurfer), [options](https://wavesurfer-ts.pages.dev/docs/types/wavesurfer.WaveSurferOptions) and [events](https://wavesurfer-ts.pages.dev/docs/types/wavesurfer.WaveSurferEvents) on our website.

## Plugins

The "official" plugins have been completely rewritten and enhanced:

 * [Regions](https://wavesurfer.pages.dev/examples/#regions.js) – visual overlays and markers for regions of audio
 * [Timeline](https://wavesurfer.pages.dev/examples/#timeline.js) – displays notches and time labels below the waveform
 * [Minimap](https://wavesurfer.pages.dev/examples/#minimap.js) – a small waveform that serves as a scrollbar for the main waveform
 * [Envelope](https://wavesurfer.pages.dev/examples/#envelope.js) – a graphical interface to add fade-in and -out effects and control volume
 * [Record](https://wavesurfer.pages.dev/examples/#record.js) – records audio from the microphone and renders a waveform
 * [Spectrogram](https://wavesurfer.pages.dev/examples/#spectrogram.js) – visualization of an audio frequency spectrum

## CSS styling

wavesurfer.js v7 is rendered into a Shadow DOM tree. This isolates its CSS from the rest of the web page.
However, it's still possible to style various wavesurfer.js elements via CSS using the `::part()` pseudo-selector.
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

<img width="466" alt="DOM inspector screenshot" src="https://github.com/katspaugh/wavesurfer.ts/assets/381895/fcfb4e4d-9572-4931-811f-9615b7e3aa85">

See [this example](https://wavesurfer.pages.dev/examples/#styling.js) for play around with styling.

## Migrating from v6

Most options, events, and methods are similar to those in previous versions.

### Notable differences
 * The `backend` option is removed – HTML5 audio (or video) is the only playback mechanism. However, you can still connect wavesurfer to Web Audio via `MediaElementSourceNode`. See this [example](https://wavesurfer.pages.dev/examples/#webaudio.js).
 * The Markers plugin is removed – use the Regions plugin with `startTime` equal to `endTime`.
 * No Microphone plugn – superseded by the new Record plugin with more features.
 * No Cursor and Playhead plugins yet – to be done.

### Removed methods
 * `getFilters`, `setFilter` – as there's no Web Audio "backend"
 * `drawBuffer` – to redraw the waveform, use `setOptions` instead and pass new rendering options
 * `cancelAjax` – ajax is replaced by `fetch`
 * `loadBlob` – use `URL.createObjectURL()` to convert a blob to a URL and call `load(url)` instead
 * `skipForward`, `skipBackward`, `setPlayEnd` – can be implemented using `setTime(time)`
 * `exportPCM` is renamed to `getDecodedData` and doesn't take any params
 * `toggleMute` is now called `setMuted(true | false)`
 * `setHeight`, `setWaveColor`, `setCursorColor`, etc. – use `setOptions` with the corresponding params instead. E.g., `wavesurfer.setOptions({ height: 300, waveColor: '#abc' })`

See the complete [documentation of the new API](https://wavesurfer-ts.pages.dev/docs/modules/wavesurfer).

## Questions

Have a question about integrating wavesurfer.js on your website? Feel free to ask in our forum: https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a

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
To run the test suite locally:

```
yarn cypress
```

## Feedback

We appreciate your feedback and contributions! Join the conversation and share your thoughts here: https://github.com/wavesurfer-js/wavesurfer.js/discussions/2789

If you encounter any issues or have suggestions for improvements, please don't hesitate to open an issue or submit a pull request on the GitHub repository.

We hope you enjoy using wavesurfer.ts and look forward to hearing about your experiences with the library!
