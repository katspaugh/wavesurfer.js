(function (globals, exports) {
    'use strict';

    var analyzer = Object.create(globals.WaveSurfer.analyzer),
        waveCanvas = document.querySelector('#wave'),
        freqCanvas = document.querySelector('#freq'),
        audio = document.querySelector('audio');

    analyzer.init();
    analyzer.loadElement(audio);

    var waveVisualizer = Object.create(globals.WaveSurfer.visualizer);
    waveVisualizer.init(
        waveCanvas,
        analyzer,
        { color: 'rgba(100, 0, 250, 0.5)' }
    );
    waveVisualizer.loop(
        waveVisualizer.drawContinuous,
        analyzer.waveform
    );

    var freqVisualizer = Object.create(globals.WaveSurfer.visualizer);
    freqVisualizer.init(
        freqCanvas,
        analyzer,
        { color: 'rgba(0, 100, 150, 0.7)' }
    );
    freqVisualizer.loop(
        freqVisualizer.drawCurrent,
        analyzer.frequency
    );

    /* Play/pause on spacebar. */
    document.addEventListener('keypress', function (e) {
        if (32 === e.keyCode) { // spacebar
            e.preventDefault();

            if (analyzer.isPaused()) {
                analyzer.play();
            } else {
                analyzer.pause();
            }
        }
    }, false);

    /* Load file via drag'n'drop. */
    var reader = new globals.FileReader();
    reader.addEventListener('load', function (e) {
        analyzer.loadData(e.target.result);
    }, false);

    document.addEventListener('drop', function (e) {
        e.preventDefault();
        var file = e.dataTransfer.files[0];
        file && reader.readAsArrayBuffer(file);
    }, false);

    /* Exports */
    exports.analyzer = analyzer;
}(this, this));