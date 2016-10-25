describe('wavesurfer', function () {
    var wavesurfer;

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    /*
     * Handle creating wavesurfer ui requirements
     */
    function __createWaveform() {
        var waveformDiv = document.createElement('div');
        waveformDiv.id = 'waveform';
        document.getElementsByTagName('body')[0].appendChild(waveformDiv);

        var ctx = document.createElement('canvas').getContext('2d');
        var linGrad = ctx.createLinearGradient(0, 64, 0, 200);
        linGrad.addColorStop(0.5, 'rgba(225, 225, 225, 1.000)');
        linGrad.addColorStop(0.5, 'rgba(183, 183, 183, 1.000)');

        return WaveSurfer.create({
            container: '#waveform',
            waveColor: 'violet',
            progressColor: 'purple'
        });
    }

    beforeAll(function (done) {
        wavesurfer = __createWaveform();
        wavesurfer.load('/base/spec/support/demo.wav');

        wavesurfer.on('ready', function () {
            done();
        });
    });

    beforeEach(function () {
        wavesurfer.seekTo(0);
    });

    afterAll(function () {
        wavesurfer.destroy();
    });

    it('play', function () {
        wavesurfer.play();

        expect(wavesurfer.isPlaying()).toBeTrue();
    });

    it('pause', function () {
        wavesurfer.play();
        expect(wavesurfer.isPlaying()).toBeTrue();

        wavesurfer.pause();
        expect(wavesurfer.isPlaying()).toBeFalse();
    });

    it('playPause', function () {
        wavesurfer.playPause();
        expect(wavesurfer.isPlaying()).toBeTrue();

        wavesurfer.playPause();
        expect(wavesurfer.isPlaying()).toBeFalse();
    });

    it('getDuration', function () {
        var duration = parseInt(wavesurfer.getDuration(), 10);
        expect(duration).toBeNumber();
    });

    it('toggleMute', function () {
        wavesurfer.toggleMute();
        expect(wavesurfer.isMuted).toBeTrue();

        wavesurfer.toggleMute();
        expect(wavesurfer.isMuted).toBeFalse();
    });

    it('setMute', function () {
        wavesurfer.setMute(true);
        expect(wavesurfer.isMuted).toBeTrue();

        wavesurfer.setMute(false);
        expect(wavesurfer.isMuted).toBeFalse();
    });
});
