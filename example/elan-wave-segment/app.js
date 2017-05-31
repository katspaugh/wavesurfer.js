'use strict';

// Create the wave surfer instance
var wavesurfer = Object.create(WaveSurfer);

// Create elan instance
var elan = Object.create(WaveSurfer.ELAN);

// Create Elan Wave Segment instance
var elanWaveSegment = Object.create(WaveSurfer.ELANWaveSegment);

// Init & load
document.addEventListener('DOMContentLoaded', function () {
    var options = {
        container     : '#waveform',
        waveColor     : 'navy',
        progressColor : 'blue',
        loaderColor   : 'purple',
        cursorColor   : 'navy',
        selectionColor: '#d0e9c6',
        backend: 'WebAudio',
        loopSelection : false,
        renderer: 'Canvas',
        waveSegmentRenderer: 'Canvas',
        waveSegmentHeight: 50,
        height: 100,
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    if (location.search.match('normalize')) {
        options.normalize = true;
    }

    // ############################# set up event handlers ###########################
    /* Progress bar */
    (function () {
        var progressDiv = document.querySelector('#progress-bar');
        var progressBar = progressDiv.querySelector('.progress-bar');

        var showProgress = function (percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        var hideProgress = function () {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    }());

    elan.on('select', function (start, end) {
        wavesurfer.backend.play(start, end);
    });

    //set up listener for when elan is done
    elan.on('ready', function (data) {
        //go load the wave form
        wavesurfer.load('../elan/transcripts/001z.mp3');

        //add some styling to elan table
        var classList = elan.container.querySelector('table').classList;
        [ 'table', 'table-striped', 'table-hover' ].forEach(function (cl) {
            classList.add(cl);
        });
    });

    //############################## initialize wavesurfer and related plugins###############

    // Init wavesurfer
    wavesurfer.init(options);

    //init elan
    elan.init({
        url: '../elan/transcripts/001z.xml',
        container: '#annotations',
        tiers: {
            Text: true,
            Comments: true
        }
    });

    //int elanWaveSegment when wavesurfer is done loading the soud file
    wavesurfer.on('ready', function() {
        options.plotTimeEnd = wavesurfer.backend.getDuration();
        options.wavesurfer = wavesurfer;
        options.ELAN = elan;
        options.scrollParent = false;
        elanWaveSegment.init(options);
    });


    var prevAnnotation, prevRow, region;
    var onProgress = function (time) {
        elanWaveSegment.onProgress(time);
        var annotation = elan.getRenderedAnnotation(time);

        if (prevAnnotation != annotation) {
            prevAnnotation = annotation;

            region && region.remove();
            region = null;

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
});
