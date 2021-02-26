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
            WaveSurfer.markers.create({
                markers: [
                    {
                        time: 5.5,
                        label: "V1",
                        color: '#ff990a'
                    },
                    {
                        time: 10,
                        label: "V2",
                        color: '#00ffcc',
                        position: 'top'
                    }
                ]
            })
        ]
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');
});
