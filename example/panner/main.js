'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        minPxPerSec: 30,
        scrollParent: true,
        waveColor: '#A8DBA8',
        progressColor: '#3B8686'
    });

    // Load audio from URL
    wavesurfer.load('media.wav');

    // Panner
    (function () {
        // Add panner
        wavesurfer.panner = wavesurfer.backend.ac.createPanner();
        wavesurfer.backend.setFilter(wavesurfer.panner);

        // Bind panner slider
        // @see http://stackoverflow.com/a/14412601/352796
        var onChange = function () {
            var xDeg = parseInt(slider.value);
            var x = Math.sin(xDeg * (Math.PI / 180));
            wavesurfer.panner.setPosition(x, 0, 0);
        };
        var slider = document.querySelector('[data-action="pan"]');
        slider.addEventListener('input', onChange);
        slider.addEventListener('change', onChange);
        onChange();
    }());

    // Log errors
    wavesurfer.on('error', function (msg) {
        console.log(msg);
    });

    // Bind play/pause button
    document.querySelector(
        '[data-action="play"]'
    ).addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    // Progress bar
    (function () {
        var progressDiv = document.querySelector('#progress-bar');
        var progressBar = progressDiv.querySelector('.progress-bar');

        var showProgress = function (percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        var hideProgress = function () {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    }());
});
