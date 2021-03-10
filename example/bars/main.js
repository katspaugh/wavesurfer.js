'use strict';

// Create an instance
let wavesurfer = {};
let wavesurferWithOptions;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        barWidth: 2,
        barHeight: 1,
        barGap: null
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    // Play button
    const button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));


    // WaveSurfer with options example
    wavesurferWithOptions = WaveSurfer.create({
        container: document.querySelector('#waveform-with-options'),
        barWidth: 2,
        barHeight: 1,
        barGap: null,
        splitChannels: true,
        splitChannelsOptions: {
            overlay: false,
            channelColors: {
                0: {
                    progressColor: 'green',
                    waveColor: 'pink'
                },
                1: {
                    progressColor: 'orange',
                    waveColor: 'purple'
                }
            },
            filterChannels: [],
            relativeNormalization: true
        }
    });

    wavesurferWithOptions.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurferWithOptions.load('../media/stereo.mp3');

    // Play/pause on button press
    document
        .getElementById('play-button')
        .addEventListener('click', wavesurferWithOptions.playPause.bind(wavesurferWithOptions));
});
