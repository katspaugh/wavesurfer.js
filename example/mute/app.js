'use strict';

// Create an instance
var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    let playButton = document.querySelector('#playBtn'),
        toggleMuteButton = document.querySelector('#toggleMuteBtn'),
        setMuteOnButton = document.querySelector('#setMuteOnBtn'),
        setMuteOffButton = document.querySelector('#setMuteOffBtn');

    // Init wavesurfer
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: 'black'
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    wavesurfer.once('ready', function() {
        playButton.onclick = function() {
            wavesurfer.playPause();
        };

        toggleMuteButton.onclick = function() {
            wavesurfer.toggleMute();
        };

        setMuteOnButton.onclick = function() {
            wavesurfer.setMute(true);
        };

        setMuteOffButton.onclick = function() {
            wavesurfer.setMute(false);
        };
    });

    wavesurfer.load('../media/demo.wav');
});
