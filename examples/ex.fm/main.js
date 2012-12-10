(function () {
    'use strict';

    var createWavesurfer = function (song) {
        var canvas = document.createElement('canvas');
        document.querySelector('#songs').appendChild(canvas);
        canvas.width = 1024;
        canvas.height = 128;

        var audio = document.createElement('audio');
        audio.src = song.url;

        var wavesurfer = Object.create(WaveSurfer);
        wavesurfer.init({
            canvas: canvas,
            audio: audio,
            image: song.waveform,
            progressColor: 'wheat',
            cursorColor: 'orange',
            cursorWidth: 2
        });

        return wavesurfer;
    };

    var processData = function (json) {
        var wavesurfers = json.map(createWavesurfer);
        //wavesurfers[0].playAt(0);
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
