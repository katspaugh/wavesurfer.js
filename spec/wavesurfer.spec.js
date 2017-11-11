/* eslint-env jasmine */
import WaveSurfer from '../src/wavesurfer.js';

/** @test {WaveSurfer} */
describe('WaveSurfer/playback:', function() {
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
            progressColor: 'purple',
            cursorColor: 'white'
        });
    }

    beforeAll(function(done) {
        wavesurfer = __createWaveform();
        wavesurfer.load('/base/spec/support/demo.wav');

        wavesurfer.on('ready', function() {
            done();
        });
    });

    beforeEach(function() {
        wavesurfer.seekTo(0);
    });

    afterAll(function() {
        wavesurfer.destroy();
    });

    /**
     * @test {WaveSurfer#play}
     * @test {WaveSurfer#isPlaying}
     */
    it('should play', function() {
        wavesurfer.play();

        expect(wavesurfer.isPlaying()).toBeTrue();
    });

    /**
     * @test {WaveSurfer#play}
     * @test {WaveSurfer#isPlaying}
     * @test {WaveSurfer#pause}
     */
    it('should pause', function() {
        wavesurfer.play();
        expect(wavesurfer.isPlaying()).toBeTrue();

        wavesurfer.pause();
        expect(wavesurfer.isPlaying()).toBeFalse();
    });

    /**
     * @test {WaveSurfer#playPause}
     * @test {WaveSurfer#isPlaying}
     */
    it('should play or pause', function() {
        wavesurfer.playPause();
        expect(wavesurfer.isPlaying()).toBeTrue();

        wavesurfer.playPause();
        expect(wavesurfer.isPlaying()).toBeFalse();
    });

    /** @test {WaveSurfer#getDuration}  */
    it('should get duration', function() {
        var duration = parseInt(wavesurfer.getDuration(), 10);
        expect(duration).toBeNumber();
    });

    /** @test {WaveSurfer#toggleMute}  */
    it('should toggle mute', function() {
        wavesurfer.toggleMute();
        expect(wavesurfer.isMuted).toBeTrue();

        wavesurfer.toggleMute();
        expect(wavesurfer.isMuted).toBeFalse();
    });

    /** @test {WaveSurfer#setMute}  */
    it('should set mute', function() {
        wavesurfer.setMute(true);
        expect(wavesurfer.isMuted).toBeTrue();

        wavesurfer.setMute(false);
        expect(wavesurfer.isMuted).toBeFalse();
    });

    /** @test {WaveSurfer#zoom}  */
    it('should set zoom parameters', function() {
        wavesurfer.zoom(20);
        expect(wavesurfer.params.minPxPerSec).toEqual(20);
        expect(wavesurfer.params.scrollParent).toBe(true);
    });

    /** @test {WaveSurfer#zoom}  */
    it('should set unzoom parameters', function() {
        wavesurfer.zoom(false);
        expect(wavesurfer.params.minPxPerSec).toEqual(
            wavesurfer.defaultParams.minPxPerSec
        );
        expect(wavesurfer.params.scrollParent).toBe(false);
    });

    /** @test {WaveSurfer#getWaveColor} */
    it('should allow getting waveColor', function() {
        var waveColor = wavesurfer.getWaveColor();
        expect(waveColor).toEqual('violet');
    });

    /** @test {WaveSurfer#setWaveColor} */
    it('should allow setting waveColor', function() {
        wavesurfer.setWaveColor('red');
        var waveColor = wavesurfer.getWaveColor();

        expect(waveColor).toEqual('red');
    });

    /** @test {WaveSurfer#getProgressColor} */
    it('should allow getting progressColor', function() {
        var progressColor = wavesurfer.getProgressColor();
        expect(progressColor).toEqual('purple');
    });

    /** @test {WaveSurfer#setProgressColor} */
    it('should allow setting progressColor', function() {
        wavesurfer.setProgressColor('green');
        var progressColor = wavesurfer.getProgressColor();

        expect(progressColor).toEqual('green');
    });

    /** @test {WaveSurfer#getCursorColor} */
    it('should allow getting cursorColor', function() {
        var cursorColor = wavesurfer.getCursorColor();
        expect(cursorColor).toEqual('white');
    });

    /** @test {WaveSurfer#setCursorColor} */
    it('should allow setting cursorColor', function() {
        wavesurfer.setCursorColor('black');
        var cursorColor = wavesurfer.getCursorColor();

        expect(cursorColor).toEqual('black');
    });

    /** @test {WaveSurfer#getHeight} */
    it('should allow getting height', function() {
        var height = wavesurfer.getHeight();
        expect(height).toEqual(128);
    });

    /** @test {WaveSurfer#setHeight} */
    it('should allow setting height', function() {
        wavesurfer.setHeight(150);
        var height = wavesurfer.getHeight();

        expect(height).toEqual(150);
    });
});
