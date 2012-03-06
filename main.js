(function (globals, exports) {
    'use strict';

    var WaveSurfer = globals.WaveSurfer;

    var webAudio = Object.create(WaveSurfer.WebAudio);

    webAudio.init();

    var waveDrawer = Object.create(WaveSurfer.Drawer);
    waveDrawer.init(
        document.querySelector('#wave'),
        webAudio,
        {
            color: 'rgba(100, 0, 250, 0.5)',
            cursor: document.querySelector('#wave-cursor'),
            continuous: true
        }
    );
    waveDrawer.loop(webAudio.waveform);
    waveDrawer.bindClick();

    var freqDrawer = Object.create(WaveSurfer.Drawer);
    freqDrawer.init(
        document.querySelector('#freq'),
        webAudio,
        { color: 'rgba(0, 100, 150, 0.7)' }
    );
    freqDrawer.loop(webAudio.frequency);


    /* Load file via drag'n'drop. */
    var reader = new globals.FileReader();
    reader.addEventListener('load', function (e) {
        webAudio.loadData(e.target.result, function () {
            webAudio.play();
            waveDrawer.setDuration(webAudio.currentBuffer.duration);
        });
    }, false);


    document.addEventListener('drop', function (e) {
        e.preventDefault();
        var file = e.dataTransfer.files[0];
        file && reader.readAsArrayBuffer(file);
    }, false);


    /* Play/pause on spacebar. */
    document.addEventListener('keypress', function (e) {
        if (32 === e.keyCode) { // spacebar
            e.preventDefault();
            webAudio.paused ? webAudio.play() : webAudio.pause();
        }
    }, false);

    /* Exports */
    exports.webAudio = webAudio;
}(this, this));