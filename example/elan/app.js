'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load
document.addEventListener('DOMContentLoaded', function () {
    var options = {
        container     : '#waveform',
        waveColor     : 'violet',
        progressColor : 'purple',
        loaderColor   : 'purple',
        cursorColor   : 'navy'
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 20;
        options.scrollParent = true;
    }

    if (location.search.match('canvas')) {
        options.renderer = 'Canvas';
    }

    if (location.search.match('svg')) {
        options.renderer = 'SVG';
    }

    /* Progress bar */
    var progressDiv = document.querySelector('#progress-bar');
    var progressBar = progressDiv.querySelector('.progress-bar');
    progressBar.style.width = '100%';
    wavesurfer.on('ready', function () {
        progressDiv.style.display = 'none';
    });

    // Init wavesurfer
    wavesurfer.init(options);

    // Init ELAN plugin
    var elan = Object.create(WaveSurfer.ELAN);

    elan.init({
        url: 'transcripts/001z.eaf',
        container: '#annotations',
        tiers: {
            Text: true,
            Comments: true
        }
    });

    var unitFactor;

    elan.on('ready', function (data, container) {
        var url = data.media.url.replace(/file:\/+/, 'transcripts/');
        wavesurfer.load(url);
        container.querySelector('table').classList.add(
            'table', 'table-striped', 'table-hover'
        );
    });

    wavesurfer.on('ready', function () {
        elan.on('select', function (annotation) {
            wavesurfer.backend.play(annotation.start, annotation.end);
        });
    });

    wavesurfer.on('ready', function () {
        var sectionStart = wavesurfer.mark({
            position: -1, color: 'green'
        });
        var sectionEnd = wavesurfer.mark({
            position: -1, color: 'green'
        });

        var prevRow;
        wavesurfer.on('progress', function () {
            var annotation = elan.getAnnotation(
                wavesurfer.backend.getCurrentTime()
            );
            var row = elan.getAnnotationRow(annotation);
            if (row && prevRow != row) {
                sectionStart.update({ position: annotation.start });
                sectionEnd.update({ position: annotation.end });

                prevRow && prevRow.classList.remove('success');
                row.classList.add('success');

                var before = row.previousSibling;
                if (before) {
                    elan.container.scrollTop = before.offsetTop;
                }

                prevRow = row;
            }
        });

        wavesurfer.play();
    });
});


// Bind buttons and keypresses
wavesurfer.on('ready', function () {
    var handlers = {
        'play': function () {
            wavesurfer.playPause();
        },

        'back': function () {
            wavesurfer.skipBackward();
        },

        'forth': function () {
            wavesurfer.skipForward();
        }
    };

    var map = {
        32: 'play',       // space
        37: 'back',       // left
        39: 'forth'       // right
    };

    document.addEventListener('keydown', function (e) {
        if (e.keyCode in map) {
            e.preventDefault();
            var handler = handlers[map[e.keyCode]];
            handler && handler(e);
        }
    });

    document.addEventListener('click', function (e) {
        var action = e.target.dataset && e.target.dataset.action;
        if (action && action in handlers) {
            handlers[action](e);
        }
    });
});
