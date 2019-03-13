'use strict';

// Create an instance
var wavesurfer, TiledRendererPlugin;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    TiledRendererPlugin = WaveSurfer.tiledrenderer;

    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        container:      '#waveform',
        waveColor:      'violet',
        progressColor:  'purple',
        splitChannels:  false,
        interact:       false,
        fillParent:     false,
        scrollParent:   true,
        partialRender:  false,
        renderer:       TiledRendererPlugin.TiledRenderer
    });

    // Patch in override to the drawBuffer function
    wavesurfer.drawBuffer = TiledRendererPlugin.tiledDrawBuffer;

    // Log errors
    wavesurfer.on('error', function(msg) {
        console.log(msg);
    });

    // Load media from URL
    wavesurfer.load('../media/demo.wav');

    // Zoom slider
    var slider = document.querySelector('[data-action="zoom"]');

    slider.value = wavesurfer.params.minPxPerSec;
    slider.min = wavesurfer.params.minPxPerSec;
    slider.addEventListener('input', function() {
        wavesurfer.zoom(Number(this.value));
    });

    // Bind play/pause button
    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    // Progress bar
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
});
