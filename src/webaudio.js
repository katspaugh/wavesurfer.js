'use strict';

WaveSurfer.WebAudio = {
    init: function (params) {
        this.ac = params.AudioContext ||
            new (window.AudioContext || window.webkitAudioContext);

        this.createScriptNode();
        this.createVolumeNode();
    },

    createScriptNode: function () {
        var my = this;
        this.scriptNode = this.ac.createJavaScriptNode(256);
        this.scriptNode.connect(this.ac.destination);
        this.scriptNode.onaudioprocess = function () {
            if (my.source && !my.isPaused()) {
                my.fireEvent('audioprocess', my.getPlayedPercents());
            }
        };
    },

    /**
     * Create the gain node needed to control the playback volume.
     */
    createVolumeNode: function () {
        // Create gain node using the AudioContext
        this.gainNode = this.ac.createGainNode();

        // Add the gain node to the graph
        this.gainNode.connect(this.ac.destination);
    },

    refreshBufferSource: function () {
        this.source && this.source.disconnect();
        this.source = this.ac.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.scriptNode);
        this.source.connect(this.ac.destination);
    },

    setBuffer: function (buffer) {
        this.lastPause = 0;
        this.lastStart = 0;
        this.startTime = 0;
        this.buffer = buffer;
        this.refreshBufferSource();
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
                my.setBuffer(buffer);
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
        if (null == end) {
            end = this.getDuration();
        } else {
            this.lastPause = end;
        }

        this.lastStart = start;
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

    getMaxPeak: function () {
        /* Peaks are sums of absolute peak values from each channel. */
        return this.buffer.numberOfChannels * 1.0;
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
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, Observer);
