'use strict';

WaveSurfer.AudioElement = Object.create(WaveSurfer.WebAudio);

WaveSurfer.util.extend(WaveSurfer.AudioElement, {
    init: function (params) {
        this.params = params;

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

    load: function (url, peaks, container) {
        var my = this;

        var media = document.createElement('audio');
        media.controls = false;
        media.autoplay = false;
        media.src = url;

        media.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading media element');
        });

        media.addEventListener('canplay', function () {
            my.fireEvent('canplay');
        });

        media.addEventListener('timeupdate', function () {
            my.fireEvent('audioprocess', my.getCurrentTime());
        });

        var prevMedia = container.querySelector('audio');
        if (prevMedia) {
            container.removeChild(prevMedia);
        }
        container.appendChild(media);

        this.media = media;
        this.peaks = peaks;
        this.setPlaybackRate(this.playbackRate);
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
            duration = this.media.seekable.end();
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
     */
    play: function (start) {
        if (start != null) {
            this.media.currentTime = start;
        }
        this.media.play();
        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.media.pause();
        this.fireEvent('pause');
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
        this.media.parentNode && this.media.removeChild(this.media);
        this.media = null;
    }
});
