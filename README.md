wavesurfer.js
=============

Interactive navigable audio visualization using
[Web Audio](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html)
and Canvas.

![Imgur](http://i.imgur.com/dnH8q.png)

API in examples
===============

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

Options
=======

  * `audioContext` – Use your own previously initialized `AudioContext` or leave blank (default = `null`).
  * `audioRate` - Speed at which to play audio.  Lower number is slower (default = `1`).
  * `backend` – One of `WebAudioBuffer`, `WebAudioMedia` or `AudioElement`. In most cases you needn't set this manually (default = `WebAudioBuffer`).
  * `container` – CSS-selector or HTML-element where the waveform should be drawn. This is the only required parameter.
  * `cursorColor` – The fill color of the cursor indicating the playhead position (default = `#333`).
  * `cursorWidth` – Measured in pixels (default = `1`).
  * `dragSelection` – Enable drag selection (default = `true`).
  * `fillParent` – Whether to fill the entire container or draw only according to `minPxPerSec` (default = `true`).
  * `height` – The height of the waveform.  Measured in pixels (default = `128`).
  * `hideScrollbar` - Whether to hide the horizontal scrollbar when one would normally be shown (default = `false`).
  * `interact` – Whether the mouse interaction will enabled at initialization (default = `true`).
  * `loopSelection` – Whether playback should loop inside the selected region. Has no effect if `dragSelection` is `false` (default = `true`).
  * `markerWidth` – Measured in pixels (default = `1`).
  * `minPxPerSec` – Minimum number of pixels per second of audio (default = `50`).
  * `normalize` – If `true`, normalize by the maximum peak instead of 1.0 (default = `false`).
  * `pixelRatio` – Can set to `1` for faster rendering (default = `window.devicePixelRatio`).
  * `progressColor` – The fill color of the part of the waveform behind the cursor (default = `#555`).
  * `scrollParent` – Whether to scroll the container with a lengthy waveform. Otherwise the waveform is shrinked to container width (see `fillParent`) (default = `false`).
  * `selectionBorder` - Whether to display a border when `dragSelection` is `true` (default = `false`).
  * `selectionBorderColor` - Used when `selectionBorder` is `true` (default = `#000`).
  * `selectionColor` - The fill color for a selected area when `dragSelection` is `true` (default = `#0fc`).
  * `selectionForeground` - Whether the selection is displayed in the foreground (default = `false`).
  * `skipLength` – Number of seconds to skip with the `skipForward()` and `skipBackward()` methods (default = `2`).
  * `waveColor` – The fill color of the waveform after the cursor (default = `#999`).

Methods
=======

All methods are intentionally public, but the most readily available are the following:

 * `init(params)` – Initializes with the options listed above.

 * `clearMarks()` – Removes all markers.
 * `clearRegions()` – Removes all regions. 
 * `destroy()` – Removes events, elements and disconnects Web Audio nodes.
 * `disableInteraction()` – Disable mouse interaction.
 * `empty()` – Clears the waveform as if a zero-length audio is loaded.
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
 * `mark(options)` – Creates a visual marker on the waveform. Returns a marker object which you can update later. (IE; `marker.update(options)`).  Options are:
  * `id` (string) Random if not set
  * `position` (float) Seconds
  * `color` (string) HTML color code
  * `width` (integer) Number of pixels, defaults to global option `markerWidth`
 * `on(eventName, callback)` – Subscribes to an event.  See `Events` section below for a list.
 * `pause()` – Stops playback.
 * `play([start[, end]])` – Starts playback from the current position.  Optional `start` and `end` measured in seconds can be used to set the range of audio to play.
 * `playPause()` – Plays if paused, pauses if playing.
 * `playPauseSelection()` – Plays selection if paused, pauses if playing.   
 * `region(options)` – Creates a region on the waveform. Returns a region object which you can update later (IE: `region.update(options)`). Options are:
  * `id` (string) Random if not set
  * `startPosition` (float) Seconds
  * `endPosition` (float) Seconds
  * `color` (string) HTML color code
 * `seekAndCenter(progress)` – Seeks to a progress and centers view [0..1] (0 = beginning, 1 = end).
 * `seekTo(progress)` – Seeks to a progress [0..1] (0=beginning, 1=end).
 * `setFilter(filters)` - For inserting your own WebAudio nodes into the graph.  See `Connecting Filters` below.
 * `setPlaybackRate(rate)` – Sets the speed of playback (`0.5` is half speed, `1` is normal speed, `2` is double speed and so on).
 * `setVolume(newVolume)` – Sets the playback volume to a new value [0..1] (0 = silent, 1 = maximum).
 * `skip(offset)` – Skip a number of seconds from the current position (use a negative value to go backwards).
 * `skipBackward()` - Rewind `skipLength` seconds.
 * `skipForward()` - Skip ahead `skipLength` seconds.
 * `stop()` – Stops and goes to the beginning.
 * `toggleMute()` – Toggles the volume on and off.
 * `toggleInteraction()` – Toggle mouse interaction.
 * `toggleLoopSelection()` – Toggles whether playback should loop inside the selection.
 * `toggleScroll()` – Toggles `scrollParent`.
 * `updateSelection({ startPercentage, endPercentage })` – Create or update a visual selection.

Connecting Filters
==================

You can insert your own Web Audio nodes into the graph using the method `setFilter()`. Example:

```javascript
var lowpass = wavesurfer.backend.ac.createBiquadFilter();
wavesurfer.backend.setFilter(lowpass);
```

Events
======

You can listen to the following events:

 * `error` – Occurs on error.  Callback will receive (string) error message.
 * `finish` – When it finishes playing.
 * `loading` – Fires continuously when loading via XHR or drag'n'drop. Callback will recieve (integer) loading progress in percents [0..100] and (object) event target.
 * `mark` – When a mark is reached. Callback will receive (object) the mark object.
 * `marked` – When a mark is created.
 * `mark-update` – When a mark is updated.
 * `mark-removed` – When a mark is removed.
 * `play` – When play starts.
 * `progress` – Fires continuously during playback.  Callback will receive (float) percentage played [0..1].
 * `ready` – When audio is loaded, decoded and the waveform drawn.
 * `region-in` – When entering a region.
 * `region-out`– When leaving a region.
 * `region-created` – When a region is created.
 * `region-updated` – When a region is updated.
 * `region-removed` – When a region is removed.
 * `seek` – On seeking.
 * `selection-update` – When a selection is updated. Has an object parameter containig selection information or null if the selection is cleared.

Each of mark objects also fire the event `reached` when played over.

Credits
=======

Initial idea by [Alex Khokhulin](https://github.com/xoxulin). Many
thanks to
[the awesome contributors](https://github.com/katspaugh/wavesurfer.js/contributors)!

License
=======

![cc-by](http://i.creativecommons.org/l/by/3.0/88x31.png)

This work is licensed under a
[Creative Commons Attribution 3.0 Unported License](http://creativecommons.org/licenses/by/3.0/deed.en_US).
