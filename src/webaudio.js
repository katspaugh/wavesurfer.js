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

        this.paused = true;

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
        this.scriptNode = this.ac.createJavaScriptNode(this.params.fftSize / 2, 1, 1);
        this.scriptNode.connect(this.ac.destination);
        var my = this;
        this.scriptNode.onaudioprocess = function () {
            if (!my.isPaused()) {
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

    getPeaks: function (length, sampleStep) {
        sampleStep = sampleStep || 100;
        var buffer = this.currentBuffer;
        var frames = buffer.getChannelData(0).length;
        var k = frames / length;
        var peaks = new Int8Array(length);

        for (var i = 0; i < length; i++) {
            var sum = 0;
            for (var c = 0; c < buffer.numberOfChannels; c++) {
                var chan = buffer.getChannelData(c);
                var vals = chan.subarray(~~(i * k), ~~((i + 1) * k));
                var peak = -Infinity;
                for (var p = 0; p < k; p += sampleStep) {
                    var val = Math.abs(vals[p]);
                    if (val > peak){
                        peak = val;
                    }
                }
                sum += peak;
            }
            peaks[i] = sum * 32;
        }
        return peaks;
    },

    getPlayedPercents: function () {
        var duration = this.getDuration();
        return duration > 0 ? this.getCurrentTime() / duration : 0;
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

WaveSurfer.util.extend(WaveSurfer.WebAudio, Observer);
