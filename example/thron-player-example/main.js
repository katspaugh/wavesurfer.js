'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        backend: 'MediaElement',
		barWidth: 3,
		waveStyle: 'soundWave',
        mbLimit: 30
    });

    // Load audio from URL
    wavesurfer.load('long.mp3');
    //wavesurfer.load('../media/demo.wav');


    document.querySelector(
        '[data-action="play"]'
    ).addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
