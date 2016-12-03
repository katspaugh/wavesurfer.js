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
        backend: 'MediaElement'
    });


    // Load audio from URL
    wavesurfer.load('../panner/media.wav')

    wavesurfer.enableDragSelection({ slop: 5 });

    wavesurfer.on('ready', function () {
        wavesurfer.addRegion({
            start: 0,
            end: 5,
            color: 'hsla(400, 100%, 30%, 0.1)'
        });

        wavesurfer.addRegion({
            start: 10,
            end: 100,
            color: 'hsla(200, 50%, 70%, 0.1)'
        });

      // Init Timeline plugin
      var timeline = Object.create(WaveSurfer.Timeline);
      timeline.init({ wavesurfer: wavesurfer, container: '#timeline' });
    });

    // Zoom slider
    var slider = document.querySelector('[data-action="zoom"]');

    slider.value = wavesurfer.params.minPxPerSec;
    slider.min = wavesurfer.params.minPxPerSec;

    slider.addEventListener('input', function () {
        wavesurfer.zoom(Number(this.value));
    });


    // Play button
    var button = document.querySelector('[data-action="play"]');

    button.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
