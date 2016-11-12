'use strict';

// Create an instance
var wavesurfer = {};

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {

    wavesurfer = window.WaveSurfer.create({
        container: document.querySelector('#waveform'),
        plugins: [
            window.WaveSurfer.cursor()
        ]
    });


    // Load audio from URL
    wavesurfer.load('../media/demo.wav');


    // Play button
    var button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
