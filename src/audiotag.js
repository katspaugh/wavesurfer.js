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
            // canplaythrough event gets sent twice in chrome
            if (!my.ready) {
                my.fireEvent('ready');
                my.ready = true;
            }
        });

        media.addEventListener("timeupdate", function () {
            my.onTimeUpdate();
        });
        media.load();
        this.media = media;
        WaveSurfer.util.extend(WaveSurfer.AudioTag, WaveSurfer.AudioTag.Media);
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
    },

    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },

    updateSelection: function (startPercent, endPercent) {
        var duration = this.getDuration();
        this.loop = true;
        this.loopStart = duration * startPercent;
        this.loopEnd = duration * endPercent;
    },

    clearSelection: function () {
        this.loop = false;
        this.loopStart = 0;
        this.loopEnd = 0;
    },


    /* Dummy methods */

    /**
     * @returns {Boolean}
     */
    isPaused: function () {
        return true;
    },

    /**
     * Get duration in seconds.
     */
    getDuration: function () {
        return 0;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end When to stop
     * relative to the beginning of a clip.
     */
    play: function (start, end) {},

    /**
     * Pauses the loaded audio.
     */
    pause: function () {},

    getPeaks: function (length) {
        throw new Error("The audio tag module cannot compute the peaks, please"
                        + " use WaveSurfer.loadStream");
    }
};

WaveSurfer.util.extend(WaveSurfer.AudioTag, WaveSurfer.Observer);
