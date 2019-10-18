/* eslint-env jasmine */

import { sharedErrorTests, sharedTests } from './mediaelement-shared';
import TestHelpers from './test-helpers';

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElement:', function() {
    sharedTests('MediaElement');
});

/** @test {WaveSurfer} */
describe('WaveSurfer/MediaElement/errors:', function() {
    sharedErrorTests('MediaElement');
});
