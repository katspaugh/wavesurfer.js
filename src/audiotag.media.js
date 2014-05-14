'use strict';

WaveSurfer.AudioTag.Media = {

    setVolume: function (volume) {
        this.media.volume = volume;
    },

    getVolume: function () {
        return this.media.volume;
    },

    getCurrentTime: function () {
        return this.media.currentTime;
    },

    getDuration: function () {
        return this.media.duration;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end When to stop
     * relative to the beginning of a clip.
     */
    play: function (start, end) {
        if (start != null) {
            this.media.currentTime = start;
        }
        if (end == null) {
            this.scheduledPause = null;
        } else {
            this.scheduledPause = end;
        }
        this.media.play();
        this.fireEvent('play');
    },

    isPaused: function () {
        if (typeof this.media === "undefined") {
            return true;
        }
        return this.media.paused;
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playbackRate = value || 1;
        this.media.playbackRate = this.playbackRate;
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.scheduledPause = null;
        this.media.pause();
        this.fireEvent('pause');
    }
};
