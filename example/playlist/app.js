// Create a WaveSurfer instance
var wavesurfer = Object.create(WaveSurfer);


// Init on DOM ready
document.addEventListener('DOMContentLoaded', function () {
    wavesurfer.init({
        container: '#waveform',
        waveColor: '#428bca',
        progressColor: '#31708f',
        height: 35
    });
});


// Bind controls
document.addEventListener('DOMContentLoaded', function () {
    // Play button
    var playButton = document.querySelector('#play');
    playButton.addEventListener('click', function () {
        wavesurfer.play();
    });

    // Pause button
    var pauseButton = document.querySelector('#pause');
    pauseButton.addEventListener('click', function () {
        wavesurfer.pause();
    });

    // Toggle play/pause text
    wavesurfer.on('play', function () {
        playButton.style.display = 'none';
        pauseButton.style.display = '';
    });
    wavesurfer.on('pause', function () {
        playButton.style.display = '';
        pauseButton.style.display = 'none';
    });


    // The playlist links
    var links = document.querySelectorAll('#playlist a');
    var currentTrack = 0;

    // Load a track by index and highlight the corresponding link
    var setCurrentSong = function (index) {
        links[currentTrack].classList.remove('active');
        currentTrack = index;
        links[currentTrack].classList.add('active');
        wavesurfer.load(links[currentTrack].href);
    };

    // Load the track on click
    Array.prototype.forEach.call(links, function (link, index) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            setCurrentSong(index);
        });
    });

    // Play on audio load
    wavesurfer.on('ready', function () {
        wavesurfer.play();
    });

    // Go to the next track on finish
    wavesurfer.on('finish', function () {
        setCurrentSong((currentTrack + 1) % links.length);
    });

    // Load the first track
    setCurrentSong(currentTrack);
});
