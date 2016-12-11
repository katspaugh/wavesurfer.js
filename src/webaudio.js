import * as util from './util';

const WebAudio = util.extend({}, util.observer, {
    scriptBufferSize: 256,
    PLAYING_STATE: 0,
    PAUSED_STATE: 1,
    FINISHED_STATE: 2,

    supportsWebAudio() {
        return !!(window.AudioContext || window.webkitAudioContext);
    },

    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            );
        }
        return this.audioContext;
    },

    getOfflineAudioContext(sampleRate) {
        if (!this.offlineAudioContext) {
            this.offlineAudioContext = new (
                window.OfflineAudioContext || window.webkitOfflineAudioContext
            )(1, 2, sampleRate);
        }
        return this.offlineAudioContext;
    },

    init(params) {
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();

        this.lastPlay = this.ac.currentTime;
        this.startPosition = 0;
        this.scheduledPause = null;

        this.states = [
            Object.create(WebAudio.state.playing),
            Object.create(WebAudio.state.paused),
            Object.create(WebAudio.state.finished)
        ];

        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();

        this.setState(this.PAUSED_STATE);
        this.setPlaybackRate(this.params.audioRate);
    },

    disconnectFilters() {
        if (this.filters) {
            this.filters.forEach(function (filter) {
                filter && filter.disconnect();
            });
            this.filters = null;
            // Reconnect direct path
            this.analyser.connect(this.gainNode);
        }
    },

    setState(state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    },

    // Unpacked filters
    setFilter() {
        this.setFilters([].slice.call(arguments));
    },

    /**
     * @param {Array} filters Packed ilters array
     */
    setFilters(filters) {
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

    createScriptNode() {
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(this.scriptBufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(this.scriptBufferSize);
        }

        this.scriptNode.connect(this.ac.destination);
    },

    addOnAudioProcess() {
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

    removeOnAudioProcess() {
        this.scriptNode.onaudioprocess = null;
    },

    createAnalyserNode() {
        this.analyser = this.ac.createAnalyser();
        this.analyser.connect(this.gainNode);
    },

    /**
     * Create the gain node needed to control the playback volume.
     */
    createVolumeNode() {
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
    setVolume(newGain) {
        this.gainNode.gain.value = newGain;
    },

    /**
     * Get the current gain.
     *
     * @returns {Number} The current gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    getVolume() {
        return this.gainNode.gain.value;
    },

    decodeArrayBuffer(arraybuffer, callback, errback) {
        if (!this.offlineAc) {
            this.offlineAc = this.getOfflineAudioContext(this.ac ? this.ac.sampleRate : 44100);
        }
        this.offlineAc.decodeAudioData(arraybuffer, data => callback(data), errback);
    },

    /**
     * Set pre-decoded peaks.
     */
    setPeaks(peaks) {
        this.peaks = peaks;
    },

    /**
     * Compute the max and min value of the waveform when broken into
     * <length> subranges.
     * @param {Number} How many subranges to break the waveform into.
     * @returns {Array} Array of 2*<length> peaks or array of arrays
     * of peaks consisting of (max, min) values for each subrange.
     */
    getPeaks(length) {
        if (this.peaks) { return this.peaks; }

        var sampleSize = this.buffer.length / length;
        var sampleStep = ~~(sampleSize / 10) || 1;
        var channels = this.buffer.numberOfChannels;
        var splitPeaks = [];
        var mergedPeaks = [];

        for (var c = 0; c < channels; c++) {
            var peaks = splitPeaks[c] = [];
            var chan = this.buffer.getChannelData(c);

            for (var i = 0; i < length; i++) {
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

                if (c == 0 || max > mergedPeaks[2 * i]) {
                    mergedPeaks[2 * i] = max;
                }

                if (c == 0 || min < mergedPeaks[2 * i + 1]) {
                    mergedPeaks[2 * i + 1] = min;
                }
            }
        }

        return this.params.splitChannels ? splitPeaks : mergedPeaks;
    },

    getPlayedPercents() {
        return this.state.getPlayedPercents.call(this);
    },

    disconnectSource() {
        if (this.source) {
            this.source.disconnect();
        }
    },

    destroy() {
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
    },

    load(buffer) {
        this.startPosition = 0;
        this.lastPlay = this.ac.currentTime;
        this.buffer = buffer;
        this.createSource();
    },

    createSource() {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();

        //adjust for old browsers.
        this.source.start = this.source.start || this.source.noteGrainOn;
        this.source.stop = this.source.stop || this.source.noteOff;

        this.source.playbackRate.value = this.playbackRate;
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
    },

    isPaused() {
        return this.state !== this.states[this.PLAYING_STATE];
    },

    getDuration() {
        if (!this.buffer) {
            return 0;
        }
        return this.buffer.duration;
    },

    seekTo(start, end) {
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

        return {
            start: start,
            end: end
        };
    },

    getPlayedTime() {
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
    play(start, end) {
        if (!this.buffer) { return; }

        // need to re-create source on each playback
        this.createSource();

        var adjustedTime = this.seekTo(start, end);

        start = adjustedTime.start;
        end = adjustedTime.end;

        this.scheduledPause = end;

        this.source.start(0, start, end - start);
        this.ac.resume();

        this.setState(this.PLAYING_STATE);

        this.fireEvent('play');
    },

    /**
     * Pauses the loaded audio.
     */
    pause() {
        this.scheduledPause = null;

        this.startPosition += this.getPlayedTime();
        this.source && this.source.stop(0);

        this.setState(this.PAUSED_STATE);

        this.fireEvent('pause');
    },

    /**
    *   Returns the current time in seconds relative to the audioclip's duration.
    */
    getCurrentTime() {
        return this.state.getCurrentTime.call(this);
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate(value) {
        value = value || 1;
        if (this.isPaused()) {
            this.playbackRate = value;
        } else {
            this.pause();
            this.playbackRate = value;
            this.play();
        }
    }
});

WebAudio.state = {};

WebAudio.state.playing = {
    init() {
        this.addOnAudioProcess();
    },
    getPlayedPercents() {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },
    getCurrentTime() {
        return this.startPosition + this.getPlayedTime();
    }
};

WebAudio.state.paused = {
    init() {
        this.removeOnAudioProcess();
    },
    getPlayedPercents() {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },
    getCurrentTime() {
        return this.startPosition;
    }
};

WebAudio.state.finished = {
    init() {
        this.removeOnAudioProcess();
        this.fireEvent('finish');
    },
    getPlayedPercents() {
        return 1;
    },
    getCurrentTime() {
        return this.getDuration();
    }
};

export default WebAudio;
