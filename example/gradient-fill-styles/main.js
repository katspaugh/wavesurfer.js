'use strict';

// Create an instance
let wavesurfer = {};
let wavesurferWithBars;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        waveColor: [ // waveColor as an array of colors, to be applied as gradient color stops to the waveform.
            "red",
            "green",
            "purple",
            "yellow",
            "rgba(0,255,255,.5)"
        ],
        progressColor: [ // the gradient fill styles are also available on the progressColor option
            "orange",
            "blue",
            "cyan",
            "black",
            "rgba(0,255,255,.5)"
        ]
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    // Set the playhead to halfway through the media, as to demonstrate the colorProgress gradient
    wavesurfer.on('ready', () => wavesurfer.seekTo(.5));

    // Play button
    const button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));


    // WaveSurfer with gradient fill styles - bars example
    wavesurferWithBars = WaveSurfer.create({
        container: document.querySelector('#waveform-with-bars'),
        barGap: 6,
        barHeight: 1,
        barMinHeight: 1,
        barRadius: 6,
        barWidth: 12,
        waveColor: [ // waveColor as an array of colors, to be applied as gradient color stops to the waveform.
            "red",
            "green",
            "purple",
            "yellow",
            "rgba(0,255,255,.5)"
        ],
        progressColor: [ // the gradient fill styles are also available on the progressColor option
            "orange",
            "blue",
            "cyan",
            "black",
            "rgba(0,255,255,.5)"
        ]
    });

    wavesurferWithBars.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurferWithBars.load('../media/stereo.mp3');

    // Set the playhead to halfway through the media, as to demonstrate the colorProgress gradient
    wavesurferWithBars.on('ready', () => wavesurferWithBars.seekTo(.5));

    // Play/pause on button press
    document
        .getElementById('play-button')
        .addEventListener('click', wavesurferWithBars.playPause.bind(wavesurferWithBars));
});
