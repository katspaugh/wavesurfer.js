document.addEventListener("DOMContentLoaded", function() {

    // setup WaveSurfer
    var wavesurfer = {};
    wavesurfer = WaveSurfer.create({
        container: document.querySelector("#waveform"),
        height: 350,
        waveColor: document.getElementById("liquid"),
        progressColor: document.getElementById("liquid"),
        cursorColor: "rgba(255,255,255,1)",
        cursorWidth: 2,
        loop: true,
        fillParent: true,
        responsive: false,
        barGap: 0,
        barHeight: 1,
        barMinHeight: 1,
        barRadius: 0,
        barWidth: 10
    });

    // load a media file
    wavesurfer.load("../media/demo.mp3");

    // setup the play button
    var waveformBtn = document.getElementById("waveform-btn");
    waveformBtn.addEventListener("click", wavesurfer.playPause.bind(wavesurfer));

    var drawCanvasInterval;
    wavesurfer.on("play", () => {
        // when the audio is playing
        drawCanvasInterval = window.setInterval(() => {

            // draw the contents of the hidden effects canvas to the waveform background
            wavesurfer.setWaveStyle(document.getElementById("liquid"));
            wavesurfer.setProgressStyle(document.getElementById("liquid"));
        }, 0);
    }, false);

    // when the audio is paused, stop drawing
    wavesurfer.on("pause", () => window.clearInterval(drawCanvasInterval), false);
});
