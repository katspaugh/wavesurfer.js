'use strict';

// Create an instance
let wavesurfer;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        waveColor: 'black',
        backend: 'MediaElement',
        plugins: [
            WaveSurfer.mediasession.create({
                metadata: {
                    title: 'Wavesurfer.js Example',
                    artist: 'The Wavesurfer.js Project',
                    album: 'Media Session Plugin',
                    artwork: [
                        {
                            src: 'https://dummyimage.com/96x96',
                            sizes: '96x96',
                            type: 'image/png'
                        },
                        {
                            src: 'https://dummyimage.com/128x128',
                            sizes: '128x128',
                            type: 'image/png'
                        },
                        {
                            src: 'https://dummyimage.com/192x192',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'https://dummyimage.com/256x256',
                            sizes: '256x256',
                            type: 'image/png'
                        },
                        {
                            src: 'https://dummyimage.com/384x384',
                            sizes: '384x384',
                            type: 'image/png'
                        },
                        {
                            src: 'https://dummyimage.com/512x512',
                            sizes: '512x512',
                            type: 'image/png'
                        }
                    ]
                }
            })
        ]
    });

    // controls
    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    // load audio from existing media element
    let mediaElt = document.querySelector('audio');
    wavesurfer.load(mediaElt);
});
