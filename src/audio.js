'use strict';

WaveSurfer.Audio = {
    /**
     * Initializes the analyser with given params.
     *
     * @param {Object} params
     * @param {String} params.smoothingTimeConstant
     */
    init: function (params) {
        params = params || {};

        this.audio = params.audio;
    },

    isPaused: function () {
        return this.audio.paused;
    },

    getDuration: function () {
        return this.audio.duration;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of the track.
     *
     * @param {Number} end End offset in seconds,
     * relative to the beginning of the track.
     */
    play: function (start) {
        start = start || 0;
        if (this.audio.currentTime !== start) {
            this.audio.currentTime = start;
        }
        this.audio.play();
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.audio.pause();
    },

    getPlayedPercents: function () {
        var time = this.audio.currentTime;

        // it happens!
        if (time > this.audio.duration) {
            time = this.audio.duration;
        }

        return (time / this.audio.duration);
    },

    bindUpdate: function (callback) {
        this.audio.addEventListener('timeupdate', callback, false);
    }
};
