var wavesurfer = Object.create(WaveSurfer);

wavesurfer.on('ready', function () {
//    wavesurfer.playPause();
});

wavesurfer.on('mark', function (marker) {
    var pos = marker.position;

    (function animate (width) {
        webkitRequestAnimationFrame(function (t) {
            marker.width = width;
            marker.position = pos - width / 2 - 1;
            width > 1 && animate(width - 1);
        });
    }(10));
});

// init & load mp3
window.addEventListener('load', function () {
    wavesurfer.init({
        container     : document.querySelector('.waveform'),
        fillParent    : true,
        markerColor   : 'rgba(0, 0, 0, 0.5)',
        frameMargin   : 0.1,
        maxSecPerPx   : parseFloat(location.hash.substring(1)),
        loadPercent   : true,
        waveColor     : 'violet',
        progressColor : 'purple',
        loadingColor  : 'purple',
        cursorColor   : 'navy'
    });

    wavesurfer.load('examples/webaudio/media/sonnet_23.mp3');
});

// Bind buttons and keypresses
window.addEventListener('load', function () {
    'use strict';

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
