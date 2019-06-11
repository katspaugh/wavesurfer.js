'use strict';

var wavesurfer;

function init() {
    // configure
    var options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [
            WaveSurfer.minimap.create({
                container: '#wave-minimap',
                waveColor: '#777',
                progressColor: '#222',
                height: 50
            })
        ]
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    if (location.search.match('normalize')) {
        options.normalize = true;
    }

    // create an instance
    wavesurfer = WaveSurfer.create(options);

    /* Progress bar */
    (function() {
        var progressDiv = document.querySelector('#progress-bar');
        var progressBar = progressDiv.querySelector('.progress-bar');

        var showProgress = function(percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        var hideProgress = function() {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    })();

    wavesurfer.load('../media/demo.wav');
}

// Init & load
document.addEventListener('DOMContentLoaded', init);
