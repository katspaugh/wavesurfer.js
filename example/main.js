'use strict';

var wavesurfer = Object.create(WaveSurfer);

wavesurfer.on('ready', function () {
    wavesurfer.playAt(0);
});

wavesurfer.on('mark', function (marker) {
    var pos = marker.position;

    (function animate (width) {
        webkitRequestAnimationFrame(function () {
            marker.update({ width: width });
            width > 1 && animate(width - 1);
        });
    }(10));
});

// init & load mp3
document.addEventListener('DOMContentLoaded', function () {
    wavesurfer.init({
        container     : document.querySelector('.waveform'),
        fillParent    : true,
        markerColor   : 'rgba(0, 0, 0, 0.5)',
        frameMargin   : 0.1,
        maxSecPerPx   : parseFloat(location.hash.substring(1)),
        loadPercent   : true,
        waveColor     : 'violet',
        progressColor : 'purple',
        loaderColor   : 'purple',
        cursorColor   : 'navy'
    });

    wavesurfer.bindMarks();

    wavesurfer.bindDragNDrop();

    wavesurfer.load('example/media/Serphonic_-_Switch_2.mp3');
});

// Bind buttons and keypresses
document.addEventListener('DOMContentLoaded', function () {
    var eventHandlers = {
        'play': function () {
            wavesurfer.playPause();
        },

        'green-mark': function () {
            wavesurfer.mark({
                id: 'up',
                color: 'rgba(0, 255, 0, 0.5)'
            });
        },

        'red-mark': function () {
            wavesurfer.mark({
                id: 'down',
                color: 'rgba(255, 0, 0, 0.5)'
            });
        },

        'back': function () {
            wavesurfer.skipBackward();
        },

        'forth': function () {
            wavesurfer.skipForward();
        }
    };

    document.addEventListener('keyup', function (e) {
        var map = {
            32: 'play',       // space
            38: 'green-mark', // up
            40: 'red-mark',   // down
            37: 'back',       // left
            39: 'forth'       // right
        };
        if (e.keyCode in map) {
            var handler = eventHandlers[map[e.keyCode]];
            e.preventDefault();
            handler && handler(e);
        }
    });

    document.addEventListener('click', function (e) {
        var action = e.target.dataset && e.target.dataset.action;
        if (action && action in eventHandlers) {
            eventHandlers[action](e);
        }
    });
});
