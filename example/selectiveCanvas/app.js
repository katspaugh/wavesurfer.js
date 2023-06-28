'use strict';

// vars for zone demo
const duration = 20;
const zones = {
    ws2 : {
        start : 3,
        end : 5
    },
    ws3 : {
        start : 12,
        end : 14
    },
    ws4 : {
        start : 8,
        end : 10
    }
};


// Create an instance
var wavesurfer;

function format(num) {
    return Math.round(num * 10) / 10;
}

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
            selections : [{}],
            boundaryDuration : duration,
            zoneId : "ws1",
            dragThruZones : false,
            hideBarEnds: 2,
            regionGap: 2
        })],
        renderer      : SelectionPlugin.SelectiveCanvas
    });


    wavesurfer.on('ready', () => {
        wavesurfer.addSelection({
            selectionStart : 10,
            start : 5,
            end   : 10,
            color : 'rgba(0, 28, 142, 1)',
            minLength : 1,
            minDisplayLength : 0.3,
            cssColor : false,
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

    wavesurfer.on('seek', () => {
        document.getElementById("regionTime").innerHTML = `Cursor Time within Region = ${format(wavesurfer.getCurrentTime())}`;
        document.getElementById("boundaryTime").innerHTML = `Cursor Time within Boundary = ${format(wavesurfer.getBoundaryTime())}`;
    });

    wavesurfer.on('audioprocess', () => {
        document.getElementById("regionTime").innerHTML = `Cursor Time within Region = ${format(wavesurfer.getCurrentTime())}`;
        document.getElementById("boundaryTime").innerHTML = `Cursor Time within Boundary = ${format(wavesurfer.getBoundaryTime())}`;
    });


    wavesurfer.on('region-update-end', function(data) {
        const zones = wavesurfer.getSelectionZones();
        const {audioEnd, audioStart, boundaryDuration, selectionStart} = data;

        console.log(JSON.stringify({
            zones,
            audioEnd,
            audioStart,
            boundaryDuration,
            selectionStart
        }));

    });

    wavesurfer.on('region-updated', function(data) {
        //console.log(data.selectionStart);
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
        const selectionStart = document.getElementById('selectionStart').value;
        const audioStart = document.getElementById('audioStart').value;
        const audioEnd = document.getElementById('audioEnd').value;

        wavesurfer.updateSelectionData({
            selectionStart,
            audioStart,
            audioEnd
        });
    });

    document.querySelector(
        '[data-action="zones"]'
    ).addEventListener('click', function() {
        Object.entries(zones).forEach(([id, val]) => {
            const zoneDiv = document.createElement('div');
            const container = document.getElementById('zoneContainer');
            zoneDiv.id = id;

            const width = (val.end - val.start) / duration;
            const left = val.start / duration;

            zoneDiv.style.height = "60px";
            zoneDiv.style.top = 0;
            zoneDiv.style.background = "rgba(200, 100, 100, 0.5)";
            zoneDiv.style.position = "absolute";
            zoneDiv.style.zIndex = "4";
            zoneDiv.style.width = `${width * 100}%`;
            zoneDiv.style.marginLeft = `${left * 100 }%`;

            container.append(zoneDiv);
        });
        wavesurfer.updateSelectionZones(zones, true);
    });

    document.querySelector(
        '[data-action="zones2"]'
    ).addEventListener('click', function() {
        const id = Object.keys(zones).pop();
        const el = document.getElementById(id);
        if (el) {
            el.remove();
            delete zones[id];
        }
        wavesurfer.updateSelectionZones(zones, true, true);
    });
});
