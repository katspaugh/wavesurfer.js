/**
 * Create a WaveSurfer instance.
 */
var wavesurfer = Object.create(WaveSurfer);

/**
 * Init & load.
 */
document.addEventListener('DOMContentLoaded', function () {
    // Init wavesurfer
    wavesurfer.init({
        container: '#waveform',
        waveColor: 'green',
        height: 100,
        scrollParent: true,
        normalize: true,
        backend: 'AudioElement'
    });

    wavesurfer.enableDragSelection({
        color: 'rgba(0, 0, 200, 0.1)'
    });

    wavesurfer.util.ajax({
        responseType: 'json',
        url: 'rashomon.json'
    }).on('success', function (data) {
        wavesurfer.load(
            'http://www.archive.org/download/mshortworks_001_1202_librivox/msw001_03_rashomon_akutagawa_mt_64kb.mp3',
            data
        );
    });

    wavesurfer.on('ready', localStorage.regions ? loadSegments : selectSegments);
    wavesurfer.on('region-click', function (region, e) {
        e.stopPropagation();
        region.play();
    });
    wavesurfer.on('region-dblclick', editAnnotation);
    wavesurfer.on('region-updated', saveSegments);
    wavesurfer.on('region-removed', saveSegments);

    wavesurfer.on('region-play', function (region) {
        region.once('out', function () {
            wavesurfer.play(region.start);
            wavesurfer.pause();
        });
    });


    /* Toggle play/pause buttons. */
    var playButton = document.querySelector('#play');
    var pauseButton = document.querySelector('#pause');
    wavesurfer.on('play', function () {
        playButton.style.display = 'none';
        pauseButton.style.display = '';
    });
    wavesurfer.on('pause', function () {
        playButton.style.display = '';
        pauseButton.style.display = 'none';
    });
});


/**
 * Save annotations to localStorage.
 */
function saveSegments() {
    localStorage.regions = JSON.stringify(
        Object.keys(wavesurfer.regions.list).map(function (id) {
            var region = wavesurfer.regions.list[id];
            return {
                start: region.start,
                end: region.end,
                color: region.color,
                data: region.data
            };
        })
    );
}


/**
 * Load segments from localStorage.
 */
function loadSegments() {
    var regions = JSON.parse(localStorage.regions);
    regions.forEach(function (region) {
        wavesurfer.addRegion(region);
    });
}


/**
 * Create segments separated by silence.
 */
function selectSegments() {
    var peaks = wavesurfer.backend.peaks;
    var length = peaks.length;
    var duration = wavesurfer.getDuration();

    var start = 0;
    var min = 0.001;
    for (var i = start; i < length; i += 1) {
        if (peaks[i] <= min && i > start + (1 / duration) * length) {
            var color = [
                ~~(Math.random() * 255),
                ~~(Math.random() * 255),
                ~~(Math.random() * 255),
                0.1
            ];
            wavesurfer.addRegion({
                color: 'rgba(' + color + ')',
                start: (start / length) * duration,
                end: (i / length) * duration
            });
            while (peaks[i] <= min) {
                i += 1;
            }
            start = i;
        }
    }
}


/**
 * Edit annotation for a segment.
 */
function editAnnotation (region) {
    var form = document.forms.edit;
    form.style.opacity = 1;
    form.elements.start.value = Math.floor(region.start);
    form.elements.end.value = Math.ceil(region.end);
    form.elements.note.value = region.data.note || '';
    form.onsubmit = function (e) {
        e.preventDefault();
        region.update({
            start: form.elements.start.value,
            end: form.elements.end.value,
            data: {
                note: form.elements.note.value
            }
        });
        form.style.opacity = 0;
    };
    form.onreset = function () {
        form.style.opacity = 0;
        form.dataset.region = null;
    };
    form.dataset.region = region.id;
}


/**
 * Bind controls.
 */
wavesurfer.once('ready', function () {
    var handlers = {
        'play': function () {
            wavesurfer.play();
        },
        'pause': function () {
            wavesurfer.pause();
        },
        'delete-region': function () {
            var form = document.forms.edit;
            var regionId = form.dataset.region;
            if (regionId) {
                wavesurfer.regions.list[regionId].remove();
                form.reset();
            }
        }
    };

    document.addEventListener('click', function (e) {
        var action = e.target.dataset && e.target.dataset.action;
        if (action && action in handlers) {
            handlers[action](e);
        }
    });
});
