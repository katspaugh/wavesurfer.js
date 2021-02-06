'use strict';

// Create an instance
let wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    let options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        selectionColor: '#d0e9c6',
        loopSelection: false,
        plugins: [
            WaveSurfer.elan.create({
                url: 'transcripts/001z.xml',
                container: '#annotations',
                tiers: {
                    Text: true,
                    Comments: true
                }
            }),
            WaveSurfer.regions.create()
        ]
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    if (location.search.match('normalize')) {
        options.normalize = true;
    }

    // Init wavesurfer
    wavesurfer = WaveSurfer.create(options);

    /* Progress bar */
    (function() {
        let progressDiv = document.querySelector('#progress-bar');
        let progressBar = progressDiv.querySelector('.progress-bar');

        let showProgress = function(percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        let hideProgress = function() {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    })();

    wavesurfer.elan.on('ready', function(data) {
        wavesurfer.load('transcripts/' + data.media.url);
    });

    wavesurfer.elan.on('select', function(start, end) {
        wavesurfer.backend.play(start, end);
    });

    wavesurfer.elan.on('ready', function() {
        let classList = wavesurfer.elan.container.querySelector('table')
            .classList;
        ['table', 'table-striped', 'table-hover'].forEach(function(cl) {
            classList.add(cl);
        });
    });

    let prevAnnotation, prevRow, region;
    let onProgress = function(time) {
        let annotation = wavesurfer.elan.getRenderedAnnotation(time);

        if (prevAnnotation != annotation) {
            prevAnnotation = annotation;

            region && region.remove();
            region = null;

            if (annotation) {
                // Highlight annotation table row
                let row = wavesurfer.elan.getAnnotationNode(annotation);
                prevRow && prevRow.classList.remove('success');
                prevRow = row;
                row.classList.add('success');
                let before = row.previousSibling;
                if (before) {
                    wavesurfer.elan.container.scrollTop = before.offsetTop;
                }

                // Region
                region = wavesurfer.addRegion({
                    start: annotation.start,
                    end: annotation.end,
                    resize: false,
                    color: 'rgba(223, 240, 216, 0.7)'
                });
            }
        }
    };

    wavesurfer.on('audioprocess', onProgress);

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });
});
