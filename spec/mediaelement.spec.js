/* eslint-env jasmine */

import { sharedTests } from './mediaelement-mediaelement_webaudio-shared';

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElement:', function() {
    sharedTests('MediaElement');
});

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElement/errors:', function() {
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
    it('throw when load is called with invalid HTMLMediaElement', function() {
        var wave = TestHelpers.createWaveform({
            container: '#test',
            backend: 'MediaElement'
        });
        expect(function() {
            wave[0].load({
                foo: 'bar'
            });
        }).toThrow(new Error('media parameter is not a valid media element'));
    });
});
