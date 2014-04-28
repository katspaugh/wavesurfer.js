'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        minPxPerSec: 50,
        scrollParent: true
    });

    // Load audio from URL
    var ajax = wavesurfer.util.ajax({
        url: 'http://ex.fm/api/v3/trending',
        responseType: 'json'
    });
    ajax.on('success', function (data) {
        if (data.status_text != 'OK' || !data.total) {
            ajax.fireEvent('error');
        } else {
            var song = data.songs[~~(Math.random() * data.total)];
            var container = document.querySelector('#song-info');
            container.innerHTML = template(container.innerHTML, song);
            container.style.display = '';
            wavesurfer.loadStream(song.url);
        }
    });
    ajax.on('error', function () {
        wavesurfer.loadStream('../panner/media.wav');
    });

    // Log errors
    wavesurfer.on('error', function (msg) {
        console.log(msg);
    });

    // Bind play/pause button
    document.querySelector('#play').addEventListener('click', function () {
        wavesurfer.playPause();
    });

    // Progress bar
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

    function template(str, data) {
        return str.replace(/{{(.+?)}}/g, function (s, s1) {
            return s1.split('.').reduce(function (a, b) {
                return a[b];
            }, data);
        });
    }
});
