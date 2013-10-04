'use strict';

WaveSurfer.WebAudio = {
    init: function (params) {
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();
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

    /**
     * This is called externally when high resolution timer is needed.
     */
    createScriptNode: function () {
        var my = this;
        var bufferSize = 256;
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(bufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(bufferSize);
        }
        this.scriptNode.connect(this.ac.destination);
        this.scriptNode.onaudioprocess = function () {
            if (!my.isPaused()) {
                my.fireEvent('audioprocess');
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

    refreshBufferSource: function () {
        this.source && this.source.disconnect();
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
        this.ac.decodeAudioData(
            arraybuffer,
            function (buffer) {
                my.setBuffer(buffer);
                cb && cb(buffer);
            },
            errb
        );
    },

    loadEmpty: function () {
        this.setBuffer(0);
    },

    isPaused: function () {
        return this.paused;
    },

    getDuration: function () {
        return this.buffer.duration;
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
            this.source.disconnect();
            this.source = null;
        }

        this.fireEvent('pause');
    },

    /**
     * @returns {Float32Array} Array of peaks.
     */
    getPeaks: function (length, sampleStep) {
        sampleStep = sampleStep || 128;
        var buffer = this.buffer;
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

    getMaxPeak: function (peaks) {
        return this.params.normalize ?
            WaveSurfer.util.max(peaks) :
            this.buffer.numberOfChannels * 1.0;
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

    getAudioContext: (function () {
        // audioContext should be a singleton
        var audioContext;
        return function () {
            if (!audioContext) {
                audioContext = new (
                    window.AudioContext || window.webkitAudioContext
                );
            }
            return audioContext;
        };
    }())
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
