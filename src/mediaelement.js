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
        this.elementPosition = params.elementPosition;
        this.setPlaybackRate(this.params.audioRate);
        this.createTimer();
    },


    /**
     * Create a timer to provide a more precise `audioprocess' event.
     */
    createTimer: function () {
        var my = this;
        var playing = false;

        var onAudioProcess = function () {
            if (my.isPaused()) { return; }

            my.fireEvent('audioprocess', my.getCurrentTime());

            // Call again in the next frame
            var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
            requestAnimationFrame(onAudioProcess);
        };

        this.on('play', onAudioProcess);
    },

    /**
     *  Create media element with url as its source,
     *  and append to container element.
     *  @param  {String}        url         path to media file
     *  @param  {HTMLElement}   container   HTML element
     *  @param  {Array}         peaks       array of peak data
     *  @param  {String}        preload     HTML 5 preload attribute value
     */
    load: function (url, container, peaks, preload) {
        var my = this;

        var media = document.createElement(this.mediaType);
        media.controls = this.params.mediaControls;
        media.autoplay = this.params.autoplay || false;
        media.preload = preload == null ? 'auto' : preload;
        media.src = url;
        media.style.width = '100%';

        var prevMedia = container.querySelector(this.mediaType);
        if (prevMedia) {
            container.removeChild(prevMedia);
        }
        container.appendChild(media);

        this._load(media, peaks);
    },

    /**
     *  Load existing media element.
     *  @param  {MediaElement}  elt     HTML5 Audio or Video element
     *  @param  {Array}         peaks   array of peak data
     */
    loadElt: function (elt, peaks) {
        var my = this;

        var media = elt;
        media.controls = this.params.mediaControls;
        media.autoplay = this.params.autoplay || false;

        this._load(media, peaks);
    },

    /**
     *  Private method called by both load (from url)
     *  and loadElt (existing media element).
     *  @param  {MediaElement}  media     HTML5 Audio or Video element
     *  @param  {Array}         peaks   array of peak data
     *  @private
     */
    _load: function (media, peaks) {
        var my = this;

        // load must be called manually on iOS, otherwise peaks won't draw
        // until a user interaction triggers load --> 'ready' event
        if (typeof media.load == 'function') {
            media.load();
        }

        media.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading media element');
        });

        media.addEventListener('canplay', function () {
            my.fireEvent('canplay');
        });

        media.addEventListener('ended', function () {
            my.fireEvent('finish');
        });

        this.media = media;
        this.peaks = peaks;
        this.onPlayEnd = null;
        this.buffer = null;
        this.setPlaybackRate(this.playbackRate);
    },

    isPaused: function () {
        return !this.media || this.media.paused;
    },

    getDuration: function () {
        var duration = (this.buffer || this.media).duration;
        if (duration >= Infinity) { // streaming audio
            duration = this.media.seekable.end(0);
        }
        return duration;
    },

    getCurrentTime: function () {
        return this.media && this.media.currentTime;
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
        this.clearPlayEnd();
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end End offset in seconds,
     * relative to the beginning of a clip.
     */
    play: function (start, end) {
        this.seekTo(start);
        this.media.play();
        end && this.setPlayEnd(end);
        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.media && this.media.pause();
        this.clearPlayEnd();
        this.fireEvent('pause');
    },

    setPlayEnd: function (end) {
        var my = this;
        this.onPlayEnd = function (time) {
            if (time >= end) {
                my.pause();
                my.seekTo(end);
            }
        };
        this.on('audioprocess', this.onPlayEnd);
    },

    clearPlayEnd: function () {
        if (this.onPlayEnd) {
            this.un('audioprocess', this.onPlayEnd);
            this.onPlayEnd = null;
        }
    },

    getPeaks: function (length, start, end) {
        if (this.buffer) {
            return WaveSurfer.WebAudio.getPeaks.call(this, length, start, end);
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
        this.media && this.media.parentNode && this.media.parentNode.removeChild(this.media);
        this.media = null;
    }
});

//For backwards compatibility
WaveSurfer.AudioElement = WaveSurfer.MediaElement;
