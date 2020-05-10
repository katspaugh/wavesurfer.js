/* eslint-env jasmine */

import { sharedErrorTests, sharedTests } from './mediaelement-shared';

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElementWebAudio:', function() {
    sharedTests('MediaElementWebAudio');
});

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElementWebAudio/errors:', function() {
    sharedErrorTests('MediaElementWebAudio');
});
