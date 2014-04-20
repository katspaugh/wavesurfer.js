'use strict';

WaveSurfer.WebAudio = {
    scriptBufferSize: 256,
    fftSize: 128,

    init: function (params) {
        if (!(window.AudioContext || window.webkitAudioContext)) {
            throw new Error(
                'wavesurfer.js: your browser doesn\'t support WebAudio'
            );
        }
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();

        this.loop = false;
        this.prevFrameTime = 0;
        this.scheduledPause = null;

        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();
        this.setPlaybackRate(this.params.audioRate);
    },

    disconnectFilters: function () {
        if (this.inputFilter) {
            this.inputFilter.disconnect();
        }
        if (this.outputFilter) {
            this.outputFilter.disconnect();
        }
    },

    setFilter: function (inputFilter, outputFilter) {
        this.disconnectFilters();

        this.inputFilter = inputFilter;
        this.outputFilter = outputFilter || inputFilter;

        if (this.inputFilter && this.outputFilter) {
            this.analyser.connect(this.inputFilter);
            this.outputFilter.connect(this.ac.destination);
            this.gainNode.connect(this.outputFilter);
        } else {
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.ac.destination);
        }
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
        if (this.scheduledPause != null) {
            if (this.prevFrameTime >= this.scheduledPause) {
                this.pause();
            }
        }

        if (this.loop) {
            if (
                this.prevFrameTime > this.loopStart &&
                this.prevFrameTime <= this.loopEnd &&
                time > this.loopEnd
            ) {
                this.play(this.loopStart);
            }
        }

        this.prevFrameTime = time;
    },

    createAnalyserNode: function () {
        this.analyser = this.ac.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.connect(this.gainNode);
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playbackRate = value || 1;
        if (this.source) {
            this.media.playbackRate = this.playbackRate;
        }
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
        if (this.source) {
            this.source.disconnect();
        }
        this.media = media;
        this.source = this.ac.createMediaElementSource(this.media);
        this.media.playbackRate = this.playbackRate;
        this.source.connect(this.analyser);
    },

    decodeArrayBuffer: function (arraybuffer, callback, errback) {
        var my = this;
        this.ac.decodeAudioData(arraybuffer, function (data) {
            my.buffer = data;
            callback();
        }, errback);
    },

    isPaused: function () {
        return !this.source || this.media.paused;
    },

    getDuration: function () {
        return this.buffer.duration || this.media.duration;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end When to stop
     * relative to the beginning of a clip.
     */
    play: function (start, end) {
        if (start != null) {
            this.media.currentTime = start;
        }
        if (end == null) {
            this.scheduledPause = null;
        } else {
            this.scheduledPause = end;
        }
        this.prevFrameTime = this.getCurrentTime();
        this.media.play();
        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.scheduledPause = null;
        this.media.pause();
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
        return this.media.currentTime;
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

    disconnectSource: function () {
        if (this.source) {
            this.source.disconnect();
        }
    },

    destroy: function () {
        this.pause();
        this.unAll();
        this.buffer = null;
        this.disconnectFilters();
        this.disconnectSource();
        this.gainNode.disconnect();
        this.scriptNode.disconnect();
        this.analyser.disconnect();
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
    },

    /**
     * Returns the real-time waveform data.
     *
     * @return {Uint8Array} The frequency data.
     * Values range from 0 to 255.
     */
    waveform: function () {
        this.analyser.getByteTimeDomainData(this.analyserData);
        return this.analyserData;
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
