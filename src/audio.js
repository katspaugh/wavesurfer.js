'use strict';

WaveSurfer.Audio = {
    /**
     * Initializes the analyser with given params.
     *
     * @param {Object} params (required)
     * @param {HTMLAudioElement} params.audio (required)
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
     * Plays the audio from a given position.
     *
     * @param {Number} start Start offset in seconds,
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
     * Pauses playback.
     */
    pause: function () {
        this.audio.pause();
    },

    getCurrentTime: function () {
        return this.audio.currentTime;
    },

    getPlayedPercents: function () {
        var time = Math.min(this.audio.currentTime, this.audio.duration);
        return (time / this.audio.duration);
    },

    bindUpdate: function (callback) {
        this.audio.addEventListener('timeupdate', callback, false);
    }
};
