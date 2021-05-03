'use strict';

// Create an instance
var wavesurfer;

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    let options = {
        container: document.querySelector('#waveform'),
        waveColor: 'violet',
        progressColor: 'purple',
        cursorColor: 'navy'
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    // Init
    wavesurfer = WaveSurfer.create(options);
    // Load audio from URL
    wavesurfer.load('example/media/demo.wav');

    // Regions
    if (wavesurfer.enableDragSelection) {
        wavesurfer.enableDragSelection({
            color: 'rgba(0, 255, 0, 0.1)'
        });
    }
});

// Play at once when ready
// Won't work on iOS until you touch the page
wavesurfer.on('ready', function() {
    //wavesurfer.play();
});

// Report errors
wavesurfer.on('error', function(err) {
    console.error(err);
});

// Do something when the clip is over
wavesurfer.on('finish', function() {
    console.log('Finished playing');
});

/* Progress bar */
document.addEventListener('DOMContentLoaded', function() {
    const progressDiv = document.querySelector('#progress-bar');
    const progressBar = progressDiv.querySelector('.progress-bar');

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
});

// Drag'n'drop
document.addEventListener('DOMContentLoaded', function() {
    let toggleActive = function(e, toggle) {
        e.stopPropagation();
        e.preventDefault();
        toggle
            ? e.target.classList.add('wavesurfer-dragover')
            : e.target.classList.remove('wavesurfer-dragover');
    };

    let handlers = {
        // Drop event
        drop: function(e) {
            toggleActive(e, false);

            // Load the file into wavesurfer
            if (e.dataTransfer.files.length) {
                wavesurfer.loadBlob(e.dataTransfer.files[0]);
            } else {
                wavesurfer.fireEvent('error', 'Not a file');
            }
        },

        // Drag-over event
        dragover: function(e) {
            toggleActive(e, true);
        },

        // Drag-leave event
        dragleave: function(e) {
            toggleActive(e, false);
        }
    };

    let dropTarget = document.querySelector('#drop');
    Object.keys(handlers).forEach(function(event) {
        dropTarget.addEventListener(event, handlers[event]);
    });
});
