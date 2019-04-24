/* eslint-env jasmine */

import TestHelpers from './test-helpers.js';
import WaveSurfer from '../src/wavesurfer.js';

var audioElement;
var wavesurfer;
function loadElement() {
    // set src
    audioElement.src = TestHelpers.EXAMPLE_FILE_PATH;
    wavesurfer.load(audioElement);
}

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElement:', function() {
    var element;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    beforeEach(function() {
        audioElement = TestHelpers.createElement('testAudio', 'audio');
        var wave = TestHelpers.createWaveform({
            container: TestHelpers.createElement(),
            waveColor: 'red',
            progressColor: 'orange',
            cursorColor: 'white',
            backend: 'MediaElement'
        });
        wavesurfer = wave[0];
        element = wave[1];
    });

    afterEach(function() {
        wavesurfer.destroy();
        TestHelpers.removeElement(element);
    });

    /**
     * @test {WaveSurfer#isReady}
     */
    it('should be ready', function(done) {
        wavesurfer.once('ready', done);
        loadElement();
    });

    /**
     * @test {WaveSurfer#play}
     * @test {WaveSurfer#isPlaying}
     */
    it('should play', function(done) {
        wavesurfer.once('ready', function() {
            wavesurfer.play();

            expect(wavesurfer.isPlaying()).toBeTrue();

            done();
        });
        loadElement();
    });

    /**
     * @test {WaveSurfer#play}
     * @test {WaveSurfer#isPlaying}
     * @test {WaveSurfer#pause}
     */
    it('should pause', function(done) {
        wavesurfer.once('ready', function() {
            wavesurfer.play();
            expect(wavesurfer.isPlaying()).toBeTrue();

            wavesurfer.pause();
            expect(wavesurfer.isPlaying()).toBeFalse();

            done();
        });
        loadElement();
    });

    /**
     * @test {WaveSurfer#playPause}
     * @test {WaveSurfer#isPlaying}
     */
    it('should play or pause', function(done) {
        wavesurfer.once('ready', function() {
            wavesurfer.playPause();
            expect(wavesurfer.isPlaying()).toBeTrue();

            wavesurfer.playPause();
            expect(wavesurfer.isPlaying()).toBeFalse();

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#getDuration}  */
    it('should get duration', function(done) {
        wavesurfer.once('ready', function() {
            let duration = parseInt(wavesurfer.getDuration(), 10);
            expect(duration).toEqual(TestHelpers.EXAMPLE_FILE_DURATION);

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#getCurrentTime}  */
    it('should get currentTime', function(done) {
        wavesurfer.once('ready', function() {
            // initially zero
            let time = wavesurfer.getCurrentTime();
            expect(time).toEqual(0);

            // seek to 50%
            wavesurfer.seekTo(0.5);
            time = parseInt(wavesurfer.getCurrentTime(), 10);
            expect(time).toEqual(10);

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#setCurrentTime}  */
    it('should set currentTime', function(done) {
        wavesurfer.once('ready', function() {
            // initially zero
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

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#skipBackward}  */
    it('should skip backward', function(done) {
        wavesurfer.once('ready', function() {
            // seek to 50%
            wavesurfer.seekTo(0.5);

            // skip 4 seconds backward
            wavesurfer.skipBackward(4);
            let time = wavesurfer.getCurrentTime();
            expect(time).toBeWithinRange(6.88, 6.89);

            // skip backward with params.skipLength (default: 2 seconds)
            wavesurfer.skipBackward();
            time = wavesurfer.getCurrentTime();
            expect(time).toBeWithinRange(4.88, 4.89);

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#skipForward}  */
    it('should skip forward', function(done) {
        wavesurfer.once('ready', function() {
            // skip 4 seconds forward
            wavesurfer.skipForward(4);
            let time = wavesurfer.getCurrentTime();
            expect(time).toBeWithinRange(3.99, 4);

            // skip forward with params.skipLength (default: 2 seconds)
            wavesurfer.skipForward();
            time = wavesurfer.getCurrentTime();
            expect(time).toBeWithinRange(5.99, 6);

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#getPlaybackRate}  */
    it('should get playback rate', function(done) {
        wavesurfer.once('ready', function() {
            let rate = wavesurfer.getPlaybackRate();
            expect(rate).toEqual(1);

            done();
        });
        loadElement();
    });

    /** @test {WaveSurfer#setPlaybackRate}  */
    it('should set playback rate', function(done) {
        wavesurfer.once('ready', function() {
            let rate = 0.5;
            wavesurfer.setPlaybackRate(rate);

            expect(wavesurfer.getPlaybackRate()).toEqual(rate);

            done();
        });
        loadElement();
    });
});
