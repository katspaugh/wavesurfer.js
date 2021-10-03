document.addEventListener("DOMContentLoaded", function() {

    // setup WaveSurfer
    var wavesurfer = WaveSurfer.create({
        container: document.querySelector("#waveform"),
        height: 250,
        backgroundColor: 'black',
        waveColor: 'navy',
        cursorColor: 'white',
        cursorWidth: 2,
        fillParent: true,
        barGap: 0,
        barHeight: 1,
        barMinHeight: 1,
        barRadius: 0,
        barWidth: 2,
        normalize: true
    });
    wavesurfer.load("../media/demo.mp3");

    // get references to the play button, Video and Canvas Elements
    var waveformBtn = document.getElementById('waveform-btn');
    var videoElement = document.getElementById("video");
    var canvasElement = document.getElementById("myCanvas");
    var ctx = canvasElement.getContext("2d");

    // setup WaveSurfer events
    waveformBtn.addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
    wavesurfer.on('ready', () => {
        wavesurfer.play();
        wavesurfer.pause();
        wavesurfer.seek(0);
    });
    wavesurfer.on('play', () => {
        // when WaveSurfer plays, play the video
        videoElement.play(wavesurfer.getCurrentTime());
    });
    wavesurfer.on('seek', () => {
        // when WaveSurfer seeks, seek the video
        videoElement.currentTime = wavesurfer.getCurrentTime();
        if (!wavesurfer.isPlaying()) {
            drawVideoFrame();
        }
    });
    wavesurfer.on('pause', () => {
        // when WaveSurfer pauses, pause the video
        videoElement.pause();
    });

    // draw one frame of video
    function drawVideoFrame() {
        ctx.drawImage(videoElement, 0, 0, 777, 414);
        wavesurfer.setWaveStyle(canvasElement);
        wavesurfer.setProgressStyle(canvasElement);
    }

    // setup interval to draw the video to the canvas
    var drawVideoInterval;
    videoElement.addEventListener("play", function() {

        drawVideoInterval = window.setInterval(() => {

            // draw the video element to the 2d context of the canvas element
            // adjusting the width and height parameters #4 and #5
            // to suit the video and waveform
            ctx.drawImage(videoElement, 0, 0, 777, 414);
            wavesurfer.setWaveStyle(canvasElement);
            wavesurfer.setProgressStyle(canvasElement);
        }, 0);
    }, false);
    videoElement.addEventListener("pause", () => window.clearInterval(drawVideoInterval), false);
    videoElement.addEventListener("ended", () => clearInterval(drawVideoInterval), false);
});
