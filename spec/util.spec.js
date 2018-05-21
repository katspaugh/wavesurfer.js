/* eslint-env jasmine */

import WaveSurfer from '../src/wavesurfer.js';

import TestHelpers from './test-helpers.js';

/** @test {util.ajax} */
describe('util.ajax:', function() {
    var defaultUrl = TestHelpers.EXAMPLE_FILE_PATH;

    it('can load an arraybuffer', function(done) {
        var options = {
            url: defaultUrl,
            responseType: 'arraybuffer'
        };
        var instance = WaveSurfer.util.ajax(options);
        instance.on('success', (data, e) => {
            // url
            expect(e.target.responseURL).toContain(options.url);

            // responseType
            expect(instance.xhr.responseType).toBe(options.responseType);

            // returned data is an arraybuffer
            expect(data).toEqual(jasmine.any(ArrayBuffer));

            done();
        });
    });

    it('fires the error event when the file is not found', function(done) {
        var options = {
            url: '/foo/bar'
        };
        var instance = WaveSurfer.util.ajax(options);
        instance.on('error', e => {
            // url
            expect(e.target.responseURL).toContain(options.url);

            // error message
            expect(e.target.statusText).toBe('Not Found');
            expect(e.target.status).toBe(404);

            done();
        });
    });

    it('fires the progress event during loading', function(done) {
        var options = {
            url: defaultUrl,
            responseType: 'arraybuffer'
        };
        var instance = WaveSurfer.util.ajax(options);
        instance.on('progress', e => {
            // url
            expect(e.target.responseURL).toContain(options.url);

            // progress message
            expect(e.target.statusText).toBe('OK');
            expect(e.target.status).toBe(200);

            done();
        });
    });

    it('accepts custom request headers and credentials', function(done) {
        var options = {
            url: defaultUrl,
            responseType: 'arraybuffer',
            xhr: {
                withCredentials: true,
                requestHeaders: [
                    {
                        key: 'Authorization',
                        value: 'my-token'
                    }
                ]
            }
        };
        var instance = WaveSurfer.util.ajax(options);
        instance.on('success', (data, e) => {
            // with credentials
            expect(e.target.withCredentials).toBeTrue();

            // XXX: find a way to retrieve request headers
            done();
        });
    });
});

/** @test {util} */
describe('util:', function() {
    /** @test {extend} */
    it('extend extends an object shallowly with others', function() {
        var obj = {
            style: {}
        };
        var sources = {
            prop1: 'red',
            prop2: 123
        };
        var result = {
            style: {},
            prop1: 'red',
            prop2: 123
        };
        expect(WaveSurfer.util.extend(obj, sources)).toEqual(result);
    });

    /** @test {getId} */
    it('getId returns a random string', function() {
        expect(WaveSurfer.util.getId()).toStartWith('wavesurfer_');
    });

    /** @test {min} */
    it('min returns the smallest number in the provided array', function() {
        expect(WaveSurfer.util.min([0, 1, 1.1, 100, -1])).toEqual(-1);
    });

    /** @test {min} */
    it('min returns +Infinity for an empty array', function() {
        expect(WaveSurfer.util.min([])).toEqual(+Infinity);
    });

    /** @test {max} */
    it('max returns the largest number in the provided array', function() {
        expect(WaveSurfer.util.max([0, 1, 1.1, 100, -1])).toEqual(100);
    });

    /** @test {max} */
    it('max returns -Infinity for an empty array', function() {
        expect(WaveSurfer.util.max([])).toEqual(-Infinity);
    });

    /** @test {style} */
    it('style applies a map of styles to an element', function() {
        var el = {
            style: {}
        };
        var styles = {
            backgroundcolor: 'red',
            'background-color': 'blue'
        };
        var result = {
            style: styles
        };
        expect(WaveSurfer.util.style(el, styles)).toEqual(result);
    });
});
