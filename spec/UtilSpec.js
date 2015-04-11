describe("util", function() {

    it("getId returns a unique string", function() {
        expect(WaveSurfer.util.getId()).toStartWith('wavesurfer_');
    });

});
