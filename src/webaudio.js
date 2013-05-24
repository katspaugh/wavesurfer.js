'use strict';

WaveSurfer.WebAudio = {
    Defaults: {
        fftSize: 1024,
        smoothingTimeConstant: 0.3
    },

    /**
     * Initializes the analyser with given params.
     *
     * @param {Object} params
     * @param {String} params.smoothingTimeConstant
     */
    init: function (params) {
        params = params || {};

        this.ac = new (window.AudioContext || window.webkitAudioContext);

        this.fftSize = params.fftSize || this.Defaults.fftSize;
        this.destination = params.destination || this.ac.destination;

        this.analyser = this.ac.createAnalyser();
        this.analyser.smoothingTimeConstant = params.smoothingTimeConstant ||
            this.Defaults.smoothingTimeConstant;
        this.analyser.fftSize = this.fftSize;
        this.analyser.connect(this.destination);

        this.proc = this.ac.createJavaScriptNode(this.fftSize / 2, 1, 1);
        this.proc.connect(this.destination);

        this.byteTimeDomain = new Uint8Array(this.analyser.fftSize);
        this.byteFrequency = new Uint8Array(this.analyser.fftSize);

        this.paused = true;
    },

    bindUpdate: function (callback) {
        var my = this;

        this.proc.onaudioprocess = function () {
            callback();
            if (my.getPlayedPercents() >= 1.0) {
                my.pause();
                my.lastPause = my.getDuration();
            }
        };
    },

    setSource: function (source) {
        this.source && this.source.disconnect();
        this.source = source;
        this.source.connect(this.analyser);
        this.source.connect(this.proc);
    },

    /**
     * Create and connect to a media element source.
     */
    streamUrl: function (url, onUpdate, onCanPlay) {
        var my = this;
        var audio = new Audio();

        audio.addEventListener('canplay', function () {
            my.setSource(my.ac.createMediaElementSource(audio));

            onCanPlay && onCanPlay();
        }, false);

        audio.addEventListener('timeupdate', function () {
            if (!audio.paused) {
                onUpdate && onUpdate(my.waveform(), audio.currentTime);
            }
        });

        audio.autoplay = false;
        audio.src = url;
        return audio;
    },

    /**
     * Loads audiobuffer.
     *
     * @param {AudioBuffer} audioData Audio data.
     */
    loadData: function (audiobuffer, cb, errb) {
        var my = this;

        this.pause();

        this.ac.decodeAudioData(
            audiobuffer,
            function (buffer) {
                my.currentBuffer = buffer;
                my.lastStart = 0;
                my.lastPause = 0;
                my.startTime = null;
                cb && cb(buffer);
            },
            function () {
                //console.error('Error decoding audio buffer');
                errb && errb();
            }
        );
    },

    isPaused: function () {
        return this.paused;
    },

    getDuration: function () {
        return this.currentBuffer && this.currentBuffer.duration;
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
    play: function (start, end, delay) {
        if (!this.currentBuffer) {
            return;
        }

        this.pause();

        this.setSource(this.ac.createBufferSource());
        this.source.buffer = this.currentBuffer;

        if (null == start) { start = this.getCurrentTime(); }
        if (null == end  ) { end = this.source.buffer.duration; }
        if (null == delay) { delay = 0; }

        this.lastStart = start;
        this.startTime = this.ac.currentTime;

        this.source.noteGrainOn(delay, start, end - start);

        this.paused = false;
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function (delay) {
        if (!this.currentBuffer || this.paused) {
            return;
        }

        this.lastPause = this.getCurrentTime();

        this.source.noteOff(delay || 0);

        this.paused = true;
    },

    getPlayedPercents: function () {
        return this.getCurrentTime() / this.getDuration();
    },

    getCurrentTime: function () {
        if (this.isPaused()) {
            return this.lastPause;
        } else {
            return this.lastStart + (this.ac.currentTime - this.startTime);
        }
    },

    /**
     * Returns the real-time waveform data.
     *
     * @return {Uint8Array} The waveform data.
     * Values range from 0 to 255.
     */
    waveform: function () {
        this.analyser.getByteTimeDomainData(this.byteTimeDomain);
        return this.byteTimeDomain;
    },

    /**
     * Returns the real-time frequency data.
     *
     * @return {Uint8Array} The frequency data.
     * Values range from 0 to 255.
     */
    frequency: function () {
        this.analyser.getByteFrequencyData(this.byteFrequency);
        return this.byteFrequency;
    }
};
