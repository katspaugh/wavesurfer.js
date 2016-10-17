'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load
document.addEventListener('DOMContentLoaded', function () {
    var playButton = document.querySelector('#playBtn'),
        toggleMuteButton = document.querySelector('#toggleMuteBtn'),
        setMuteOnButton = document.querySelector('#setMuteOnBtn'),
        setMuteOffButton = document.querySelector('#setMuteOffBtn');

    // Init wavesurfer
    wavesurfer.init({
        container     : '#waveform',
        waveColor     : 'black',
        interact      : false,
        cursorWidth   : 0
    });

    wavesurfer.load('../media/demo.wav');

    wavesurfer.on('ready', function() {
        playButton.onclick = function() {
            wavesurfer.playPause();
        };

        toggleMuteButton.onclick = function() {
            wavesurfer.toggleMute();
        }

        setMuteOnButton.onclick = function() {
            wavesurfer.setMute(true);
        }

        setMuteOffButton.onclick = function() {
            wavesurfer.setMute(false);
        }
    });
});
