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
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    if (location.search.match('normalize')) {
        options.normalize = true;
    }

    /* Progress bar */
    var progressDiv = document.querySelector('#progress-bar');
    var progressBar = progressDiv.querySelector('.progress-bar');
    wavesurfer.on('loading', function (percent) {
        progressDiv.style.display = 'block';
        progressBar.style.width = percent + '%';
    });
    wavesurfer.on('ready', function () {
        progressDiv.style.display = 'none';
    });

    // Init wavesurfer
    wavesurfer.init(options);

    // Init ELAN plugin
    var elan = Object.create(WaveSurfer.ELAN);

    elan.init({
        url: 'transcripts/001z.xml',
        container: '#annotations',
        tiers: {
            Text: true,
            Comments: true
        }
    });

    elan.on('ready', function (data) {
        wavesurfer.load('transcripts/' + data.media.url);
    });

    elan.on('select', function (start, end) {
        wavesurfer.backend.play(start, end);
    });

    elan.on('ready', function () {
        var classList = elan.container.querySelector('table').classList;
        [ 'table', 'table-striped', 'table-hover' ].forEach(function (cl) {
            classList.add(cl);
        });
    });

    var prevAnnotation, prevRow;
    var onProgress = function () {
        var time = wavesurfer.backend.getCurrentTime();
        var annotation = elan.getRenderedAnnotation(time);

        if (prevAnnotation != annotation) {
            prevAnnotation = annotation;

            if (annotation) {
                // Highlight annotation table row
                var row = elan.getAnnotationNode(annotation);
                prevRow && prevRow.classList.remove('success');
                prevRow = row;
                row.classList.add('success');
                var before = row.previousSibling;
                if (before) {
                    elan.container.scrollTop = before.offsetTop;
                }

                var start = annotation.start;
                var end = annotation.end;
            } else {
                start = -100;
                end = -100;
            }

            // Markers
            wavesurfer.mark({
                id: 'start',
                position: start,
                color: 'green'
            });
            wavesurfer.mark({
                id: 'end',
                position: end,
                color: 'red'
            });

        }
    };

    wavesurfer.on('progress', onProgress);
});


// Bind buttons and keypresses
wavesurfer.on('ready', function () {
    var handlers = {
        'play': function () {
            wavesurfer.playPause();
        }
    };

    var map = {
        32: 'play'       // spacebar
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
