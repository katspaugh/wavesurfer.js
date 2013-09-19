wavesurfer.js
=============

Interactive navigable audio visualization using
[WebAudio](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html) and Canvas/SVG.

[http://katspaugh.github.io/wavesurfer.js/](http://katspaugh.github.io/wavesurfer.js/)

![Imgur](http://i.imgur.com/dnH8q.png)

API in examples
===============

Create an instance:

    var wavesurfer = Object.create(WaveSurfer);

Initialize it with a container element (plus some options):

    wavesurfer.init({
        container: document.querySelector('#wave'),
        waveColor: 'violet',
        progressColor: 'purple'
    });

Subscribe to some events:

    wavesurfer.on('ready', function () {
        wavesurfer.play();
    });

Load an audio file from a URL:

    wavesurfer.load('media/sonnet_23.mp3');

Or visualize your audio files via drag'n'drop:

    wavesurfer.bindDragNDrop(document.body);

See the example code [here](https://github.com/katspaugh/wavesurfer.js/blob/master/example/main.js).

Options
=======

  * `container` – CSS-selector or HTML-element where the waveform to be drawn.
  * `skipLength` – number of seconds to skip with the `skipForward()` and `skipBackward()` methods (`2` by default).
  * `minPxPerSec` – minimum number of pixels per second of audio (`1` by default).
  * `fillParent` – whether to fill the entire container or draw only according to `minPxPerSec` (`true` by default).
  * `scrollParent` – whether to scroll the container with a lengthy waveform. Otherwise the waveform is shrinked to container width (see `fillParent`).
  * `pixelRatio` – `1` by default for performance considerations (see #22), but you can set it to `window.devicePixelRatio`.
  * `renderer` – SVG or Canvas. `'Canvas'` by default.
  * `AudioContext` – use your own previously initialized `AudioContext` or leave blank.
  * `cursorWidth` – 1 px by default.
  * `markerWidth` – 1 px by default.
  * `waveColor` – the fill color of the waveform. You can also customize all colors via CSS when using the SVG renderer.
  * `progressColor`
  * `cursorColor`

Methods
=======

All methods are intentionally public, but the most readily available are the following:

 * `init(params)` – initializes with the options listed above.
 * `on(eventName, callback)` – subscribes to an event.
 * `load(url)` – loads an audio from URL via XHR.
 * `play()` – starts playback from the current position.
 * `pause()` – stops playback.
 * `playPause()` – plays if paused, pauses if playing.
 * `stop()` – stops and goes to the beginning.
 * `skipForward()`
 * `skipBackward()`
 * `skip(offset)` – skips a number of seconds from the current position (use a negative value to go backwards).
 * `setVolume(newVolume)` – sets the playback volume to a new value (use a floating point value between -1 and 1, -1 being no volume and 1 being full volume).
 * `toggleMute()` – toggles the volume on and off.
 * `mark(options)` – creates a visual marker on the waveform. Options are `id` (random if not set), `position` (in seconds), `color` and `width` (defaults to the global option `markerWidth`). Returns a marker object which you can update later (`marker.update(options)`).
 * `clearMarks()` – removes all markers.
 * `bindMarks()` – starts listening for markers being reached by cursor on the waveform. Emits `mark` event and `reached` event for each marker object.
 * `bindDragNDrop([dropTarget])` – starts listening to drag'n'drop on an element. The default element is `document`. Loads the dropped audio.
 * `empty()` – clears the waveform as if a zero-length audio is loaded.

Connecting filters
==================
You can insert your own WebAudio nodes into the graph using the method `setFilter`. Example:

    var lowpass = wavesurfer.backend.ac.createBiquadFilter();
    wavesurfer.backend.setFilter(lowpass);

Events
======

You can listen to the following events:

 * `ready` – when audio is decoded and waveform drawn.
 * `loading` – fires continuously when loading via XHR. Callback recieves loading progress in percents.
 * `progress` – fires continuously as audio progresses.
 * `seek` – when you seek to specified position.
 * `mark` – when a mark is reached (callback receives the marker object).

Credits
=======

- Based on [Eiji Kitamura's work](https://github.com/agektmr/AudioStreamer).

- Initial idea by [Alex Khokhulin](https://github.com/xoxulin).

- Awesome contributions by [Max Goodman](https://github.com/chromakode),
[Kevin Ennis](https://github.com/kevincennis),
[Justin Bradford](https://github.com/jabr),
[Hayden Ball](https://github.com/ball-hayden),
[@KingdomOfJoy](https://github.com/KingdomOfJoy) and
[@svoctor](https://github.com/svoctor).

Thanks!


License
=======

![cc-by](http://i.creativecommons.org/l/by/3.0/88x31.png)

This work is licensed under a [Creative Commons Attribution 3.0 Unported License](http://creativecommons.org/licenses/by/3.0/deed.en_US).
