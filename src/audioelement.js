'use strict';

WaveSurfer.AudioElement = Object.create(WaveSurfer.WebAudioMedia);

WaveSurfer.util.extend(WaveSurfer.AudioElement, {
    init: function (params) {
        this.params = params;

        this.loop = false;
        this.prevFrameTime = 0;
        this.scheduledPause = null;

        this.postInit();
        this.setPlaybackRate(this.params.audioRate);
    },

    load: function (media, peaks) {
        this.media = media;
        this.peaks = peaks;
        this.maxCurrentTime = 0;
        this.setPlaybackRate(this.playbackRate);
    },

    getPeaks: function () {
        return this.peaks || [];
    },

    getVolume: function () {
        return this.media.volume;
    },

    setVolume: function (val) {
        this.media.volume = val;
    },

    destroy: function () {
        this.pause();
        this.unAll();
        this.media = null;
    }
});
