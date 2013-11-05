'use strict';

WaveSurfer.WebAudio = {
    scriptBufferSize: 256,

    init: function (params) {
        if (!(window.AudioContext || window.webkitAudioContext)) {
            throw new Error(
                'wavesurfer.js: your browser doesn\'t support WebAudio'
            );
        }
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();
        this.offlineAc = this.getOfflineAudioContext(this.ac.sampleRate);

        this.createVolumeNode();
        this.createScriptNode();
    },

    setFilter: function (filterNode) {
        this.filterNode && this.filterNode.disconnect();
        this.gainNode.disconnect();
        if (filterNode) {
            filterNode.connect(this.ac.destination);
            this.gainNode.connect(filterNode);
        } else {
            this.gainNode.connect(this.ac.destination);
        }
        this.filterNode = filterNode;
    },

    createScriptNode: function () {
        var my = this;
        var bufferSize = this.scriptBufferSize;
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(bufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(bufferSize);
        }
        this.scriptNode.connect(this.ac.destination);
        this.scriptNode.onaudioprocess = function () {
            if (!my.isPaused()) {
                var time = my.getCurrentTime();
                if (time > my.scheduledPause) {
                    my.pause();
                }
                my.fireEvent('audioprocess', time);
            }
        };
    },

    /**
     * Create the gain node needed to control the playback volume.
     */
    createVolumeNode: function () {
        // Create gain node using the AudioContext
        if (this.ac.createGain) {
            this.gainNode = this.ac.createGain();
        } else {
            this.gainNode = this.ac.createGainNode();
        }
        // Add the gain node to the graph
        this.gainNode.connect(this.ac.destination);
    },

    /**
     * Set the gain to a new value.
     *
     * @param {Number} newGain The new gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    setVolume: function (newGain) {
        this.gainNode.gain.value = newGain;
    },

    /**
     * Get the current gain.
     *
     * @returns {Number} The current gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    getVolume: function () {
        return this.gainNode.gain.value;
    },

    clearSource: function () {
        this.source.disconnect();
        this.source = null;
    },

    refreshBufferSource: function () {
        this.source && this.clearSource();
        this.source = this.ac.createBufferSource();
        if (this.buffer) {
            this.source.buffer = this.buffer;
        }
        this.source.connect(this.gainNode);
    },

    setBuffer: function (buffer) {
        this.lastPause = 0;
        this.lastStart = 0;
        this.startTime = 0;
        this.paused = true;
        this.buffer = buffer;
    },

    /**
     * Decodes binary data and creates buffer source.
     *
     * @param {ArrayBuffer} arraybuffer Audio data.
     * @param {Function} cb Callback on success.
     * @param {Function} errb Callback on error.
     */
    loadBuffer: function (arraybuffer, cb, errb) {
        var my = this;
        this.offlineAc.decodeAudioData(
            arraybuffer,
            function (buffer) {
                my.setBuffer(buffer);
                cb && cb(buffer);
            },
            errb
        );
    },

    loadEmpty: function () {
        this.setBuffer(null);
    },

    isPaused: function () {
        return this.paused;
    },

    getDuration: function () {
        return this.buffer ? this.buffer.duration : 0;
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
        this.refreshBufferSource();

        if (null == start) { start = this.getCurrentTime(); }
        if (null == end) { end = this.getDuration(); }
        if (start > end) {
            start = 0;
        }

        this.lastStart = start;
        this.startTime = this.ac.currentTime;
        this.paused = false;
        this.scheduledPause = end;

        if (this.source.start) {
            this.source.start(0, start, end - start);
        } else {
            this.source.noteGrainOn(0, start, end - start);
        }

        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.lastPause = this.lastStart + (this.ac.currentTime - this.startTime);
        this.paused = true;
        if (this.source) {
            if (this.source.stop) {
                this.source.stop(0);
            } else {
                this.source.noteOff(0);
            }
            this.clearSource();
        }

        this.fireEvent('pause');
    },

    /**
     * @returns {Float32Array} Array of peaks.
     */
    getPeaks: function (length, sampleStep) {
        var buffer = this.buffer;
        var sampleSize = Math.ceil(buffer.length / length);
        sampleStep = sampleStep || ~~(sampleSize / 10);
        var channels = buffer.numberOfChannels;
        var peaks = new Float32Array(length);

        for (var c = 0; c < channels; c++) {
            var chan = buffer.getChannelData(c);
            for (var i = 0; i < length; i++) {
                var start = ~~(i * sampleSize);
                var end = start + sampleSize;
                var peak = 0;
                for (var j = start; j < end; j += sampleStep) {
                    var value = chan[j];
                    if (value > peak) {
                        peak = value;
                    } else if (-value > peak) {
                        peak = -value;
                    }
                }
                if (c > 1) {
                    peaks[i] += peak / channels;
                } else {
                    peaks[i] = peak / channels;
                }
            }
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
        }
        return this.lastStart + (this.ac.currentTime - this.startTime);
    },

    audioContext: null,
    getAudioContext: function () {
        if (!WaveSurfer.WebAudio.audioContext) {
            WaveSurfer.WebAudio.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            );
        }
        return WaveSurfer.WebAudio.audioContext;
    },

    offlineAudioContext: null,
    getOfflineAudioContext: function (sampleRate) {
        if (!WaveSurfer.WebAudio.offlineAudioContext) {
            WaveSurfer.WebAudio.offlineAudioContext = new (
                window.OfflineAudioContext || window.webkitOfflineAudioContext
            )(1, 2, sampleRate);
        }
        return WaveSurfer.WebAudio.offlineAudioContext;
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
