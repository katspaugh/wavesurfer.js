# wavesurfer.js

Interactive navigable audio visualization using [Web Audio](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html) and Canvas.

![Screenshot](example/screenshot.png?raw=true "Screenshot")

## Browser support
wavesurfer.js works only in [modern browsers supporting Web Audio](http://caniuse.com/audio-api).

It will fallback to Audio Element in other browsers (without graphics). You can also try [wavesurfer.swf](https://github.com/laurentvd/wavesurfer.swf) which is a Flash-based fallback with graphics.

## FAQ
### Can the audio start playing before the waveform is drawn?
Yes, if you use the `backend: 'MediaElement'` option. See here: http://wavesurfer-js.org/example/audio-element/. The audio will start playing as you press play. A thin line will be displayed until the whole audio file is downloaded and decoded to draw the waveform.

### Can drawing be done as file loads?
No. Web Audio needs the whole file to decode it in the browser. You can however load pre-decoded waveform data to draw the waveform immediately. See here: http://wavesurfer-js.org/example/audio-element/ (the "Pre-recoded Peaks" section).

## API in examples

Create an instance:

```javascript
var wavesurfer = Object.create(WaveSurfer);
```

Initialize it with a container element (plus some options):

```javascript
wavesurfer.init({
    container: '#wave',
    waveColor: 'violet',
    progressColor: 'purple'
});
```

Subscribe to some events:

```javascript
wavesurfer.on('ready', function () {
    wavesurfer.play();
});
```

Load an audio file from a URL:

```javascript
wavesurfer.load('example/media/demo.wav');
```

See the example code [here](/example/main.js).

For a list of other projects using wavesurfer.js, check out
[the wiki](https://github.com/katspaugh/wavesurfer.js/wiki/Projects)
where you can also add your own project.

## WaveSurfer Options

| option | type | default | description |
| --- | --- | --- | --- |
| `audioContext` | object | _none_ | Use your own previously initialized `AudioContext` or leave blank. |
| `audioRate` | float | `1` | Speed at which to play audio.  Lower number is slower. |
| `backend` | string | `WebAudio` | `WebAudio` or `MediaElement`. In most cases you don't have to set this manually. `MediaElement` is a fallback for unsupported browsers. |
| `barWidth` | number | _none_ | If specified, the waveform will be drawn like this: ▁ ▂ ▇ ▃ ▅ ▂ |
| `container` | mixed | _none_ | CSS-selector or HTML-element where the waveform should be drawn. This is the only required parameter. |
| `cursorColor` | string | `#333` | The fill color of the cursor indicating the playhead position. |
| `cursorWidth` | integer | `1` | Measured in pixels. |
| `fillParent` | boolean | `true` | Whether to fill the entire container or draw only according to `minPxPerSec`. |
| `height` | integer | `128` | The height of the waveform.  Measured in pixels. |
| `hideScrollbar` | boolean | `false` | Whether to hide the horizontal scrollbar when one would normally be shown. |
| `interact` | boolean | `true` | Whether the mouse interaction will be enabled at initialization.  You can switch this parameter at any time later on. |
| `minPxPerSec` | integer | `50` | Minimum number of pixels per second of audio. |
| `normalize` | boolean | `false` | If `true`, normalize by the maximum peak instead of 1.0. |
| `pixelRatio` | integer | `window.devicePixelRatio` | Can be set to `1` for faster rendering. |
| `progressColor` | string | `#555` | The fill color of the part of the waveform behind the cursor. |
| `scrollParent` | boolean | `false` | Whether to scroll the container with a lengthy waveform. Otherwise the waveform is shrunk to the container width (see `fillParent`). |
| `skipLength` | float | `2` | Number of seconds to skip with the `skipForward()` and `skipBackward()` methods. |
| `waveColor` | string | `#999` | The fill color of the waveform after the cursor. |

## WaveSurfer Methods

All methods are intentionally public, but the most readily available are the following:

 * `init(options)` – Initializes with the options listed above.
 * `destroy()` – Removes events, elements and disconnects Web Audio nodes.
 * `empty()` – Clears the waveform as if a zero-length audio is loaded.
 * `getCurrentTime()` – Returns current progress in seconds.
 * `getDuration()` – Returns the duration of an audio clip in seconds.
 * `isPlaying()` – Returns true if currently playing, false otherwise.
 * `load(url)` – Loads audio from URL via XHR. Returns XHR object.
 * `loadBlob(url)` – Loads audio from a `Blob` or `File` object.
 * `on(eventName, callback)` – Subscribes to an event.  See [WaveSurfer Events](#wavesurfer-events) section below for a list.
 * `un(eventName, callback)` – Unsubscribes from an event.
 * `unAll()` – Unsubscribes from all events.
 * `pause()` – Stops playback.
 * `play([start[, end]])` – Starts playback from the current position.  Optional `start` and `end` measured in seconds can be used to set the range of audio to play.
 * `playPause()` – Plays if paused, pauses if playing.
 * `seekAndCenter(progress)` – Seeks to a progress and centers view `[0..1]` (0 = beginning, 1 = end).
 * `seekTo(progress)` – Seeks to a progress `[0..1]` (0=beginning, 1=end).
 * `setFilter(filters)` - For inserting your own WebAudio nodes into the graph.  See [Connecting Filters](#connecting-filters) below.
 * `setPlaybackRate(rate)` – Sets the speed of playback (`0.5` is half speed, `1` is normal speed, `2` is double speed and so on).
 * `setVolume(newVolume)` – Sets the playback volume to a new value `[0..1]` (0 = silent, 1 = maximum).
 * `skip(offset)` – Skip a number of seconds from the current position (use a negative value to go backwards).
 * `skipBackward()` - Rewind `skipLength` seconds.
 * `skipForward()` - Skip ahead `skipLength` seconds.
 * `stop()` – Stops and goes to the beginning.
 * `toggleMute()` – Toggles the volume on and off.
 * `toggleInteraction()` – Toggle mouse interaction.
 * `toggleScroll()` – Toggles `scrollParent`.
 * `zoom(pxPerSec)` – Horiontally zooms the waveform in and out. The
   parameter is a number of horizontal pixels per second of audio. It
   also changes the parameter `minPxPerSec` and enables the
   `scrollParent` option.

##### Connecting Filters

You can insert your own Web Audio nodes into the graph using the method `setFilter()`. Example:

```javascript
var lowpass = wavesurfer.backend.ac.createBiquadFilter();
wavesurfer.backend.setFilter(lowpass);
```

## WaveSurfer Events

General events:

 * `audioprocess` – Fires continuously as the audio plays. Also fires on seeking.
 * `error` – Occurs on error.  Callback will receive (string) error message.
 * `finish` – When it finishes playing.
 * `loading` – Fires continuously when loading via XHR or drag'n'drop. Callback will receive (integer) loading progress in percents [0..100] and (object) event target.
 * `mouseup` - When a mouse button goes up.  Callback will receive `MouseEvent` object.
 * `pause` – When audio is paused.
 * `play` – When play starts.
 * `ready` – When audio is loaded, decoded and the waveform drawn.
 * `scroll` - When the scrollbar is moved.  Callback will receive a `ScrollEvent` object.
 * `seek` – On seeking.  Callback will receive (float) progress [0..1].
 * `zoom` – On zooming. Callback will receive (integer) minPxPerSec.

Region events (exposed by the Regions plugin):

 * `region-in` – When playback enters a region. Callback will receive the `Region` object.
 * `region-out`– When playback leaves a region. Callback will receive the `Region` object.
 * `region-mouseenter` - When the mouse moves over a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-mouseleave` - When the mouse leaves a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-click` - When the mouse clicks on a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-dblclick` - When the mouse double-clicks on a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-created` – When a region is created. Callback will receive the `Region` object.
 * `region-updated` – When a region is updated. Callback will receive the `Region` object.
 * `region-update-end` – When dragging or resizing is finished. Callback will receive the `Region` object.
 * `region-removed` – When a region is removed. Callback will receive the `Region` object.


## Regions Plugin

Regions are visual overlays on waveform that can be used to play and
loop portions of audio. Regions can be dragged and resized.

Visual customization is possible via CSS (using the selectors
`.wavesurfer-region` and `.wavesurfer-handle`).

To enable the plugin, add the script `plugin/wavesurfer.regions.js` to
your page.

After doing that, use `wavesurfer.addRegion()` to create Region objects.

### Exposed Methods

 * `addRegion(options)` – Creates a region on the waveform. Returns a `Region` object.  See [Region Options](#region-options), [Region Methods](#region-methods) and [Region Events](#region-events) below.
    * **Note:** You cannot add regions until the audio has finished loading, otherwise the `start:` and `end:` properties of the new region will be set to `0`, or an unexpected value.
 * `clearRegions()` – Removes all regions.
 * `enableDragSelection(options)` – Lets you create regions by selecting.
   areas of the waveform with mouse. `options` are Region objects' params (see [below](#region-options)).

### Region Options

| option | type | default | description |
| --- | --- | --- | --- |
| `id` | string | random | The id of the region. |
| `start` | float | `0` | The start position of the region (in seconds). |
| `end` | float | `0` | The end position of the region (in seconds). |
| `loop` | boolean | `false` | Whether to loop the region when played back. |
| `drag` | boolean | `true` | Allow/dissallow dragging the region. |
| `resize` | boolean | `true` | Allow/dissallow resizing the region. |
| `color` | string | `"rgba(0, 0, 0, 0.1)"` | HTML color code. |

### Region Methods

 * `remove()` - Remove the region object.
 * `update(options)` - Modify the settings of the region.
 * `play()` - Play the audio region from the start to end position.

### Region Events

General events:

 * `in` - When playback enters the region.
 * `out` - When playback leaves the region.
 * `remove` - Happens just before the region is removed.
 * `update` - When the region's options are updated.

Mouse events:

 * `click` - When the mouse clicks on the region.  Callback will receive a `MouseEvent`.
 * `dblclick` - When the mouse double-clicks on the region.  Callback will receive a `MouseEvent`.
 * `over` - When mouse moves over the region.  Callback will receive a `MouseEvent`.
 * `leave` - When mouse leaves the region.  Callback will receive a `MouseEvent`.

## Development

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
[![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg)]()
[![Build Status](https://travis-ci.org/katspaugh/wavesurfer.js.svg?branch=master)](https://travis-ci.org/katspaugh/wavesurfer.js)
[![Coverage Status](https://coveralls.io/repos/katspaugh/wavesurfer.js/badge.svg)](https://coveralls.io/r/katspaugh/wavesurfer.js)

Install `grunt-cli` using npm:

```
npm install -g grunt-cli
```

Install development dependencies:

```
npm install
```

Build a minified version of the library and plugins. This command also checks
for code-style mistakes and runs the tests:

```
grunt
```

Generated files are placed in the `dist` directory.

Running tests only:

```
grunt test
```

Creating a coverage report:

```
grunt coverage
```

The HTML report can be found in `coverage/html/index.html`.

## Credits

Initial idea by [Alex Khokhulin](https://github.com/xoxulin). Many
thanks to
[the awesome contributors](https://github.com/katspaugh/wavesurfer.js/contributors)!

## License

![cc-by](https://i.creativecommons.org/l/by/3.0/88x31.png)

This work is licensed under a
[Creative Commons Attribution 3.0 Unported License](https://creativecommons.org/licenses/by/3.0/deed.en_US).
