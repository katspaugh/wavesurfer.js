window.addEventListener('load', function () {
    'use strict';

    var wavesurfer = Object.create(WaveSurfer);

    wavesurfer.init({
        canvas        : document.querySelector('.waveform canvas'),
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
            32: 'play',
            38: 'green-mark',
            40: 'red-mark',
            37: 'back',
            39: 'forth'
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
}, false);
