'use strict';

// Create an instance
var wavesurfer; // eslint-disable-line no-var

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        backend: 'MediaElement',
        plugins: [
            WaveSurfer.playhead.create({
                returnOnPause: true,
                moveOnSeek: true,
                draw: true
            })
        ]
    });

    wavesurfer.on('ready', function(e) {
        wavesurfer.playhead.setPlayheadTime(2.3);
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');


});
