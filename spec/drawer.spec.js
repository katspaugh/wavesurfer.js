/* eslint-env jasmine */
import TestHelpers from './test-helpers.js';
import Drawer from '../src/drawer';

/** @test {Drawer} */
describe('Drawer', function() {
    let container;
    let drawer;

    beforeEach(function() {
        container = TestHelpers.createElement();
        drawer = new Drawer(container, {});
        drawer.createWrapper();
    });

    afterEach(function() {
        if (drawer) drawer.destroy();
        TestHelpers.removeElement(container);
    });

    /** @test {wrapper} */
    it('wrapper should exist and have correct tagName', function() {
        expect(drawer.wrapper).toBeTruthy();
        expect(drawer.wrapper.tagName.toLowerCase()).toBe('wave');
    });

    /** @test {handleEvent/0.5} */
    it('handleEvent should return 0.5 if clicked in the middle of wrapper', function() {
        const {right, width} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: right - width / 2}, true)).toBeWithinRange(0.49, 0.51); // because 0.1 + 0.2 !== 0.3
    });

    /** @test {handleEvent/0.9} */
    it('handleEvent should return 0.9 if clicked 10% from the end', function() {
        const {right, width} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: right - width / 10}, true)).toBeWithinRange(0.89, 0.91); // because 0.1 + 0.2 !== 0.3
    });

    /** @test {handleEvent/left} */
    it('handleEvent should return 0 if clicked on wrapper left position', function() {
        const {left} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: left}, true)).toBe(0);
    });

    /** @test {handleEvent/left-1} */
    it('handleEvent should return 0 if clicked on wrapper left position -1px', function() {
        const {left} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: left - 1}, true)).toBe(0);
    });

    /** @test {handleEvent/left+1} */
    it('handleEvent should not return 0 if clicked on wrapper left position +1px', function() {
        const {left} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: left + 1}, true)).not.toBe(0);
        expect(drawer.handleEvent({clientX: left + 1}, true)).toBeGreaterThan(0);
    });

    /** @test {handleEvent/right} */
    it('handleEvent should return 1 if clicked on wrapper right position', function() {
        const {right} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: right}, true)).toBeCloseTo(1, 3);
    });

    /** @test {handleEvent/right+1} */
    it('handleEvent should return 1 if clicked on wrapper right position +1px', function() {
        const {right} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: right + 1}, true)).toBe(1);
    });

    /** @test {handleEvent/right-1} */
    it('handleEvent should not return 1 if clicked on wrapper right position -1px', function() {
        const {right} = drawer.wrapper.getBoundingClientRect();

        expect(drawer.handleEvent({clientX: right - 1}, true)).not.toBe(1);
        expect(drawer.handleEvent({clientX: right - 1}, true)).toBeLessThan(1);
    });

});
