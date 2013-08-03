'use strict';

WaveSurfer.WebAudio = {
    defaultParams: {
        fftSize: 1024,
        smoothingTimeConstant: 0.3
    },

    /**
     * Initializes the analyser with given params.
     */
    init: function (params) {
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.ac = this.params.AudioContext ||
            new (window.AudioContext || window.webkitAudioContext);
        this.byteTimeDomain = new Uint8Array(this.params.fftSize);
        this.byteFrequency = new Uint8Array(this.params.fftSize);

        this.lastStart = 0;
        this.lastPause = 0;
        this.startTime = 0;

        this.createAnalyzer();
        this.createScriptNode();
    },

    createAnalyzer: function () {
        this.analyser = this.ac.createAnalyser();
        this.analyser.smoothingTimeConstant = this.params.smoothingTimeConstant;
        this.analyser.fftSize = this.params.fftSize;
        this.analyser.connect(this.ac.destination);
    },

    createScriptNode: function () {
        var my = this;
        this.scriptNode = this.ac.createJavaScriptNode(
            this.params.fftSize / 2, 1, 1
        );
        this.scriptNode.connect(this.ac.destination);
        this.scriptNode.onaudioprocess = function () {
            if (my.source && !my.isPaused()) {
                my.fireEvent('audioprocess', my.getPlayedPercents());
            }
        };
    },

    setSource: function (source) {
        this.source && this.source.disconnect();
        this.source = source;
        this.source.connect(this.analyser);
        this.source.connect(this.scriptNode);
    },

    /**
     * Create and connect to a media element source.
     */
    streamUrl: function (url) {
        var my = this;
        var audio = new Audio();

        audio.addEventListener('canplay', function () {
            my.setSource(my.ac.createMediaElementSource(audio));
            my.fireEvent('canplay');
        });

        audio.addEventListener('timeupdate', function () {
            if (!audio.paused) {
                my.fireEvent('timeupdate', audio.currentTime);
            }
        });

        audio.autoplay = false;
        audio.src = url;
        return audio;
    },

    /**
     * Decodes binary data and creates buffer source.
     *
     * @param {ArrayBuffer} arraybuffer Audio data.
     */
    loadBuffer: function (arraybuffer, cb, errb) {
        var my = this;

        if (this.source) {
            this.pause();
        }

        this.ac.decodeAudioData(
            arraybuffer,
            function (buffer) {
                my.currentBuffer = buffer;
                cb && cb(buffer);
            },
            function () {
                //console.error('Error decoding audio buffer');
                errb && errb();
            }
        );
    },

    isPaused: function () {
        return this.source.PLAYING_STATE != this.source.playbackState;
    },

    getDuration: function () {
        return this.currentBuffer.duration;
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
    play: function (start, end) {
        // recreate buffer source
        this.setSource(this.ac.createBufferSource());
        this.source.buffer = this.currentBuffer;

        if (null == start) { start = this.getCurrentTime(); }
        if (null == end  ) { end = this.source.buffer.duration; }

        this.pause();
        this.lastStart = start;
        this.lastPause = end;
        this.startTime = this.ac.currentTime;
        this.source.noteGrainOn(0, start, end - start);
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.lastPause = this.lastStart + (this.ac.currentTime - this.startTime);
        this.source.noteOff(0);
    },

    /**
     * @returns {Float32Array} Array of peaks.
     */
    getPeaks: function (length, sampleStep) {
        sampleStep = sampleStep || 128;
        var buffer = this.currentBuffer;
        var k = buffer.length / length;
        var peaks = new Float32Array(length);

        for (var c = 0; c < buffer.numberOfChannels; c++) {
            var chan = buffer.getChannelData(c);

            for (var i = 0; i < length; i++) {
                var peak = -Infinity;
                var start = ~~(i * k);
                var end = (i + 1) * k;
                for (var j = start; j < end; j += sampleStep) {
                    var val = chan[j];
                    if (val > peak) {
                        peak = val;
                    } else if (-val > peak) {
                        peak = -val;
                    }
                }

                if (c > 0) {
                    peaks[i] += peak;
                } else {
                    peaks[i] = peak;
                }
            }
        }

        return peaks;
    },

    getMaxPeak: function () {
        /* Each peak is a sum of absolute values from each channel. */
        return this.currentBuffer.numberOfChannels * 1.0;
    },

    getPlayedPercents: function () {
        var duration = this.getDuration();
        return duration > 0 ? this.getCurrentTime() / duration : 0;
    },

    getCurrentTime: function () {
        if (this.isPaused()) {
            return this.lastPause;
        }
        return this.lastStart + (this.ac.currentTime - this.startTime);
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

WaveSurfer.util.extend(WaveSurfer.WebAudio, Observer);
