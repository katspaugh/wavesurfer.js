// Create an instance
var wavesurfer;
let wavesurferWithOptions;

window.onload = function() {
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        splitChannels: true
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurfer.load('../media/stereo.mp3');

    // Play/pause on button press
    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    // Drag'n'drop
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

    // WaveSurfer with options example
    wavesurferWithOptions = WaveSurfer.create({
        container: document.querySelector('#waveform-with-options'),
        splitChannels: true,
        splitChannelsOptions: {
            overlay: false,
            channelColors: {
                0: {
                    progressColor: 'green',
                    waveColor: 'pink'
                },
                1: {
                    progressColor: 'orange',
                    waveColor: 'purple'
                }
            },
            filterChannels: [],
            relativeNormalization: true
        }
    });

    wavesurferWithOptions.on('error', function(e) {
        console.warn(e);
    });

    // Load audio from URL
    wavesurferWithOptions.load('../media/stereo.mp3');

    // Play/pause on button press
    document
        .getElementById('play-button')
        .addEventListener('click', wavesurferWithOptions.playPause.bind(wavesurferWithOptions));

};
