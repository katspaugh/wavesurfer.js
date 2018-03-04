/* eslint-env jasmine */
import WaveSurfer from '../src/wavesurfer.js';
import { TestResponses } from './support/helpers/test_responses.js';

let ja = require('jasmine-ajax');

/** @test {util.ajax} */
describe('util.ajax:', function() {
    // Put our http response in a variable.
    var success = {
        status: 200,
        responseText: 'Oh yeah!'
    };

    // declare the variable within the suite's scope
    var request;
    beforeEach(function(done) {
        // start listening to xhr requests
        jasmine.Ajax.install();

        // make the actual request
        var options = {
            method: 'GET',
            url: 'http://localhost/test',
            xhr: {}
        };
        WaveSurfer.util.ajax(options);

        // answer the request
        request = jasmine.Ajax.requests.mostRecent();
        request.respondWith(TestResponses.search.success);
        done();
    });

    afterEach(function() {
        jasmine.Ajax.uninstall();
    });

    it('sends the request to the right end point', function(done) {
        expect(request.url).toBe('http://localhost/test');
        done();
    });

    it('uses the correct method', function(done) {
        expect(request.method).toBe('GET');
        done();
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
