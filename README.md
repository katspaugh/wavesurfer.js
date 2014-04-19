wavesurfer.js
=============

Interactive navigable audio visualization using
[Web Audio](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html)
and Canvas.

![Imgur](http://i.imgur.com/dnH8q.png)

API in examples
===============

Create an instance:

    var wavesurfer = Object.create(WaveSurfer);

Initialize it with a container element (plus some options):

    wavesurfer.init({ container: '#wave', waveColor: 'violet',
        progressColor: 'purple' });

Subscribe to some events:

    wavesurfer.on('ready', function () { wavesurfer.play(); });

Load an audio file from a URL:

    wavesurfer.load('example/media/demo.wav');

See the example code
[here](https://github.com/katspaugh/wavesurfer.js/blob/master/example/main.js).

Options
=======

  * `container` – CSS-selector or HTML-element where the waveform
    should be drawn. This is the only required parameter.
  * `height` – the height of the waveform. `128` by default.
  * `skipLength` – number of seconds to skip with the `skipForward()`
    and `skipBackward()` methods (`2` by default).
  * `minPxPerSec` – minimum number of pixels per second of audio (`1`
    by default).
  * `fillParent` – whether to fill the entire container or draw only
    according to `minPxPerSec` (`true` by default).
  * `scrollParent` – whether to scroll the container with a lengthy
    waveform. Otherwise the waveform is shrinked to container width
    (see `fillParent`).
  * `normalize` – if `true`, normalize by the maximum peak instead of
    1.0 (`false` by default).
  * `pixelRatio` – equals `window.devicePixelRatio` by default, but
    you can set it to `1` for faster rendering.
  * `audioContext` – use your own previously initialized
    `AudioContext` or leave blank.
  * `cursorWidth` – 1 px by default.
  * `markerWidth` – 1 px by default.
  * `waveColor` – the fill color of the waveform after the cursor.
  * `progressColor` – the fill color of the part of the waveform
    behind the cursor.
  * `cursorColor` – the fill color of the cursor indicating the
    playhead position.
  * `dragSelection` – enable drag selection (`true` by default).
  * `loopSelection` – whether playback should loop inside the selected
  region (`true` by default). Has no effect if `dragSelection` is
  `false`.
  * `interact` – whether the mouse interaction will enabled at
    initialisation (`true` by default).

Methods
=======

All methods are intentionally public, but the most readily available
are the following:

 * `init(params)` – initializes with the options listed above.
 * `on(eventName, callback)` – subscribes to an event.
 * `load(url)` – loads an audio from URL via XHR. Returns XHR object.
 * `getDuration()` – returns the duration of an audio clip in seconds.
 * `getCurrentTime()` – returns current progress in seconds.
 * `play()` – starts playback from the current position.
 * `pause()` – stops playback.
 * `playPause()` – plays if paused, pauses if playing.
 * `stop()` – stops and goes to the beginning.
 * `skipForward()`
 * `skipBackward()`
 * `skip(offset)` – skips a number of seconds from the current
   position (use a negative value to go backwards).
 * `setVolume(newVolume)` – sets the playback volume to a new value
   (use a floating point value between 0 and 1, 0 being no volume and
   1 being full volume).
 * `toggleMute()` – toggles the volume on and off.
 * `mark(options)` – creates a visual marker on the waveform. Options
   are `id` (random if not set), `position` (in seconds), `color` and
   `width` (defaults to the global option `markerWidth`). Returns a
   marker object which you can update later
   (`marker.update(options)`).
 * `clearMarks()` – removes all markers.
 * `empty()` – clears the waveform as if a zero-length audio is
   loaded.
 * `destroy()` – removes events, elements and disconnects Web Audio
   nodes.
 * `toggleLoopSelection()` – toggles whether playback should loop
 inside the selection.
 * `getSelection()` – returns an object representing the current
 selection. This object will have the following keys:
 `startPercentage` (float between 0 and 1), `startPosition` (in
 seconds), `endPercentage` (float between 0 and 1) and `endPosition`
 (in seconds). Returns `null` if no selection is present.
 * `updateSelection({ startPercentage, endPercentage })` – create or
   update a visual selection.
 * `enableInteraction()` – Enable mouse interaction
 * `disableInteraction()` – Disable mouse interaction
 * `toggleInteraction()` – Toggle mouse interaction
 * `setPlaybackRate(rate)` – sets the speed of playback (`0.5` is half
   normal speed, `2` is double speed and so on).

Connecting filters
==================

You can insert your own Web Audio nodes into the graph using the
method `setFilter`. Example:

    var lowpass = wavesurfer.backend.ac.createBiquadFilter();
    wavesurfer.backend.setFilter(lowpass);

Events
======

You can listen to the following events:

 * `ready` – when audio is loaded, decoded and the waveform drawn.
 * `loading` – fires continuously when loading via XHR or
   drag'n'drop. Callback recieves loading progress in percents (from 0
   to 100) and the event target.
 * `seek` – on seeking.
 * `play` – when it starts playing.
 * `finish` – when it finishes playing.
 * `progress` – fires continuously during playback.
 * `mark` – when a mark is reached. Passes the mark object.
 * `error` – on error, passes an error message.

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
