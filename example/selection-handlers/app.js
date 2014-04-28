document.addEventListener('DOMContentLoaded', function () {
    var wavesurfer = Object.create(WaveSurfer);
    wavesurfer.init({
        container: '#wave',
        waveColor: '#e3e4e6',
        progressColor: 'rgba(0,0,0,0)',
        selectionColor: 'rgba(255,0,0, .2)',
        selectionForeground: true,
        selectionBorder: true,
        selectionBorderColor: '#d42929',
        cursorColor: "#ffea00",
        scrollParent: true,
        minPxPerSec: 50,
        height: 250,
        pixelRatio: 2,
        cursorWidth: 2,
        handlerSize: 25,
    });

    wavesurfer.load('../../example/media/demo.wav');

    wavesurfer.on('selection-update', function(selection){
        document.querySelector("#mark0").innerHTML = selection.startTime;
        document.querySelector("#mark1").innerHTML = selection.endTime;
    });

    document.querySelector("#play").addEventListener('click', function(){
        wavesurfer.playPause();
        return false;
    });
    document.querySelector("#play-selection").addEventListener('click', function(){
        wavesurfer.playPauseSelection();
        return false;
    });
});
