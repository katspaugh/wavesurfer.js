# wavesurfer.js

Interactive navigable audio visualization using
[Web Audio](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html)
and Canvas.

![Imgur](http://i.imgur.com/dnH8q.png)

### API in examples

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

See the example code
[here](https://github.com/katspaugh/wavesurfer.js/blob/master/example/main.js).

### WaveSurfer Options

| option | type | default | description |
| --- | --- | --- | --- |
| `audioContext` | string | `null` | Use your own previously initialized `AudioContext` or leave blank. |
| `audioRate` | float | `1` | Speed at which to play audio.  Lower number is slower. |
| `backend` | string | `WebAudioBuffer` | One of `WebAudioBuffer`, `WebAudioMedia` or `AudioElement`. In most cases you needn't set this manually. |
| `container` | mixed | _none_ | CSS-selector or HTML-element where the waveform should be drawn. This is the only required parameter |
| `cursorColor` | string | `#333` | The fill color of the cursor indicating the playhead position. |
| `cursorWidth` | integer | `1` | Measured in pixels. |
| `dragSelection` | boolean | `true` | Enable/disable drag selection. |
| `fillParent` | boolean | `true` | Whether to fill the entire container or draw only according to `minPxPerSec`. |
| `height` | integer | `128` | The height of the waveform.  Measured in pixels. |
| `hideScrollbar` | boolean | `false` | Whether to hide the horizontal scrollbar when one would normally be shown. |
| `interact` | boolean | `true` | Whether the mouse interaction will enabled at initialization. |
| `loopSelection` | boolean | `true` | Whether playback should loop inside the selected region. Has no effect if `dragSelection` is `false`. |
| `markerWidth` | integer | `1` | Measured in pixels. |
| `minPxPerSec` | integer | `50` | Minimum number of pixels per second of audio. |
| `normalize` | boolean | `false` | If `true`, normalize by the maximum peak instead of 1.0. |
| `pixelRatio` | integer | `window.devicePixelRatio` | Can set to `1` for faster rendering. |
| `progressColor` | string | `#555` | The fill color of the part of the waveform behind the cursor. |
| `scrollParent` | boolean | `false` | Whether to scroll the container with a lengthy waveform. Otherwise the waveform is shrinked to container width (see `fillParent`). |
| `selectionBorder` | boolean | `false` | Whether to display a border when `dragSelection` is `true`. |
| `selectionBorderColor` | string | `#000` | Used when `selectionBorder` is `true`. |
| `selectionColor` | string | `#0fc` | The fill color for a selected area when `dragSelection` is `true`. |
| `selectionForeground` | boolean | `false` | Whether the selection is displayed in the foreground. |
| `skipLength` | float | `2` | Number of seconds to skip with the `skipForward()` and `skipBackward()` methods |
| `waveColor` | string | `#999` | The fill color of the waveform after the cursor. |

### WaveSurfer Methods

All methods are intentionally public, but the most readily available are the following:

 * `init(options)` – Initializes with the options listed above.

 * `clearMarks()` – Removes all markers.
 * `clearRegions()` – Removes all regions.
 * `destroy()` – Removes events, elements and disconnects Web Audio nodes.
 * `disableDragSelection()` - Disable drag selection capability.
 * `disableInteraction()` – Disable mouse interaction.
 * `empty()` – Clears the waveform as if a zero-length audio is loaded.
 * `enableDragSelection()` - Enable drag selection capability.
 * `enableInteraction()` – Enable mouse interaction.
 * `getCurrentTime()` – Returns current progress in seconds.
 * `getDuration()` – Returns the duration of an audio clip in seconds.
 * `getSelection()` – Returns an object representing the current selection. Returns `null` if no selection is present.  This object will have the following keys:
  * `startPercentage` (float) [0..1]
  * `endPercentage` (float) [0..1]
  * `startPosition` (float) seconds
  * `endPosition` (float) seconds
  * `startTime` (string) Time display (IE: `1:32`)
  * `endTime` (string) Time display
 * `load(url)` – Loads an audio from URL via XHR. Returns XHR object.
 * `mark(options)` – Creates a visual marker on the waveform. Returns a `Marker` object.  See `Marker Options`, `Marker Methods` and `Marker Events` below.
 * `on(eventName, callback)` – Subscribes to an event.  See `WaveSurfer Events` section below for a list.
 * `pause()` – Stops playback.
 * `play([start[, end]])` – Starts playback from the current position.  Optional `start` and `end` measured in seconds can be used to set the range of audio to play.
 * `playPause()` – Plays if paused, pauses if playing.
 * `playPauseSelection()` – Plays selection if paused, pauses if playing.
 * `region(options)` – Creates a region on the waveform. Returns a `Region` object.  See `Region Options`, `Region Methods` and `Region Events` below.
 * `seekAndCenter(progress)` – Seeks to a progress and centers view [0..1] (0 = beginning, 1 = end).
 * `seekTo(progress)` – Seeks to a progress [0..1] (0=beginning, 1=end).
 * `setFilter(filters)` - For inserting your own WebAudio nodes into the graph.  See `Connecting Filters` below.
 * `setPlaybackRate(rate)` – Sets the speed of playback (`0.5` is half speed, `1` is normal speed, `2` is double speed and so on).
 * `setVolume(newVolume)` – Sets the playback volume to a new value [0..1] (0 = silent, 1 = maximum).
 * `skip(offset)` – Skip a number of seconds from the current position (use a negative value to go backwards).
 * `skipBackward()` - Rewind `skipLength` seconds.
 * `skipForward()` - Skip ahead `skipLength` seconds.
 * `stop()` – Stops and goes to the beginning.
 * `toggleDragSelection()` - Toggles the ability to drag a selection.
 * `toggleMute()` – Toggles the volume on and off.
 * `toggleInteraction()` – Toggle mouse interaction.
 * `toggleLoopSelection()` – Toggles whether playback should loop inside the selection.
 * `toggleScroll()` – Toggles `scrollParent`.
 * `updateSelection({ startPercentage, endPercentage })` – Create or update a visual selection.

##### Connecting Filters

You can insert your own Web Audio nodes into the graph using the method `setFilter()`. Example:

```javascript
var lowpass = wavesurfer.backend.ac.createBiquadFilter();
wavesurfer.backend.setFilter(lowpass);
```

### WaveSurfer Events

 * `drag-mark` - When a mark is dragged.  Callback will receive the drag object, and a `Marker` object.  See the `drag` event under `Marker Events` below for information contained in the drag object.
 * `error` – Occurs on error.  Callback will receive (string) error message.
 * `finish` – When it finishes playing.
 * `loading` – Fires continuously when loading via XHR or drag'n'drop. Callback will recieve (integer) loading progress in percents [0..100] and (object) event target.
 * `mark` – When a mark is reached during playback. Callback will receive the `Marker` object.
 * `mark-click` - When the mouse clicks on a mark.  Callback will receive the `Marker` object, and a `MouseEvent` object.
 * `mark-leave` - When the mouse leaves a mark.  Callback will receive the `Marker` object, and a `MouseEvent` object.
 * `mark-over` - When the mouse moves over a mark.  Callback will receive the `Marker` object, and a `MouseEvent` object.
 * `mark-updated` – When a mark is updated. Callback will receive the `Marker` object.
 * `mark-removed` – When a mark is removed. Callback will receive the `Marker` object.
 * `marked` – When a mark is created. Callback will receive the `Marker` object.
 * `mouseup` - When a mouse button goes up.  Callback will receive `MouseEvent` object.
 * `play` – When play starts.
 * `progress` – Fires continuously during playback.  Callback will receive (float) percentage played [0..1].
 * `ready` – When audio is loaded, decoded and the waveform drawn.
 * `region-in` – When playback enters a region. Callback will receive the `Region` object.
 * `region-leave` - When the mouse leaves a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-out`– When playback leaves a region. Callback will receive the `Region` object.
 * `region-over` - When the mouse moves over a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-click` - When the mouse clicks on a region.  Callback will receive the `Region` object, and a `MouseEvent` object.
 * `region-created` – When a region is created. Callback will receive the `Region` object.
 * `region-updated` – When a region is updated. Callback will receive the `Region` object.
 * `region-removed` – When a region is removed. Callback will receive the `Region` object.
 * `scroll` - When the scrollbar is moved.  Callback will receive a `ScrollEvent` object.
 * `seek` – On seeking.  Callback will receive (float) progress [0..1].
 * `selection-update` – When a selection is updated. Callback will receive (object) describing the selection, or null if the selection is cleared.  See `getSelection()` method for a description of keys that describe the selection.

### Marker Options

| option | type | default | description |
| --- | --- | --- | --- |
| `id` | string | _random_ | An id you may assign to the marker |
| `position` | float | `0` | Seconds |
| `color` | string | `#333` | HTML color code |
| `width` | integer | `WaveSurfer.markerWidth` | Number of pixels |

### Marker Methods

 * `getTitle()` - Returns a time display string representing the position of the mark (IE: `1:34`).
 * `remove()` - Remove the mark object.
 * `update(options)` - Modify the settings of the mark.

### Marker Events

 * `click` - When the mouse clicks on the mark.  Callback will receive a `MouseEvent`.
 * `drag` - When the mark is dragged. Callback will receive a drag object.  The drag object contains the following keys:
  * `startPercentage` (float) [0..1]
  * `endPercentage` (float) [0..1]
 * `leave` - When mouse leaves the mark.  Callback will receive a `MouseEvent`.
 * `over` - When mouse moves over the mark.  Callback will receive a `MouseEvent`.
 * `reached` - When the marker is reached during playback.
 * `remove` - Happens just before the marker is removed.
 * `update` - When the marker's options are updated.

### Region Options

| option | type | default | description |
| --- | --- | --- | --- |
| `id` | string | _random_ | An id you may assign to the region |
| `startPosition` | float | `0` | The start position of the region (in seconds) |
| `endPosition` | float | `0` | The end position of the region (in seconds) |
| `color` | string | `rgba(0, 0, 255, 0.2)` | HTML color code |

### Region Methods

 * `remove()` - Remove the region object.
 * `update(options)` - Modify the settings of the region.

### Region Events

 * `click` - When the mouse clicks on the region.  Callback will receive a `MouseEvent`.
 * `in` - When playback enters the region.
 * `leave` - When mouse leaves the region.  Callback will receive a `MouseEvent`.
 * `out` - When playback leaves the region.
 * `over` - When mouse moves over the region.  Callback will receive a `MouseEvent`.
 * `remove` - Happens just before the region is removed.
 * `update` - When the region's options are updated.

# Credits

Initial idea by [Alex Khokhulin](https://github.com/xoxulin). Many
thanks to
[the awesome contributors](https://github.com/katspaugh/wavesurfer.js/contributors)!

# License

![cc-by](http://i.creativecommons.org/l/by/3.0/88x31.png)

This work is licensed under a
[Creative Commons Attribution 3.0 Unported License](http://creativecommons.org/licenses/by/3.0/deed.en_US).
