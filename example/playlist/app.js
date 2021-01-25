// Create a WaveSurfer instance
let wavesurfer;

// Init on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#428bca',
        progressColor: '#31708f',
        height: 120,
        barWidth: 3
    });
});

// Bind controls
document.addEventListener('DOMContentLoaded', function() {
    let playPause = document.querySelector('#playPause');
    playPause.addEventListener('click', function() {
        wavesurfer.playPause();
    });

    // Toggle play/pause text
    wavesurfer.on('play', function() {
        document.querySelector('#play').style.display = 'none';
        document.querySelector('#pause').style.display = '';
    });
    wavesurfer.on('pause', function() {
        document.querySelector('#play').style.display = '';
        document.querySelector('#pause').style.display = 'none';
    });

    // The playlist links
    let links = document.querySelectorAll('#playlist a');
    let currentTrack = 0;

    // Load a track by index and highlight the corresponding link
    let setCurrentSong = function(index) {
        links[currentTrack].classList.remove('active');
        currentTrack = index;
        links[currentTrack].classList.add('active');
        wavesurfer.load(links[currentTrack].href);
    };

    // Load the track on click
    Array.prototype.forEach.call(links, function(link, index) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            setCurrentSong(index);
        });
    });

    // Play on audio load
    wavesurfer.on('ready', function() {
        wavesurfer.play();
    });

    wavesurfer.on('error', function(e) {
        console.warn(e);
    });

    // Go to the next track on finish
    wavesurfer.on('finish', function() {
        setCurrentSong((currentTrack + 1) % links.length);
    });

    // Load the first track
    setCurrentSong(currentTrack);
});
