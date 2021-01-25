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
        backend: 'MediaElement',
        mediaControls: false
    });

    wavesurfer.once('ready', function() {
        console.log('Using wavesurfer.js ' + WaveSurfer.VERSION);
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    // toggle play button
    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    // peaks button
    document
        .querySelector('[data-action="peaks"]')
        .addEventListener('click', function() {
            // load peaks from JSON file. See https://wavesurfer-js.org/faq/
            // for instructions on how to generate peaks
            fetch('../media/demo-peaks.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('HTTP error ' + response.status);
                    }
                    return response.json();
                })
                .then(peaks => {
                    console.log(
                        'loaded peaks! sample_rate: ' + peaks.sample_rate
                    );

                    // load peaks into wavesurfer.js
                    wavesurfer.load('../media/demo.wav', peaks.data);
                    document.body.scrollTop = 0;
                })
                .catch(e => {
                    console.error('error', e);
                });
        });
});
