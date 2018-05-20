'use strict';

var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    var pluginOptions = {
        waveColor: 'grey',
        progressColor: 'black',
        height: 30
    };
    var options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [WaveSurfer.minimap.create(pluginOptions)]
    };

    // Init wavesurfer
    wavesurfer = WaveSurfer.create(options);

    wavesurfer.load('../example/media/demo.wav');
});
