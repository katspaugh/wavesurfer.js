'use strict';

var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    var options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [WaveSurfer.cursor.create()]
    };

    // Init wavesurfer
    wavesurfer = WaveSurfer.create(options);

    wavesurfer.load('../example/media/demo.wav');
});
