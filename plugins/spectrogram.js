'use strict';

var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    // Create an instance
    var options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [
            WaveSurfer.spectrogram.create({
                container: '#wave-spectrogram'
            })
        ]
    };

    wavesurfer = WaveSurfer.create(options);

    wavesurfer.load('../example/media/demo.wav');
});
