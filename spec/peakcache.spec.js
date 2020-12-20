/* eslint-env jasmine */
import PeakCache from '../src/peakcache';

describe('PeakCache:', function() {
    let peakcache;
    let test_length = 200;
    let test_length2 = 300;
    let test_start = 50;
    let test_end = 100;
    let test_start2 = 100;
    let test_end2 = 120;
    let test_start3 = 120;
    let test_end3 = 150;

    let window_size = 20;

    function __createPeakCache() {
        peakcache = new PeakCache();
    }

    beforeEach(function(done) {
        __createPeakCache();
        done();
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    it('empty cache returns full range', function() {
        let newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start,
            test_end
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_start);
        expect(newranges[0][1]).toEqual(test_end);
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    it('different length clears cache', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        let newranges = peakcache.addRangeToPeakCache(
            test_length2,
            test_start,
            test_end
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_start);
        expect(newranges[0][1]).toEqual(test_end);
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    it('consecutive calls return no ranges', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        let newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start,
            test_end
        );
        expect(newranges.length).toEqual(0);
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    it('sliding window returns window sized range', function() {
        let newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start,
            test_end
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_start);
        expect(newranges[0][1]).toEqual(test_end);
        newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start + window_size,
            test_end + window_size
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end);
        expect(newranges[0][1]).toEqual(test_end + window_size);
        newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start + window_size * 2,
            test_end + window_size * 2
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end + window_size);
        expect(newranges[0][1]).toEqual(test_end + window_size * 2);
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    /** @test {PeakCache#getCacheRanges} */
    it('disjoint set creates two ranges', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        peakcache.addRangeToPeakCache(test_length, test_start3, test_end3);
        let ranges = peakcache.getCacheRanges();
        expect(ranges.length).toEqual(2);
        expect(ranges[0][0]).toEqual(test_start);
        expect(ranges[0][1]).toEqual(test_end);
        expect(ranges[1][0]).toEqual(test_start3);
        expect(ranges[1][1]).toEqual(test_end3);
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    /** @test {PeakCache#getCacheRanges} */
    it('filling in disjoint sets coalesces', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        peakcache.addRangeToPeakCache(test_length, test_start3, test_end3);
        let newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start,
            test_end3
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end);
        expect(newranges[0][1]).toEqual(test_start3);
        let ranges = peakcache.getCacheRanges();
        expect(ranges.length).toEqual(1);
        expect(ranges[0][0]).toEqual(test_start);
        expect(ranges[0][1]).toEqual(test_end3);
    });

    /** @test {PeakCache#addRangeToPeakCache} */
    /** @test {PeakCache#getCacheRanges} */
    it('filling in disjoint sets coalesces / edge cases', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        peakcache.addRangeToPeakCache(test_length, test_start3, test_end3);
        let newranges = peakcache.addRangeToPeakCache(
            test_length,
            test_start2,
            test_end2
        );
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end);
        expect(newranges[0][1]).toEqual(test_start3);
        let ranges = peakcache.getCacheRanges();
        expect(ranges.length).toEqual(1);
        expect(ranges[0][0]).toEqual(test_start);
        expect(ranges[0][1]).toEqual(test_end3);
    });
});
