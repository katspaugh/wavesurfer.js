'use strict';

WaveSurfer.AudioTag = {

    init: function (params) {
        this.params = params;
        this.loop = false;
        this.loopStart = false;
        this.loopEnd = false;
        this.prevTime = 0;
    },

    loadMedia: function (media) {
        var my = this;
        var ready = false;
        media.addEventListener("canplaythrough", function () {
            // ready event gets sent twice in chrome
            if (!my.ready) {
                my.fireEvent('ready');
                my.ready = true;
            }
        });

        media.addEventListener("timeupdate", function () {
            my.onTimeUpdate();
        });
        media.load();
    },

    getPeaks: function (length) {
        throw new Error("The audio tag module cannot compute the peaks, please"
                        + " use websurfer.loadStream");
    },

    onTimeUpdate: function () {
        if (this.loop) {
            if (
                this.prevTime > this.loopStart &&
                this.prevTime <= this.loopEnd &&
                this.media.currentTime > this.loopEnd) {
                this.play(this.loopStart);
            }
        }
        this.prevTime = this.media.currentTime;
    }
};

WaveSurfer.util.extend(WaveSurfer.AudioTag, WaveSurfer.Observer);
