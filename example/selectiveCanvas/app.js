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
            displayStart : -5,
            zoneId : "ws1",
            dragThruZones : false
        })],
        renderer      : SelectionPlugin.SelectiveCanvas
    });


    wavesurfer.on('ready', () => {
        wavesurfer.addSelection({
            start : 5,
            end   : 10,
            color : 'rgba(0, 28, 142, 1)',
            minLength : 1,
            cssColor : true,
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
                    width : '3px',
                    'background-color':'#FFFFFF',
                    top: '8px',
                    height: '60%'
                },
                right : {
                    right : '12px',
                    width : '3px',
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

    wavesurfer.on('region-overlap-change', function(zone) {
        if (zone) {
            document.getElementsByClassName('wavesurfer-region')[0].classList.add("overlapped");
        } else {
            document.getElementsByClassName('wavesurfer-region')[0].classList.remove("overlapped");
        }
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


    document.querySelector(
        '[data-action="update"]'
    ).addEventListener('click', function() {
        let region = wavesurfer.selection.region;

        wavesurfer.updateDisplayRange({start:-10});
        region.update({ start : 0 });
        region.update({ end : 6 });
    });

    document.querySelector(
        '[data-action="zones"]'
    ).addEventListener('click', function() {
        document.querySelector('#zone1').style.visibility = 'visible';
        document.querySelector('#zone2').style.visibility = 'visible';
        wavesurfer.updateSelectionZones({
            ws2 : {
                start : 3,
                end : 5
            },
            ws3 : {
                start : 12,
                end : 14
            }
        }
        );
    });
});
