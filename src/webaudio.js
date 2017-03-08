'use strict';

WaveSurfer.WebAudio = {
    scriptBufferSize: 256,
    PLAYING_STATE: 0,
    PAUSED_STATE: 1,
    FINISHED_STATE: 2,

    supportsWebAudio: function () {
        return !!(window.AudioContext || window.webkitAudioContext);
    },

    getAudioContext: function () {
        if (!WaveSurfer.WebAudio.audioContext) {
            WaveSurfer.WebAudio.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            );
        }
        return WaveSurfer.WebAudio.audioContext;
    },

    getOfflineAudioContext: function (sampleRate) {
        if (!WaveSurfer.WebAudio.offlineAudioContext) {
            WaveSurfer.WebAudio.offlineAudioContext = new (
                window.OfflineAudioContext || window.webkitOfflineAudioContext
            )(1, 2, sampleRate);
        }
        return WaveSurfer.WebAudio.offlineAudioContext;
    },

    init: function (params) {
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();

        this.lastPlay = this.ac.currentTime;
        this.startPosition = 0;
        this.scheduledPause = null;

        this.states = [
            Object.create(WaveSurfer.WebAudio.state.playing),
            Object.create(WaveSurfer.WebAudio.state.paused),
            Object.create(WaveSurfer.WebAudio.state.finished)
        ];

        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();

        this.setState(this.PAUSED_STATE);
        this.setPlaybackRate(this.params.audioRate);
        this.setLength(0);
    },

    disconnectFilters: function () {
        if (this.filters) {
            this.filters.forEach(function (filter) {
                filter && filter.disconnect();
            });
            this.filters = null;
            // Reconnect direct path
            this.analyser.connect(this.gainNode);
        }
    },

    setState: function (state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    },

    // Unpacked filters
    setFilter: function () {
        this.setFilters([].slice.call(arguments));
    },

    /**
     * @param {Array} filters Packed ilters array
     */
    setFilters: function (filters) {
        // Remove existing filters
        this.disconnectFilters();

        // Insert filters if filter array not empty
        if (filters && filters.length) {
            this.filters = filters;

            // Disconnect direct path before inserting filters
            this.analyser.disconnect();

            // Connect each filter in turn
            filters.reduce(function (prev, curr) {
                prev.connect(curr);
                return curr;
            }, this.analyser).connect(this.gainNode);
        }

    },

    createScriptNode: function () {
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(this.scriptBufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(this.scriptBufferSize);
        }

        this.scriptNode.connect(this.ac.destination);
    },

    addOnAudioProcess: function () {
        var my = this;

        this.scriptNode.onaudioprocess = function () {
            var time = my.getCurrentTime();

            if (time >= my.getDuration()) {
                my.setState(my.FINISHED_STATE);
                my.fireEvent('pause');
            } else if (time >= my.scheduledPause) {
                my.pause();
            } else if (my.state === my.states[my.PLAYING_STATE]) {
                my.fireEvent('audioprocess', time);
            }
        };
    },

    removeOnAudioProcess: function () {
        this.scriptNode.onaudioprocess = null;
    },

    createAnalyserNode: function () {
        this.analyser = this.ac.createAnalyser();
        this.analyser.connect(this.gainNode);
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

    decodeArrayBuffer: function (arraybuffer, callback, errback) {
        if (!this.offlineAc) {
            this.offlineAc = this.getOfflineAudioContext(this.ac ? this.ac.sampleRate : 44100);
        }
        this.offlineAc.decodeAudioData(arraybuffer, (function (data) {
            callback(data);
        }).bind(this), errback);
    },

    /**
     * Set pre-decoded peaks.
     */
    setPeaks: function (peaks) {
        this.peaks = peaks;
    },

    /**
     * Set the rendered length (different from the length of the audio).
     */
    setLength: function (length) {
        // No resize, we can preserve the cached peaks.
        if (this.mergedPeaks && length == ((2 * this.mergedPeaks.length - 1) + 2)) {
          return;
        }

        this.splitPeaks = [];
        this.mergedPeaks = [];
        // Set the last element of the sparse array so the peak arrays are
        // appropriately sized for other calculations.
        var channels = this.buffer ? this.buffer.numberOfChannels : 1;
        for (var c = 0; c < channels; c++) {
          this.splitPeaks[c] = [];
          this.splitPeaks[c][2 * (length - 1)] = 0;
          this.splitPeaks[c][2 * (length - 1) + 1] = 0;
        }
        this.mergedPeaks[2 * (length - 1)] = 0;
        this.mergedPeaks[2 * (length - 1) + 1] = 0;
    },

    /**
     * Compute the max and min value of the waveform when broken into
     * <length> subranges.
     * @param {Number} length How many subranges to break the waveform into.
     * @param {Number} first First sample in the required range.
     * @param {Number} last Last sample in the required range.
     * @returns {Array} Array of 2*<length> peaks or array of arrays
     * of peaks consisting of (max, min) values for each subrange.
     */
    getPeaks: function (length, first, last) {
        if (this.peaks) { return this.peaks; }

        this.setLength(length);

        var sampleSize = this.buffer.length / length;
        var sampleStep = ~~(sampleSize / 10) || 1;
        var channels = this.buffer.numberOfChannels;

        for (var c = 0; c < channels; c++) {
            var peaks = this.splitPeaks[c];
            var chan = this.buffer.getChannelData(c);

            for (var i = first; i <= last; i++) {
                var start = ~~(i * sampleSize);
                var end = ~~(start + sampleSize);
                var min = 0;
                var max = 0;

                for (var j = start; j < end; j += sampleStep) {
                    var value = chan[j];

                    if (value > max) {
                        max = value;
                    }

                    if (value < min) {
                        min = value;
                    }
                }

                peaks[2 * i] = max;
                peaks[2 * i + 1] = min;

                if (c == 0 || max > this.mergedPeaks[2 * i]) {
                    this.mergedPeaks[2 * i] = max;
                }

                if (c == 0 || min < this.mergedPeaks[2 * i + 1]) {
                    this.mergedPeaks[2 * i + 1] = min;
                }
            }
        }

        return this.params.splitChannels ? this.splitPeaks : this.mergedPeaks;
    },

    getPlayedPercents: function () {
        return this.state.getPlayedPercents.call(this);
    },

    disconnectSource: function () {
        if (this.source) {
            this.source.disconnect();
        }
    },

    destroy: function () {
        if (!this.isPaused()) {
            this.pause();
        }
        this.unAll();
        this.buffer = null;
        this.disconnectFilters();
        this.disconnectSource();
        this.gainNode.disconnect();
        this.scriptNode.disconnect();
        this.analyser.disconnect();
        // close the audioContext if closeAudioContext option is set to true
        if (this.params.closeAudioContext) {
            // check if browser supports AudioContext.close()
            if (typeof this.ac.close === 'function' && this.ac.state != 'closed') {
                this.ac.close();
            }
            // clear the reference to the audiocontext
            this.ac = null;
            // clear the actual audiocontext, either passed as param or the
            // global singleton
            if (!this.params.audioContext) {
                WaveSurfer.WebAudio.audioContext = null;
            } else {
                this.params.audioContext = null;
            }
            // clear the offlineAudioContext
            WaveSurfer.WebAudio.offlineAudioContext = null;
        }
    },

    load: function (buffer) {
        this.startPosition = 0;
        this.lastPlay = this.ac.currentTime;
        this.buffer = buffer;
        this.createSource();
    },

    createSource: function () {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();

        //adjust for old browsers.
        this.source.start = this.source.start || this.source.noteGrainOn;
        this.source.stop = this.source.stop || this.source.noteOff;

        this.source.playbackRate.value = this.playbackRate;
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
    },

    isPaused: function () {
        return this.state !== this.states[this.PLAYING_STATE];
    },

    getDuration: function () {
        if (!this.buffer) {
            return 0;
        }
        return this.buffer.duration;
    },

    seekTo: function (start, end) {
        if (!this.buffer) { return; }

        this.scheduledPause = null;

        if (start == null) {
            start = this.getCurrentTime();
            if (start >= this.getDuration()) {
                start = 0;
            }
        }
        if (end == null) {
            end = this.getDuration();
        }

        this.startPosition = start;
        this.lastPlay = this.ac.currentTime;

        if (this.state === this.states[this.FINISHED_STATE]) {
            this.setState(this.PAUSED_STATE);
        }

        return { start: start, end: end };
    },

    getPlayedTime: function () {
        return (this.ac.currentTime - this.lastPlay) * this.playbackRate;
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
        if (!this.buffer) { return; }

        // need to re-create source on each playback
        this.createSource();

        var adjustedTime = this.seekTo(start, end);

        start = adjustedTime.start;
        end = adjustedTime.end;

        this.scheduledPause = end;

        this.source.start(0, start, end - start);

        if (this.ac.state == 'suspended') {
          this.ac.resume && this.ac.resume();
        }

        this.setState(this.PLAYING_STATE);

        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause: function () {
        this.scheduledPause = null;

        this.startPosition += this.getPlayedTime();
        this.source && this.source.stop(0);

        this.setState(this.PAUSED_STATE);

        this.fireEvent('pause');
    },

    /**
    *   Returns the current time in seconds relative to the audioclip's duration.
    */
    getCurrentTime: function () {
        return this.state.getCurrentTime.call(this);
    },

    /**
    *   Returns the current playback rate.
    */
    getPlaybackRate: function () {
        return this.playbackRate;
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        value = value || 1;
        if (this.isPaused()) {
            this.playbackRate = value;
        } else {
            this.pause();
            this.playbackRate = value;
            this.play();
        }
    }
};

WaveSurfer.WebAudio.state = {};

WaveSurfer.WebAudio.state.playing = {
    init: function () {
        this.addOnAudioProcess();
    },
    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },
    getCurrentTime: function () {
        return this.startPosition + this.getPlayedTime();
    }
};

WaveSurfer.WebAudio.state.paused = {
    init: function () {
        this.removeOnAudioProcess();
    },
    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },
    getCurrentTime: function () {
        return this.startPosition;
    }
};

WaveSurfer.WebAudio.state.finished = {
    init: function () {
        this.removeOnAudioProcess();
        this.fireEvent('finish');
    },
    getPlayedPercents: function () {
        return 1;
    },
    getCurrentTime: function () {
        return this.getDuration();
    }
};

WaveSurfer.util.extend(WaveSurfer.WebAudio, WaveSurfer.Observer);
