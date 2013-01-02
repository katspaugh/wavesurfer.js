(function () {
    'use strict';

    var wavesurfer = Object.create(WaveSurfer);

    wavesurfer.init({
        canvas: document.querySelector('#wave'),
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
}());
