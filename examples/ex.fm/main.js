(function () {
    'use strict';

    var bindAudio = function (div) {
        var wavesurfer = Object.create(WaveSurfer);

        wavesurfer.init({
            canvas: div,
            cursor: div.querySelector('.cursor'),
            audio: div.querySelector('audio'),
            predrawn: true
        });

        div.querySelector('a').addEventListener('click', function (e) {
            e.preventDefault();
        });
    };

    var processData = function (json) {
        var results = document.getElementById('songs');
        results.innerHTML = tmpl('songs_tmpl', { songs: json });

        var timelines = results.querySelectorAll('.timeline');
        Array.prototype.forEach.call(timelines, bindAudio);
    };

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (this.readyState == this.DONE && this.status == 200) {
            processData(JSON.parse(this.responseText));
        }
    };
    xhr.open('GET', 'data/songs.json');
    xhr.send();
}());
