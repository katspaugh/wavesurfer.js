describe('util', function() {

    it('getId returns a random string', function() {
        expect(WaveSurfer.util.getId()).toStartWith('wavesurfer_');
    });

});
