'use strict';

WaveSurfer.WebAudio = {
    Defaults: {
        fftSize: 1024,
        smoothingTimeConstant: 0.3
    },

    ac: new (window.AudioContext || window.webkitAudioContext),

    /**
     * Initializes the analyser with given params.
     *
     * @param {Object} params
     * @param {String} params.smoothingTimeConstant
     */
    init: function (params) {
        params = params || {};

        this.fftSize = params.fftSize || this.Defaults.fftSize;
        this.destination = params.destination || this.ac.destination;

        this.analyser = this.ac.createAnalyser();
        this.analyser.smoothingTimeConstant = params.smoothingTimeConstant ||
            this.Defaults.smoothingTimeConstant;
        this.analyser.fftSize = this.fftSize;
        this.analyser.connect(this.destination);

        this.proc = this.ac.createScriptProcessor(this.fftSize / 2, 1, 1);
        this.proc.connect(this.destination);

        this.dataArray = new Uint8Array(this.analyser.fftSize);

        this.paused = true;
    },

    bindUpdate: function (callback) {
        this.proc.onaudioprocess = callback;
    },

    setSource: function (source) {
        this.source && this.source.disconnect();
        this.source = source;
        this.source.connect(this.analyser);
        this.source.connect(this.proc);
    },

    /**
     * Loads audiobuffer.
     *
     * @param {AudioBuffer} audioData Audio data.
     */
    loadData: function (audioData, cb) {
        var my = this;

        this.pause();

        this.ac.decodeAudioData(
            audioData,
            function (buffer) {
                my.currentBuffer = buffer;
                my.lastStart = 0;
                my.lastPause = 0;
                my.startTime = null;
                cb(buffer);
            },
            Error
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

        this.source.start(delay, start, end - start);

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

        this.source.stop(delay || 0);

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
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    },

    /**
     * Returns the real-time frequency data.
     *
     * @return {Uint8Array} The frequency data.
     * Values range from 0 to 255.
     */
    frequency: function () {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }
};
