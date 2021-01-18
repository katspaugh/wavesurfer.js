/* eslint-env jasmine */
import TestHelpers from './test-helpers';

/**
 * Doesn't call load() automatically so you can test loading behaviour here
 */
describe('WebAudio/load:', function() {
    let wavesurfer;
    let element;
    let manualDestroy = false;

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    beforeEach(function(done) {
        manualDestroy = false;

        element = TestHelpers.createElement();
        let wave = TestHelpers.createWaveform({
            container: element,
            backend: 'WebAudio',
            waveColor: '#90F09B',
            progressColor: 'purple',
            cursorColor: 'white'
        });

        wavesurfer = wave[0];
        element = wave[1];
        done();
    });

    afterEach(function() {
        if (!manualDestroy) {
            wavesurfer.destroy();
            TestHelpers.removeElement(element);
        }
    });

    /**
     * @test {WaveSurfer#load}
     */
    it('load should accept HTMLMediaElement as the url', function(done) {
        let audio = new Audio(TestHelpers.EXAMPLE_FILE_PATH);
        wavesurfer.load(audio);
        wavesurfer.once('ready', done);
    });
});
