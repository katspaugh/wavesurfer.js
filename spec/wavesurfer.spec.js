/* eslint-env jasmine */

import TestHelpers from './test-helpers.js';
import WaveSurfer from '../src/wavesurfer.js';

/** @test {WaveSurfer} */
describe('WaveSurfer/playback:', function() {
    var wavesurfer;
    var element;
    var manualDestroy = false;

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    beforeEach(function(done) {
        var wave = TestHelpers.createWaveform();
        wavesurfer = wave[0];
        element = wave[1];
        wavesurfer.load(TestHelpers.EXAMPLE_FILE_PATH);

        wavesurfer.on('ready', done);
    });

    afterEach(function() {
        if (!manualDestroy) {
            wavesurfer.destroy();
            TestHelpers.removeElement(element);
        }
    });

    /**
     * @test {WaveSurfer#isReady}
     */
    it('should be ready', function() {
        wavesurfer.play();
        expect(wavesurfer.isReady).toBeFalse();
    });

    /**
     * @test {WaveSurfer#VERSION}
     */
    it('should have version number', function() {
        let version = require('../package.json').version;
        expect(WaveSurfer.VERSION).toEqual(version);
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
        expect(duration).toEqual(TestHelpers.EXAMPLE_FILE_DURATION);
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
        expect(time).toEqual(TestHelpers.EXAMPLE_FILE_DURATION);
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

    /** @test {WaveSurfer#exportImage} */
    it('should export image data', function() {
        var imgData = wavesurfer.exportImage();
        expect(imgData).toBeNonEmptyString();
    });

    /** @test {WaveSurfer#destroy} */
    it('should destroy', function(done) {
        manualDestroy = true;

        wavesurfer.once('destroy', function() {
            TestHelpers.removeElement(element);
            done();
        });
        wavesurfer.destroy();
    });
});

/** @test {WaveSurfer} */
describe('WaveSurfer/errors:', function() {
    var element;

    beforeEach(function() {
        element = TestHelpers.createElement('test');
    });

    afterEach(function() {
        TestHelpers.removeElement(element);
    });

    /**
     * @test {WaveSurfer}
     */
    it('should throw when container element not found', function() {
        expect(function() {
            TestHelpers.createWaveform({
                container: '#foo'
            });
        }).toThrow(new Error('Container element not found'));
    });

    /**
     * @test {WaveSurfer}
     */
    it('should throw when media container element not found', function() {
        expect(function() {
            TestHelpers.createWaveform({
                container: '#test',
                mediaContainer: '#foo'
            });
        }).toThrow(new Error('Media Container element not found'));
    });

    /**
     * @test {WaveSurfer}
     */
    it('should throw for invalid maxCanvasWidth param', function() {
        expect(function() {
            TestHelpers.createWaveform({
                container: '#test',
                maxCanvasWidth: 0.5
            });
        }).toThrow(new Error('maxCanvasWidth must be greater than 1'));

        expect(function() {
            TestHelpers.createWaveform({
                container: '#test',
                maxCanvasWidth: 3
            });
        }).toThrow(new Error('maxCanvasWidth must be an even number'));
    });

    /**
     * @test {WaveSurfer}
     */
    it('should throw for invalid renderer', function() {
        expect(function() {
            TestHelpers.createWaveform({
                container: '#test',
                renderer: 'foo'
            });
        }).toThrow(new Error('Renderer parameter is invalid'));
    });
});
