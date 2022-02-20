"use strict";

// Create an instance
var wavesurfer = {};

// Init & load audio file
document.addEventListener("DOMContentLoaded", function() {
    wavesurfer = WaveSurfer.create({
        container: document.querySelector("#waveform"),
        height:500,
        waveColor: document.querySelector("#wavesurfer-water"),
        progressColor: document.querySelector("#wavesurfer-wood"),
        cursorColor:'rgba(255,255,255,.5)',
        cursorWidth: 20,
        fillParent: true,
        responsive: true
    });
    var wavesurfer2 = WaveSurfer.create({
        container: document.querySelector("#waveform2"),
        height: 150,
        waveColor: document.querySelector("#wavesurfer-tile2"),
        progressColor: document.querySelector("#wavesurfer-tile1")
    });
    var wavesurfer3 = WaveSurfer.create({
        container: document.querySelector("#waveform3"),
        waveColor: document.querySelector("#wavesurfer-boxes"),
        progressColor: document.querySelector("#wavesurfer-boxes"),
        barGap: 2,
        barHeight: 1,
        barMinHeight: 1,
        barRadius: 2,
        barWidth: 4,
        height: 250
    });
    var wavesurfer4 = WaveSurfer.create({
        container: document.querySelector("#waveform4"),
        waveColor: document.querySelector("#wavesurfer-abstract"),
        progressColor: ['rgba(0,255,255,.5)', 'blue', 'aqua']
    });
    var wavesurfer5 = WaveSurfer.create({
        container: document.querySelector("#waveform5"),
        waveColor: document.querySelector("#wavesurfer-doors"),
        progressColor: '#000'
    });
    var wavesurfer6 = WaveSurfer.create({
        container: document.querySelector("#waveform6"),
        waveColor: document.querySelector("#wavesurfer-grass"),
        waveStyleOptions: {repeat: 'repeat-y'},
        progressColor: '#000'
    });

    wavesurfer.load("../media/demo.mp3");
    wavesurfer2.load("../media/demo.mp3");
    wavesurfer3.load("../media/demo.mp3");
    wavesurfer4.load("../media/demo.mp3");
    wavesurfer5.load("../media/demo.mp3");
    wavesurfer6.load("../media/demo.mp3");

    // Set the playhead to halfway through the media, as to demonstrate the colorProgress gradient
    wavesurfer2.on("ready", () => wavesurfer2.seekTo(0.2));
    wavesurfer3.on("ready", () => wavesurfer3.seekTo(0.8));
    wavesurfer4.on("ready", () => wavesurfer4.seekTo(0.4));
    wavesurfer5.on("ready", () => wavesurfer5.seekTo(0.3));

    var waveformBtn = document.getElementById('waveform-btn');
    waveformBtn.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
    var waveformBtn2 = document.getElementById('waveform-btn2');
    waveformBtn2.addEventListener('click', wavesurfer2.playPause.bind(wavesurfer2));

    var waveformBtn3 = document.getElementById('waveform-btn3');
    waveformBtn3.addEventListener('click', wavesurfer3.playPause.bind(wavesurfer3));
    var waveformBtn4 = document.getElementById('waveform-btn4');
    waveformBtn4.addEventListener('click', wavesurfer4.playPause.bind(wavesurfer4));
    var waveformBtn5 = document.getElementById('waveform-btn5');
    waveformBtn5.addEventListener('click', wavesurfer5.playPause.bind(wavesurfer5));
});
