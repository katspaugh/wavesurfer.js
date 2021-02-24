'use strict';

// Create an instance
let wavesurfer;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        vertical: true,
        plugins: [
            WaveSurfer.regions.create({
                regionsMinLength: 2,
                regions: [
                    {
                        start: 1,
                        end: 3,
                        loop: false,
                        color: 'hsla(400, 100%, 30%, 0.5)'
                    },
                    {
                        start: 5,
                        end: 7,
                        loop: false,
                        color: 'hsla(200, 50%, 70%, 0.4)',
                        minLength: 1
                    }
                ],
                dragSelection: {
                    slop: 5
                }
            })
        ]
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
