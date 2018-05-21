/* eslint-env jasmine */
import WaveSurfer from '../src/wavesurfer.js';

/** @test {WaveSurfer} */
describe('WaveSurfer/playback:', function() {
    var wavesurfer;

    const EXAMPLE_FILE_PATH = '/base/spec/support/demo.wav';
    const EXAMPLE_FILE_DURATION = 21;

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
            waveColor: '#90F09B',
            progressColor: 'purple',
            cursorColor: 'white'
        });
    }

    beforeEach(function(done) {
        wavesurfer = __createWaveform();
        wavesurfer.load(EXAMPLE_FILE_PATH);

        wavesurfer.on('ready', function() {
            done();
        });
    });

    afterEach(function() {
        wavesurfer.destroy();
    });

    /**
     * @test {WaveSurfer#isReady}
     */
    it('should be ready', function() {
        wavesurfer.play();
        expect(wavesurfer.isReady).toBeFalse();
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
        let duration = parseInt(wavesurfer.getDuration(), 10);
        expect(duration).toEqual(EXAMPLE_FILE_DURATION);
    });

    /** @test {WaveSurfer#getCurrentTime}  */
    it('should get currentTime', function() {
        // initally zero
        let time = wavesurfer.getCurrentTime();
        expect(time).toEqual(0);

        // seek to 50%
        wavesurfer.seekTo(0.5);
        time = parseInt(wavesurfer.getCurrentTime(), 10);
        expect(time).toEqual(10);
    });

    /** @test {WaveSurfer#setCurrentTime}  */
    it('should set currentTime', function() {
        // initally zero
        let time = wavesurfer.getCurrentTime();
        expect(time).toEqual(0);

        // set to 10 seconds
        wavesurfer.setCurrentTime(10);
        time = wavesurfer.getCurrentTime();
        expect(time).toEqual(10);

        // set to something higher than duration
        wavesurfer.setCurrentTime(1000);
        time = wavesurfer.getCurrentTime();
        // sets it to end of track
        time = parseInt(wavesurfer.getCurrentTime(), 10);
        expect(time).toEqual(EXAMPLE_FILE_DURATION);
    });

    /** @test {WaveSurfer#skipBackward}  */
    it('should skip backward', function() {
        // seek to 50%
        wavesurfer.seekTo(0.5);

        // skip 4 seconds backward
        wavesurfer.skipBackward(4);
        let time = wavesurfer.getCurrentTime();
        let expectedTime = 6.886938775510204;
        expect(time).toEqual(expectedTime);

        // skip backward with params.skipLength (default: 2 seconds)
        wavesurfer.skipBackward();
        time = wavesurfer.getCurrentTime();
        expect(time).toEqual(expectedTime - 2);
    });

    /** @test {WaveSurfer#skipForward}  */
    it('should skip forward', function() {
        // skip 4 seconds forward
        wavesurfer.skipForward(4);
        let time = wavesurfer.getCurrentTime();
        let expectedTime = 3.9999999999999996;
        expect(time).toEqual(expectedTime);

        // skip forward with params.skipLength (default: 2 seconds)
        wavesurfer.skipForward();
        time = wavesurfer.getCurrentTime();
        expect(time).toEqual(expectedTime + 2);
    });

    /** @test {WaveSurfer#getVolume}  */
    it('should get volume', function() {
        let volume = wavesurfer.getVolume();
        expect(volume).toEqual(1);
    });

    /** @test {WaveSurfer#setVolume}  */
    it('should set volume', function(done) {
        let targetVolume = 0.5;

        wavesurfer.once('volume', function(result) {
            expect(result).toEqual(targetVolume);

            done();
        });

        wavesurfer.setVolume(targetVolume);
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

    /** @test {WaveSurfer#getMute}  */
    it('should get mute', function() {
        wavesurfer.setMute(true);
        expect(wavesurfer.getMute()).toBeTrue();

        wavesurfer.setMute(false);
        expect(wavesurfer.getMute()).toBeFalse();
    });

    /** @test {WaveSurfer#getPlaybackRate}  */
    it('should get playback rate', function() {
        let rate = wavesurfer.getPlaybackRate();
        expect(rate).toEqual(1);
    });

    /** @test {WaveSurfer#setPlaybackRate}  */
    it('should set playback rate', function() {
        let rate = 0.5;
        wavesurfer.setPlaybackRate(rate);

        expect(wavesurfer.getPlaybackRate()).toEqual(rate);
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
        expect(waveColor).toEqual('#90F09B');
    });

    /** @test {WaveSurfer#setWaveColor} */
    it('should allow setting waveColor', function() {
        let color = 'blue';
        wavesurfer.setWaveColor(color);
        var waveColor = wavesurfer.getWaveColor();

        expect(waveColor).toEqual(color);
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

    /** @test {WaveSurfer#exportPCM} */
    it('should return PCM data formatted using JSON.stringify', function() {
        var pcmData = wavesurfer.exportPCM();
        expect(pcmData).toBeNonEmptyString();
    });

    /** @test {WaveSurfer#getFilters} */
    it('should return the list of current set filters as an array', function() {
        var list = wavesurfer.getFilters();

        expect(list).toEqual([]);
    });
});
