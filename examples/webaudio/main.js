var wavesurfer = (function () {
    'use strict';

    var canvas = document.querySelector('#wave');

    var wavesurfer = Object.create(WaveSurfer);

    wavesurfer.init({
        canvas: canvas,
        waveColor: 'violet',
        progressColor: 'purple',
        loadingColor: 'purple',
        cursorColor: 'navy'
    });

    wavesurfer.load('media/sonnet_23.mp3');

    wavesurfer.bindDragNDrop();

    document.addEventListener('keypress', function (e) {
        // spacebar
        if (32 == e.keyCode) {
            wavesurfer.playPause();
        }
    });

    return wavesurfer;
}());
