describe('peakcache', function() {
    var peakcache;
    var test_length = 200;
    var test_length2 = 300;
    var test_start = 50;
    var test_end = 100;
    var test_start2 = 100;
    var test_end2 = 120;
    var test_start3 = 120;
    var test_end3 = 150;

    var window_size = 20;

    function __createPeakCache() {
        peakcache = Object.create(WaveSurfer.PeakCache);
        peakcache.init();
    }

    beforeEach(function (done) {
        __createPeakCache();
        done();
    });

    it('empty cache returns full range', function() {
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_start);
        expect(newranges[0][1]).toEqual(test_end);
    });

    it('different length clears cache', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        var newranges = peakcache.addRangeToPeakCache(test_length2, test_start, test_end);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_start);
        expect(newranges[0][1]).toEqual(test_end);
    });

    it('consecutive calls return no ranges', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        expect(newranges.length).toEqual(0);
    });

    it('sliding window returns window sized range', function() {
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_start);
        expect(newranges[0][1]).toEqual(test_end);
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start + window_size, test_end + window_size);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end);
        expect(newranges[0][1]).toEqual(test_end + window_size);
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start + window_size * 2, test_end + window_size * 2);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end + window_size);
        expect(newranges[0][1]).toEqual(test_end + window_size * 2);
    });

    it('disjoint set creates two ranges', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        peakcache.addRangeToPeakCache(test_length, test_start3, test_end3);
        var ranges = peakcache.getCacheRanges();
        expect(ranges.length).toEqual(2);
        expect(ranges[0][0]).toEqual(test_start);
        expect(ranges[0][1]).toEqual(test_end);
        expect(ranges[1][0]).toEqual(test_start3);
        expect(ranges[1][1]).toEqual(test_end3);
    });

    it('filling in disjoint sets coalesces', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        peakcache.addRangeToPeakCache(test_length, test_start3, test_end3);
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start, test_end3);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end);
        expect(newranges[0][1]).toEqual(test_start3);
        var ranges = peakcache.getCacheRanges();
        expect(ranges.length).toEqual(1);
        expect(ranges[0][0]).toEqual(test_start);
        expect(ranges[0][1]).toEqual(test_end3);
    });

    it('filling in disjoint sets coalesces / edge cases', function() {
        peakcache.addRangeToPeakCache(test_length, test_start, test_end);
        peakcache.addRangeToPeakCache(test_length, test_start3, test_end3);
        var newranges = peakcache.addRangeToPeakCache(test_length, test_start2, test_end2);
        expect(newranges.length).toEqual(1);
        expect(newranges[0][0]).toEqual(test_end);
        expect(newranges[0][1]).toEqual(test_start3);
        var ranges = peakcache.getCacheRanges();
        expect(ranges.length).toEqual(1);
        expect(ranges[0][0]).toEqual(test_start);
        expect(ranges[0][1]).toEqual(test_end3);
    });

});
