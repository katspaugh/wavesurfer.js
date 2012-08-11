wavesurfer.js
=============

Interactive navigable audio visualization using WebAudio API and Canvas.

Based on [Eiji Kitamura's work](https://github.com/agektmr/AudioStreamer).

With help from [Alex Khokhulin](https://github.com/xoxulin). Thanks!

![Imgur](http://i.imgur.com/vG4FF.png)

API in examples
===============

Create an instance:

    var wavesurfer = Object.create(WaveSurfer);

Initialize it with canvas and cursor elements (plus some options):

    wavesurfer.init({
        canvas: document.querySelector('#wave'),
        cursor: document.querySelector('#wave-cursor'),
        color: 'violet'
    });

Load an audio file from a URL (via XHR):

    wavesurfer.load('media/sonnet_23.mp3');

You can `playAt(percentage)`, `pause()` and `playPause()`:

    document.addEventListener('keypress', function (e) {
        // spacebar
        if (32 == e.keyCode) {
            wavesurfer.playPause();
        }
    });

There is also a method to visualize drag'n'dropped audio files:

    wavesurfer.bindDragNDrop(targetEl);

Todo
====

 * Add API for events like `onload` and `onaudioprocess`.
 * Visualize streaming audio as it plays and scale the picture constantly.