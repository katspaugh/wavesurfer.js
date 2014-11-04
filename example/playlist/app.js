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


// Play on audio load
wavesurfer.on('ready', function () {
    wavesurfer.play();
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


    // Play song from playlist
    var playlistSwitch = function (link) {
        // Toggle the active class
        if (playlistSwitch.active) {
            playlistSwitch.active.classList.remove('active');
        }
        playlistSwitch.active = link;
        link.classList.add('active');

        // Load the song
        wavesurfer.load(link.href);

        // Switch to the next song when finished
        var next = link.nextElementSibling;
        if (next) {
            wavesurfer.once('finish', function () {
                playlistSwitch(next);
                wavesurfer.load(next.href);
            });
        }
    };

    var links = document.querySelectorAll('#playlist a');
    [].forEach.call(links, function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            playlistSwitch(this);
        });
    });
    playlistSwitch(links[0]);
});
