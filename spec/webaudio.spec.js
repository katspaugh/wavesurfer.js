/* eslint-env jasmine */

import { sharedTests } from './mediaelement-shared';

/** @test {WaveSurfer} */
describe('WebAudio: Shared audio backend tests', function() {
    sharedTests('WebAudio');
});
