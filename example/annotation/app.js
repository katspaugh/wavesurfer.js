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
        height: 100,
        scrollParent: true,
        normalize: true,
        minimap: true,
        backend: 'AudioElement'
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


    /* Regions */
    wavesurfer.enableDragSelection({
        color: randomColor(0.1)
    });

    wavesurfer.on('ready', function () {
        if (localStorage.regions) {
            loadRegions(JSON.parse(localStorage.regions));
        } else {
            wavesurfer.util.ajax({
                responseType: 'json',
                url: 'annotations.json'
            }).on('success', function (data) {
                loadRegions(data);
                saveRegions();
            });
        }
    });
    wavesurfer.on('region-click', function (region, e) {
        e.stopPropagation();
        // Play on click, loop on shift click
        e.shiftKey ? region.playLoop() : region.play();
    });
    wavesurfer.on('region-click', editAnnotation);
    wavesurfer.on('region-updated', saveRegions);
    wavesurfer.on('region-removed', saveRegions);
    wavesurfer.on('region-in', showNote);

    wavesurfer.on('region-play', function (region) {
        region.once('out', function () {
            wavesurfer.play(region.start);
            wavesurfer.pause();
        });
    });


    /* Minimap plugin */
    wavesurfer.initMinimap({
        height: 30,
        waveColor: '#ddd',
        progressColor: '#999',
        cursorColor: '#999'
    });


    /* Timeline plugin */
    wavesurfer.on('ready', function () {
        var timeline = Object.create(WaveSurfer.Timeline);
        timeline.init({
            wavesurfer: wavesurfer,
            container: "#wave-timeline"
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
function saveRegions() {
    localStorage.regions = JSON.stringify(
        Object.keys(wavesurfer.regions.list).map(function (id) {
            var region = wavesurfer.regions.list[id];
            return {
                start: region.start,
                end: region.end,
                data: region.data
            };
        })
    );
}


/**
 * Load regions from localStorage.
 */
function loadRegions(regions) {
    regions.forEach(function (region) {
        region.color = randomColor(0.1);
        wavesurfer.addRegion(region);
    });
}


/**
 * Detect regions separated by silence.
 */
function detectRegions() {
    // Silence params
    var minValue = 0.0015;
    var minSeconds = 0.25;

    var peaks = wavesurfer.backend.peaks;
    var length = peaks.length;
    var duration = wavesurfer.getDuration();
    var coef = duration / length;
    var minLen = (minSeconds / duration) * length;

    var regions = [];
    var i = 0;
    var start;
    var extend;
    while (i < length) {
        if (peaks[i] < minValue) {
            i += 1;
        } else {
            start = i;
            do {
                while (peaks[i] >= minValue) {
                    i += 1;
                }
                if (i - start < minLen) {
                    i += 1;
                } else {
                    var j = i;
                    while (peaks[j] < minValue) {
                        j += 1;
                    }
                    if (j - i < minLen) {
                        i = j;
                        extend = true;
                    } else {
                        regions.push({
                            start: Math.round(start * coef * 10) / 10,
                            end: Math.round(i * coef * 10) / 10
                        });
                        i += 1;
                        extend = false;
                    }
                }
            } while (extend)
        }
    }
    return regions;
}


/**
 * Random RGBA color.
 */
function randomColor(alpha) {
    return 'rgba(' + [
        ~~(Math.random() * 255),
        ~~(Math.random() * 255),
        ~~(Math.random() * 255),
        alpha || 1
    ] + ')';

}


/**
 * Edit annotation for a region.
 */
function editAnnotation (region) {
    var form = document.forms.edit;
    form.style.opacity = 1;
    form.elements.start.value = Math.round(region.start * 10) / 10,
    form.elements.end.value = Math.round(region.end * 10) / 10;
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
 * Display annotation.
 */
function showNote (region) {
    if (!showNote.el) {
        showNote.el = document.querySelector('#subtitle');
    }
    showNote.el.textContent = region.data.note || '–';
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
        },
        'export': function () {
            window.open('data:application/json;charset=utf-8,' +
                encodeURIComponent(localStorage.regions));
        }
    };

    document.addEventListener('click', function (e) {
        var action = e.target.getAttribute('data-action');
        if (action && action in handlers) {
            handlers[action](e);
        }
    });
});
