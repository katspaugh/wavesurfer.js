'use strict';

WaveSurfer.WebAudioMedia = Object.create(WaveSurfer.WebAudio);

WaveSurfer.util.extend(WaveSurfer.WebAudioMedia, {
    postInit: function () {
        var my = this;

        // Dummy media to catch errors
        this.media = {
            currentTime: 0,
            duration: 0,
            paused: true,
            playbackRate: 1,
            play: function () {},
            pause: function () {}
        };

        this.maxCurrentTime = 0;
        this.on('audioprocess', function (time) {
            if (time > my.maxCurrentTime) {
                my.maxCurrentTime = time;
            }
        });
    },

    load: function (media) {
        this.disconnectSource();
        this.media = media;
        this.maxCurrentTime = 0;
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

    getPlayedPercents: function () {
        var duration = this.getDuration();
        var time = this.getCurrentTime();
        if (duration >= Infinity) { // streaming audio
            duration = this.maxCurrentTime;
        }
        return (time / duration) || 0;
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
});
