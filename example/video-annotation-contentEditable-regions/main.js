// Create an instance
var wavesurfer;

const regionsInit = [
    {
        "start": 2.509953716438861,
        "end": 4.689913517967433,
        "data": {
            "text": "Hello down there on the good Earth"
        }
    },
    {
        "start": 4.979908170464354,
        "end": 7.339864652853083,
        "data": {
            "text": "and all the best from the International space station. "
        }
    },
    {
        "start": 7.499907432877723,
        "end": 10.659999631206684,
        "data": {
            "text": "I am expedition 57th commander Alexander Guest, "
        }
    },
    {
        "start": 10.94,
        "end": 12.250061772880404,
        "data": {
            "text": "and next to me we have "
        }
    },
    {
        "start": 12.28977337650741,
        "end": 13.67974774537196,
        "data": {
            "text": "Serena Auñón-Chancellor "
        }
    },
    {
        "start": 13.709747192181986,
        "end": 14.539731887259379,
        "data": {
            "text": "flight engineer"
        }
    },
    {
        "start": 14.77972746173959,
        "end": 15.69971049724706,
        "data": {
            "text": "from NASA"
        }
    }
];

async function getRegions(){
    const regionsSavedString = await localStorage.getItem('regions');
    const regionsSaved = JSON.parse(regionsSavedString);
    const regions = regionsSaved || regionsInit;
    return regions;
}

async function initWavesurfer() {
    const regions = await getRegions();

    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        height: 100,
        pixelRatio: 1,
        minPxPerSec: 100,
        scrollParent: true,
        normalize: true,
        splitChannels: false,
        backend: 'MediaElement',
        plugins: [
            WaveSurfer.regions.create({
                contentEditable: true,
                dragSelection: true,
                removeButton: true,
                regions
            }),
            WaveSurfer.minimap.create({
                height: 30,
                waveColor: '#ddd',
                progressColor: '#999'
            }),
            WaveSurfer.timeline.create({
                container: '#wave-timeline'
            }),
            WaveSurfer.cursor.create()
        ]
    });

    // Load audio from existing media element
    let mediaElt = document.querySelector('video');

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    wavesurfer.load(mediaElt);

    wavesurfer.on('region-click', function(region, e) {
        e.stopPropagation();
        // Play on click, loop on shift click
        e.shiftKey ? region.playLoop() : region.play();
    });
    wavesurfer.on('region-update-end', saveRegions);
    wavesurfer.on('region-updated', saveRegions);
    wavesurfer.on('region-removed', saveRegions);

    /* Toggle play/pause buttons. */
    let playButton = document.querySelector('#play');
    let pauseButton = document.querySelector('#pause');

    wavesurfer.on('play', function() {
        playButton.style.display = 'none';
        pauseButton.style.display = 'block';
    });
    wavesurfer.on('pause', function() {
        playButton.style.display = 'block';
        pauseButton.style.display = 'none';
    });

    return {regions, wavesurfer};
}

// Init & load audio file
document.addEventListener('DOMContentLoaded', async function() {
    const {regions} = await initWavesurfer();
    updateOutput(JSON.stringify(regions, null, 2));
});

/**
 * Save annotations to localStorage.
 */
function saveRegions() {
    const regionsArray = Object.keys(wavesurfer.regions.list).map(id => {
        const region = wavesurfer.regions.list[id];
        const {start, end, data} = region;
        return {start, end, data};
    }).sort((a, b)=> (a.start - b.start));

    localStorage.regions = JSON.stringify(regionsArray);
    updateOutput(JSON.stringify(regionsArray, null, 2));
}

const outputEl = document.querySelector('#output');

/**
 * Visible text representation of regions
 */
function updateOutput(text){
    outputEl.innerText = text;
}

/**
 * Random RGBA color.
 */
function randomColor(alpha) {
    return (
        'rgba(' +
        [
            ~~(Math.random() * 255),
            ~~(Math.random() * 255),
            ~~(Math.random() * 255),
            alpha || 1
        ] +
        ')'
    );
}
