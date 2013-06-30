wavesurfer.js
=============

Interactive navigable audio visualization using
[WebAudio](https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html) and SVG.

![Imgur](http://i.imgur.com/dnH8q.png)

API in examples
===============

Create an instance:

    var wavesurfer = Object.create(WaveSurfer);

Initialize it with a canvas element (plus some options):

    wavesurfer.init({
        container: document.querySelector('#wave'),
        waveColor: 'violet',
        progressColor: 'purple'
    });

Load an audio file from a URL:

    wavesurfer.load('media/sonnet_23.mp3');

Or visualize your audio files via drag'n'drop:

    wavesurfer.bindDragNDrop(document.body);

Credits
=======

- Based on [Eiji Kitamura's work](https://github.com/agektmr/AudioStreamer).

- Invaluable advice from [Alex Khokhulin](https://github.com/xoxulin).

- Advice from [Max Goodman](https://github.com/chromakode).

- Speed greatly optimised by [Kevin Ennis](https://github.com/kevincennis).

- Many cool features contributed by [Justin Bradford](https://github.com/jabr).

Thanks!


License
=======

![cc-by](http://i.creativecommons.org/l/by/3.0/88x31.png)

This work is licensed under a [Creative Commons Attribution 3.0 Unported License](http://creativecommons.org/licenses/by/3.0/deed.en_US).
