'use strict';

var wavesurfer;

// Init & load
function initAndLoadSpectrogram(colorMap) {
    // Create an instance
    let options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [
            WaveSurfer.spectrogram.create({
                container: '#wave-spectrogram',
                labels: true,
                colorMap: colorMap,
                fftSamples: 1024,
                height: 256
            })
        ]
    };

    wavesurfer = WaveSurfer.create(options);

    /* Progress bar */
    (function() {
        let progressDiv = document.querySelector('#progress-bar');
        let progressBar = progressDiv.querySelector('.progress-bar');

        let showProgress = function(percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        let hideProgress = function() {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    })();

    wavesurfer.load('../media/demo.wav');

    // Zoom slider
    let slider = document.querySelector('[data-action="zoom"]');

    slider.value = wavesurfer.params.minPxPerSec;
    slider.min = wavesurfer.params.minPxPerSec;
    slider.max = 250;


    slider.addEventListener('input', function() {
        wavesurfer.zooming(slider.value);
    });
    slider.addEventListener('mouseup', function() {
        wavesurfer.zoom(slider.value);

        let desiredWidth = Math.max(parseInt(wavesurfer.container.offsetWidth * window.devicePixelRatio),
            parseInt(wavesurfer.getDuration() * slider.value * window.devicePixelRatio));
        wavesurfer.spectrogram.width = desiredWidth;
        wavesurfer.spectrogram.render();
    });

    // set initial zoom to match slider value
    wavesurfer.zoom(slider.value);
}

document.addEventListener('DOMContentLoaded', function() {
    // Load a colormap json file to be passed to the spectrogram.create method.
    WaveSurfer.util
        .fetchFile({ url: 'hot-colormap.json', responseType: 'json' })
        .on('success', colorMap => {
            initAndLoadSpectrogram(colorMap);
        });
});
