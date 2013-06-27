createWavesurfer = function(src1,src2) {

    var ac = new (window.AudioContext || window.webkitAudioContext);

    var wavesurfer1 = Object.create(WaveSurfer);
    var wavesurfer2 = Object.create(WaveSurfer);

    console.log("audio src at creating wavs = " + audio.src);
    wavesurfer1.init({
        ac            : ac,
        canvas        : document.querySelector('#canvas1'),
        fillParent    : true,
        markerColor   : 'rgba(0, 0, 0, 0.5)',
        frameMargin   : 0.1,
        maxSecPerPx   : parseFloat(location.hash.substring(1)),
        loadPercent   : true,
        waveColor     : '#CCCCCC',
        progressColor : '#48A9E2',
        loadingColor  : '#48A9E2',
        cursorColor   : 'rgba(0,0,0,0)'

    });

    wavesurfer2.init({
        ac            : ac,
        canvas        : document.querySelector('#canvas2'),
        fillParent    : true,
        markerColor   : 'rgba(0, 0, 0, 0.5)',
        frameMargin   : 0.1,
        maxSecPerPx   : parseFloat(location.hash.substring(1)),
        loadPercent   : true,
        waveColor     : '#CCCCCC',
        progressColor : '#48A9E2',
        loadingColor  : '#48A9E2',
        cursorColor   : 'rgba(0,0,0,0)'

    });

    wavesurfer1.load(src1);
    wavesurfer2.load(src2);


    var eventHandlers = {
        'play': function () {
            wavesurfer1.playPause();
        },

        'playUSER': function () {
            wavesurfer2.playPause();
        }
    };

    document.addEventListener('keyup', function (e) {
        var map = {
            32: 'play',
            40: 'playUSER'
        };
        if (e.keyCode in map) {
            var handler = eventHandlers[map[e.keyCode]];
            e.preventDefault();
            handler && handler(e);
        }
    });

    document.addEventListener('click', function (e) {
        var action = e.target.dataset && e.target.dataset.action;
        if (action && action in eventHandlers) {
            eventHandlers[action](e);
        }
    });

    document.getElementById('show-ans-btn').innerHTML = 'Continue';
}
