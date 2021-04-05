'use strict';

// Create an instance
var wavesurfer;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        backend: 'MediaElement',
        scrollParent: true,
        plugins: [
            WaveSurfer.regions.create({
                regions: [
                    {
                        start: 0,
                        end: 5,
                        color: 'hsla(400, 100%, 30%, 0.1)'
                    },
                    {
                        start: 10,
                        end: 20,
                        color: 'hsla(200, 50%, 70%, 0.1)'
                    }
                ]
            }),
            WaveSurfer.timeline.create({
                container: '#timeline'
            })
        ]
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    // Zoom slider
    let slider = document.querySelector('[data-action="zoom"]');

    slider.value = wavesurfer.params.minPxPerSec;
    slider.min = wavesurfer.params.minPxPerSec;
    // Allow extreme zoom-in, to see individual samples
    slider.max = 1000;

    slider.addEventListener('input', function() {
        wavesurfer.zoom(Number(this.value));
    });

    // set initial zoom to match slider value
    wavesurfer.zoom(slider.value);

    // Play button
    let button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
