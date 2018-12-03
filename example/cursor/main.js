'use strict';

// Create an instance
var wavesurfer = {};

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        plugins: [
            WaveSurfer.cursor.create({
                showTime: true,
                opacity: 1,
                customShowTimeStyle: {
                    'background-color': '#000',
                    color: '#fff',
                    padding: '2px',
                    'font-size': '10px'
                }
            })
        ]
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    // Play button
    var button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
