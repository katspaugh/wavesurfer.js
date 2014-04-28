'use strict';

WaveSurfer.WebAudio.Media = {
    postInit: function () {
        // Dummy media to catch errors
        this.media = {
            currentTime: 0,
            duration: 0,
            paused: true,
            playbackRate: 1,
            play: function () {},
            pause: function () {}
        };
    },

    load: function (media) {
        this.disconnectSource();
        this.media = media;
        this.source = this.ac.createMediaElementSource(this.media);
        this.media.playbackRate = this.playbackRate;
        this.source.connect(this.analyser);
    },

    isPaused: function () {
        return this.media.paused;
    },

    getDuration: function () {
        return this.media.duration;
    },

    getCurrentTime: function () {
        return this.media.currentTime;
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playbackRate = value || 1;
        this.media.playbackRate = this.playbackRate;
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

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.scheduledPause = null;
        this.media.pause();
        this.fireEvent('pause');
    }
};
