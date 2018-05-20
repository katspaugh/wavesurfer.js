'use strict';

var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    var options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [
            WaveSurfer.timeline.create({
                container: '#wave-timeline'
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

    // Init wavesurfer
    wavesurfer = WaveSurfer.create(options);

    wavesurfer.load('../example/media/demo.wav');
});
