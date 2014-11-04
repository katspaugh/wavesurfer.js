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
        backend: 'AudioElement'
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav', [
        0.01, 0.02, 0.011, 0.017, 0.016, 0.007, 0.015, 0.01, 0.011,
        0.01, 0.025, 0.013, 0.01, 0.3, 0.3, 0., 0.32, 0.2, 0.2, 0.2, 0.18,
        0.30, 0.1, 0.24, 0.1, 0.2, 0.23, 0.2, 0.23, 0., 0.2, 0.21, 0.23,
        0.25, 0.26, 0.2, 0.28, 0.2, 0.24, 0.22, 0.21, 0.17, 0.25, 0.25,
        0.26, 0.18, 0.22, 0.17, 0.24, 0.22, 0.09, 0.12, 0.2, 0.13, 0.22,
        0.2, 0.20, 0.29, 0.25, 0.31, 0.25, 0.26, 0.20, 0.37, 0.29, 0.,
        0.34, 0.2, 0.26, 0.17, 0.2, 0., 0.29, 0., 0.1, 0.18, 0.29, 0.2,
        0.27, 0.18, 0.19, 0.24, 0.24, 0.21, 0.26, 0.19, 0.18, 0.23, 0.3,
        0.3, 0.3, 0.29, 0.24, 0.3, 0.3, 0.15, 0.1, 0.23, 0.2, 0.23, 0.18,
        0.2, 0.2, 0.30, 0.2, 0.20, 0., 0.29, 0.3, 0.1, 0.14, 0.1, 0.,
        0.27, 0.23, 0.29, 0.18, 0.20, 0.1, 0.3, 0.23, 0.27, 0.19, 0.2,
        0.19, 0.22, 0.19, 0.12, 0.23, 0.21, 0.12, 0.1, 0.1, 0.1, 0.15,
        0.24, 0.1, 0.1, 0.1, 0.1, 0.14, 0.13, 0.10, 0.11, 0.13, 0.1, 0.10,
        0.10, 0.1, 0.14, 0.13, 0.12, 0.1, 0.1, 0.14, 0.13, 0.14, 0.12,
        0.1, 0.12, 0.1, 0.16, 0.1, 0.1, 0.16, 0.15, 0.1, 0.13, 0.15, 0.1,
        0.13, 0.16, 0.15, 0.12, 0.14, 0.13, 0.13, 0.14, 0.13, 0.17, 0.16,
        0.17, 0.14, 0.1, 0.16, 0.1, 0.15, 0.14, 0.08, 0.1, 0.11, 0.1,
        0.09, 0.11, 0.1, 0.11, 0.10, 0.10, 0.11, 0.10, 0.0, 0.08, 0.07,
        0.05, 0.04, 0.023, 0.007, 0.007, 0.007, 0.015, 0.00, 0.008, 0.007,
        0.007, 0.007, 0.007, 0.0, 0.010
    ]);

    document.querySelector(
        '[data-action="play"]'
    ).addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    document.querySelector(
        '[data-action="no-peaks"]'
    ).addEventListener('click', function () {
        wavesurfer.load('../media/demo.wav');
        document.body.scrollTop = 0;
    });

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
