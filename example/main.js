'use strict';

var wavesurfer = Object.create(WaveSurfer);

wavesurfer.on('ready', function () {
    wavesurfer.play();
});

var requestFrame = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame;

wavesurfer.on('mark', function (marker) {
    var pos = marker.position;
    var origWidth = wavesurfer.params.markerWidth;

    (function animate (width) {
        requestFrame(function () {
            marker.update({ width: width });
            width > origWidth && animate(width - 1);
        });
    }(origWidth + 10));
});

// init & load mp3
document.addEventListener('DOMContentLoaded', function () {
    var options = {
        container     : document.querySelector('#waveform'),
        waveColor     : 'violet',
        progressColor : 'purple',
        loaderColor   : 'purple',
        cursorColor   : 'navy',
        markerWidth   : 2,
        skipLength    : 5
    };

    if ('#scroll' == location.hash) {
        options.minPxPerSec = 20;
        options.scrollParent = true;
    }

    wavesurfer.init(options);
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
