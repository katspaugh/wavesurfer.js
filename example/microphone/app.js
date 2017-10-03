'use strict';

// Create an instance
var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    var micBtn = document.querySelector('#micBtn');

    // Init wavesurfer
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'black',
        interact: false,
        cursorWidth: 0,
        plugins: [WaveSurfer.microphone.create()]
    });

    wavesurfer.microphone.on('deviceReady', function() {
        console.info('Device ready!');
    });
    wavesurfer.microphone.on('deviceError', function(code) {
        console.warn('Device error: ' + code);
    });

    // start/stop mic on button click
    micBtn.onclick = function() {
        if (wavesurfer.microphone.active) {
            wavesurfer.microphone.stop();
        } else {
            wavesurfer.microphone.start();
        }
    };
});
