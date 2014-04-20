'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686'
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    // Equalizer
    wavesurfer.on('ready', function () {
        var EQ = [
            {
                f: 32,
                type: 'LOWSHELF'
            }, {
                f: 64,
                type: 'PEAKING'
            }, {
                f: 125,
                type: 'PEAKING'
            }, {
                f: 250,
                type: 'PEAKING'
            }, {
                f: 500,
                type: 'PEAKING'
            }, {
                f: 1000,
                type: 'PEAKING'
            }, {
                f: 2000,
                type: 'PEAKING'
            }, {
                f: 4000,
                type: 'PEAKING'
            }, {
                f: 8000,
                type: 'PEAKING'
            }, {
                f: 16000,
                type: 'HIGHSHELF'
            }
        ];

        // Create filters
        var filters = EQ.map(function (band) {
            var filter = wavesurfer.backend.ac.createBiquadFilter();
            filter.type = filter[band.type];
            filter.gain.value = 0;
            filter.Q.value = 1;
            filter.frequency.value = band.f;
            return filter;
        });

        // Connect filters in a series
        filters.forEach(function (filter, index) {
            if (index < filters.length - 1) {
                filter.connect(filters[index + 1]);
            }
        });

        // Connect the last filter to wavesurfer
        wavesurfer.backend.setFilter(filters[0], filters[filters.length - 1]);

        // Bind filters to vertical range sliders
        var container = document.querySelector('#equalizer');
        filters.forEach(function (filter) {
            var input = document.createElement('input');
            wavesurfer.util.extend(input, {
                type: 'range',
                min: -40,
                max: 40,
                value: 0,
                title: filter.frequency.value
            });
            input.setAttribute('orient', 'vertical');
            wavesurfer.drawer.style(input, {
                'webkitAppearance': 'slider-vertical',
                width: '50px',
                height: '150px'
            });
            container.appendChild(input);

            var onChange = function (e) {
                filter.gain.value = ~~e.target.value;
            };

            input.addEventListener('input', onChange);
            input.addEventListener('change', onChange);
        });

        // For debugging
        wavesurfer.filters = filters;
    });

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
