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

    it('should play', function () {
        wavesurfer.play();

        expect(wavesurfer.isPlaying()).toBeTrue();
    });

    it('should pause', function () {
        wavesurfer.play();
        expect(wavesurfer.isPlaying()).toBeTrue();

        wavesurfer.pause();
        expect(wavesurfer.isPlaying()).toBeFalse();
    });

    it('should play or pause', function () {
        wavesurfer.playPause();
        expect(wavesurfer.isPlaying()).toBeTrue();

        wavesurfer.playPause();
        expect(wavesurfer.isPlaying()).toBeFalse();
    });

    it('should get duration', function () {
        var duration = parseInt(wavesurfer.getDuration(), 10);
        expect(duration).toBeNumber();
    });

    it('should toggle mute', function () {
        wavesurfer.toggleMute();
        expect(wavesurfer.isMuted).toBeTrue();

        wavesurfer.toggleMute();
        expect(wavesurfer.isMuted).toBeFalse();
    });

    it('should set mute', function () {
        wavesurfer.setMute(true);
        expect(wavesurfer.isMuted).toBeTrue();

        wavesurfer.setMute(false);
        expect(wavesurfer.isMuted).toBeFalse();
    });
});
