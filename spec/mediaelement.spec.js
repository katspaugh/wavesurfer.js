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
});
