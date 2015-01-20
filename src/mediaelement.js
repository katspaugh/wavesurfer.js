'use strict';

WaveSurfer.MediaElement = Object.create(WaveSurfer.WebAudio);

WaveSurfer.util.extend(WaveSurfer.MediaElement, {
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

        this.mediaType = params.mediaType.toLowerCase();


        this.ac = params.audioContext || this.getAudioContext();
        this.elementPosition = params.elementPosition;
    },

    load: function (url, container, peaks) {
        var my = this;

        var media = document.createElement(this.mediaType);
        media.controls = false;
        media.autoplay = false;
        media.preload = 'auto';
        media.src = url;

        media.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading media element');
        });

        media.addEventListener('canplay', function () {
            my.fireEvent('canplay');
        });

        media.addEventListener('ended', function () {
            my.fireEvent('finish');
        });

        media.addEventListener('timeupdate', function () {
            my.fireEvent('audioprocess', my.getCurrentTime());
        });

        var prevMedia = container.querySelector(this.mediaType);
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
        var duration = this.media.duration;
        if (duration >= Infinity) { // streaming audio
            duration = this.media.seekable.end();
        }
        return duration;
    },

    getCurrentTime: function () {
        return this.media.currentTime;
    },

    getPlayedPercents: function () {
        return (this.getCurrentTime() / this.getDuration()) || 0;
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playbackRate = value || 1;
        this.media.playbackRate = this.playbackRate;
    },

    seekTo: function (start) {
        if (start != null) {
            this.media.currentTime = start;
        }
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     */
    play: function (start) {
        this.seekTo(start);
        this.media.play();
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.media.pause();
    },

    getPeaks: function (length) {
        if (this.buffer) {
            return WaveSurfer.WebAudio.getPeaks.call(this, length);
        }
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
        this.media.parentNode && this.media.parentNode.removeChild(this.media);
        this.media = null;
    }
});

//For backwards compatibility
WaveSurfer.AudioElement = WaveSurfer.MediaElement;
