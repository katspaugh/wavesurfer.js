'use strict';

let wavesurfer;

function init() {
    // configure
    let options = {
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

    // create an instance
    wavesurfer = WaveSurfer.create(options);

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    wavesurfer.load('../media/demo.wav');
}

// Init & load
document.addEventListener('DOMContentLoaded', init);
