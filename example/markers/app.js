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
                        time: 0,
                        label: "BEGIN",
                        color: '#ff990a',
                        preventContextMenu: true
                    },
                    {
                        time: 5.5,
                        label: "V1",
                        color: '#ff990a',
                        draggable: true
                    },

                    {
                        time: 24,
                        label: "END",
                        color: '#00ffcc',
                        position: 'top'
                    }
                ]
            })
        ]
    });

    var img = new Image(40, 40);
    img.src = "./settings_icon.png";
    img.onload = () => {
        wavesurfer.markers.add({
            time: 12,
            position: "bottom",
            markerElement: img
        });
    };

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    wavesurfer.on('marker-drag', function(marker) {
        console.log("marker drag:", marker.label);
    });

    wavesurfer.on('marker-drop', function(marker) {
        console.log("marker drop:", marker.label);
    });

    wavesurfer.on('marker-contextmenu', function(marker) {
        console.log("marker context menu:", marker.label);
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');
});
