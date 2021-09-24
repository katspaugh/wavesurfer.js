var wavesurfer = {};
document.addEventListener("DOMContentLoaded", function() {
    var c = document.getElementById("myCanvas");
    var waveformBtn = document.getElementById("waveform-btn");

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

    wavesurfer.load("../media/demo.mp3");

    waveformBtn.addEventListener("click", wavesurfer.playPause.bind(wavesurfer));

    let waveform = document.getElementById("waveform");
    waveform.addEventListener("mouseover", () => {
        pointers[0].down = true; // eslint-disable-line no-undef
        pointers[0].color = [ // eslint-disable-line no-undef
            Math.random() + 0.2,
            Math.random() + 0.2,
            Math.random() + 0.2
        ];
    });
    var i;
    wavesurfer.on("play", () => {
        i = window.setInterval(() => {
            wavesurfer.setWaveColor(document.getElementById("liquid"));
            wavesurfer.setProgressColor(document.getElementById("liquid"));
        }, 0);
    }, false);
    wavesurfer.on("pause", () => window.clearInterval(i), false);
});
