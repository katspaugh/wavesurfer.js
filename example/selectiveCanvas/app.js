'use strict';

// Create an instance
var wavesurfer;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    const SelectionPlugin = WaveSurfer.selection;
    // Init
    wavesurfer = WaveSurfer.create({
        barGap        : 1,
        barHeight     : 0.9,
        barMinHeight  : 1,
        barWidth      : 1,
        height        : '40',
        container: document.querySelector('#waveform'),
        cursorColor   : '#000000',
        cursorWidth   : 1,
        progressColor : '#9BA9DF',
        responsive    : false,
        waveColor     : '#9BA9DF',
        scrollParent  : false,
        hideScrollbar : false,
        fillParent    : false,
        plugins       : [WaveSurfer.selection.create({
            selection : [{}],
            displayDuration : 20,
            displayStart : -2
        })],
        renderer      : SelectionPlugin.SelectiveCanvas
    });


    wavesurfer.on('ready', () => {
        wavesurfer.addSelection({
            start : 3,
            end   : 9,
            color : 'rgba(0, 28, 142, 1)',
            minLength : 0.2,
            regionStyle : {
                "border-radius": '13px'
            },
            decoratorStyle : {
                'border-width' : '3px',
                'border-color' : '#de0010',
                'border-style' : 'solid',
                left:'0px',
                top: '0px',
                'border-radius': 'inherit'
            },
            handleStyle : {
                left : {
                    left : '12px',
                    width : '4px',
                    'background-color':'#FFFFFF',
                    top: '8px',
                    height: '60%'
                },
                right : {
                    right : '12px',
                    width : '4px',
                    top: '8px',
                    height: '60%',
                    'background-color':'#FFFFFF'
                }
            }

        });
        window.ws = wavesurfer;
        window.peakCache = wavesurfer.backend.mergedPeaks;
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/count.wav');


    document.querySelector(
        '[data-action="play"]'
    ).addEventListener('click', function() {
        let region = wavesurfer.selection.region;
        region.play();
    });

    document.querySelector(
        '[data-action="pause"]'
    ).addEventListener('click', function() {
        wavesurfer.pause();
    });
});
