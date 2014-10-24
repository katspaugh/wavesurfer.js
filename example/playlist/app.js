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
wavesurfer.on('ready', wavesurfer.play.bind(wavesurfer));


// Bind controls
document.addEventListener('DOMContentLoaded', function () {
    // Action handlers in HTML
    // E.g.: <button data-action="play">
    var handlers = {
        'play': function () {
            wavesurfer.play();
        },
        'pause': function () {
            wavesurfer.pause();
        },
        'load': function (e) {
            e.preventDefault();
            wavesurfer.load(e.target.href);
        }
    };
    document.addEventListener('click', function (e) {
        var action = e.target.dataset.action;
        if (action && action in handlers) {
            handlers[action](e);
        }
    });


    // Toggle play/pause buttons
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


    // Toggle active class in playlist
    var onClick = function () {
        if (onClick.active) {
            onClick.active.classList.remove('active');
        }
        onClick.active = this;
        this.classList.add('active');
    };
    var links = document.querySelectorAll('a[data-action="load"]');
    [].forEach.call(links, function (el) {
        el.addEventListener('click', onClick);
    });
    onClick.call(links[0]);
    // Load initial song
    wavesurfer.load(links[0].href);
});
