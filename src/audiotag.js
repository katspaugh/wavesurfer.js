'use strict';

WaveSurfer.AudioTag = {

    init: function (params) {
        this.params = params;
        this.loop = false;
        this.loopStart = false;
        this.loopEnd = false;
        this.prevTime = 0;
        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) :
            params.container;
    },

    loadMedia: function (url) {
        this.ready = false;
        this.media = this.createAudioTag(url);
        this.media.load();
    },

    setVolume: function (volume) {
        this.media.volume = volume;
    },

    getVolume: function () {
        return this.media.volume;
    },

    getPeaks: function (length) {
        throw new Error("The audio tag module cannot compute the peaks, please"
                        + " use the getPeaks parameter");
    },

    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },

    getCurrentTime: function () {
        return this.media.currentTime;
    },

    getDuration: function () {
        return this.media.duration;
    },

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
        this.fireEvent("play");
    },

    isPaused: function () {
        if (typeof this.media === "undefined") {
            return true;
        }
        return this.media.paused;
    },

    updateSelection: function (startPercent, endPercent) {
        var duration = this.getDuration();
        this.loop = true;
        this.loopStart = duration * startPercent;
        this.loopEnd = duration * endPercent;
    },

    clearSelection: function (startPercent, endPercent) {
        this.loop = false;
        this.loopStart = 0;
        this.loopEnd = 0;
    },

    pause: function (start, end) {
        this.scheduledPause = null;
        this.media.pause();
        this.fireEvent('pause');
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

    createAudioTag: function (url) {
        var my = this;
        var media = document.createElement('audio');
        media.controls = false;
        media.autoplay = false;
        media.src = url;

        media.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading media element');
        });

        media.addEventListener("canplaythrough", function () {
            if (!my.ready) {
                my.fireEvent('ready');
                my.ready = true;
            }
        });

        media.addEventListener("timeupdate", function () {
            my.onTimeUpdate();
        });

        var prevMedia = this.container.querySelector('audio');
        if (prevMedia) {
            this.container.removeChild(prevMedia);
        }
        this.container.appendChild(media);

        return media;
    },

    disconnectSource: function () {
    }
};

WaveSurfer.util.extend(WaveSurfer.AudioTag, WaveSurfer.Observer);
