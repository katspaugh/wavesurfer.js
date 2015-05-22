'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        backend: 'AudioElement'
    });


    // Load audio from URL
    wavesurfer.load('../media/demo.wav');


    // Zoom slider
    var slider = document.querySelector('[data-action="zoom"]');

    slider.value = wavesurfer.params.minPxPerSec;
    slider.min = wavesurfer.params.minPxPerSec;

    slider.addEventListener('input', function () {
        wavesurfer.zoom(Number(this.value));
    });


    // Play button
    var button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
