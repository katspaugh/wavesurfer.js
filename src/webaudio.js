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

        this.loop = false;
        this.prevFrameTime = 0;

        this.createVolumeNode();
        this.createScriptNode();
        this.setPlaybackRate(this.params.audioRate);
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
                my.onPlayFrame(time);
                my.fireEvent('audioprocess', time);
            }
        };
    },

    onPlayFrame: function (time) {
        if (this.loop) {
            if (
                this.prevFrameTime > this.loopStart &&
                this.prevFrameTime <= this.loopEnd &&
                time > this.loopEnd
            ) {
                this.play(this.loopStart);
            }
            this.prevFrameTime = time;
        }
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playbackRate = value || 1;
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

    loadMedia: function (media) {
        this.source = this.ac.createMediaElementSource(media);
        this.source.playbackRate = this.playbackRate;
        this.source.connect(this.ac.destination);
    },

    decodeArrayBuffer: function (arraybuffer, callback, errback) {
        var my = this;
        this.offlineAc.decodeAudioData(arraybuffer, function (data) {
            my.buffer = data;
            callback();
        }, errback);
    },

    isPaused: function () {
        return !this.source || this.source.mediaElement.paused;
    },

    getDuration: function () {
        return this.source.mediaElement.duration;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of the track.
     */
    play: function (start) {
        if (start != null) {
            this.source.mediaElement.currentTime = start;
        }
        this.prevFrameTime = this.getCurrentTime();
        this.source.mediaElement.play();
        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.source.mediaElement.pause();
        this.fireEvent('pause');
    },

    /**
     * @returns {Float32Array} Array of peaks.
     */
    getPeaks: function (length) {
        var buffer = this.buffer;
        var sampleSize = buffer.length / length;
        var sampleStep = ~~(sampleSize / 10) || 1;
        var channels = buffer.numberOfChannels;
        var peaks = new Float32Array(length);

        for (var c = 0; c < channels; c++) {
            var chan = buffer.getChannelData(c);
            for (var i = 0; i < length; i++) {
                var start = ~~(i * sampleSize);
                var end = ~~(start + sampleSize);
                var peak = 0;
                for (var j = start; j < end; j += sampleStep) {
                    var value = chan[j];
                    if (value > peak) {
                        peak = value;
                    } else if (-value > peak) {
                        peak = -value;
                    }
                }
                if (c > 0) {
                    peaks[i] += peak;
                } else {
                    peaks[i] = peak;
                }

                // Average peak between channels
                if (c == channels - 1) {
                    peaks[i] = peaks[i] / channels;
                }
            }
        }

        return peaks;
    },

    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },

    getCurrentTime: function () {
        return this.source.mediaElement.currentTime;
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
    },

    destroy: function () {
        this.pause();
        this.unAll();
        this.buffer = null;
        this.filterNode && this.filterNode.disconnect();
        this.gainNode.disconnect();
        this.scriptNode.disconnect();
    },

    updateSelection: function (startPercent, endPercent) {
        var duration = this.getDuration();
        this.loop = true;
        this.loopStart = duration * startPercent;
        this.loopEnd = duration * endPercent;
    },

    clearSelection: function () {
        this.loop = false;
        this.loopStart = 0;
        this.loopEnd = 0;
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
