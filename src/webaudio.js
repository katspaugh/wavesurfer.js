import * as util from './util';

// using consts to prevent someone writing the string wrong
const PLAYING = 'playing';
const PAUSED = 'paused';
const FINISHED = 'finished';

export default class WebAudio extends util.Observer {
    static scriptBufferSize = 256

    stateBehaviors = {
        [PLAYING]: {
            init() {
                this.addOnAudioProcess();
            },
            getPlayedPercents() {
                const duration = this.getDuration();
                return (this.getCurrentTime() / duration) || 0;
            },
            getCurrentTime() {
                return this.startPosition + this.getPlayedTime();
            }
        },
        [PAUSED]: {
            init() {
                this.removeOnAudioProcess();
            },
            getPlayedPercents() {
                const duration = this.getDuration();
                return (this.getCurrentTime() / duration) || 0;
            },
            getCurrentTime() {
                return this.startPosition;
            }
        },
        [FINISHED]: {
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
        }
    }

    supportsWebAudio() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (
                window.AudioContext || window.webkitAudioContext
            );
        }
        return this.audioContext;
    }

    getOfflineAudioContext(sampleRate) {
        if (!this.offlineAudioContext) {
            this.offlineAudioContext = new (
                window.OfflineAudioContext || window.webkitOfflineAudioContext
            )(1, 2, sampleRate);
        }
        return this.offlineAudioContext;
    }

    constructor(params) {
        super();
        this.params = params;
        this.ac = params.audioContext || this.getAudioContext();

        this.lastPlay = this.ac.currentTime;
        this.startPosition = 0;
        this.scheduledPause = null;

        this.states = {
            [PLAYING]: Object.create(this.stateBehaviors[PLAYING]),
            [PAUSED]: Object.create(this.stateBehaviors[PAUSED]),
            [FINISHED]: Object.create(this.stateBehaviors[FINISHED])
        };
    }

    init() {
        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();

        this.setState(PAUSED);
        this.setPlaybackRate(this.params.audioRate);
        this.setLength(0);
    }

    disconnectFilters() {
        if (this.filters) {
            this.filters.forEach(filter => {
                filter && filter.disconnect();
            });
            this.filters = null;
            // Reconnect direct path
            this.analyser.connect(this.gainNode);
        }
    }

    setState(state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    }

    // Unpacked filters
    setFilter(...filters) {
        this.setFilters(filters);
    }

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
            filters.reduce((prev, curr) => {
                prev.connect(curr);
                return curr;
            }, this.analyser).connect(this.gainNode);
        }

    }

    createScriptNode() {
        if (this.ac.createScriptProcessor) {
            this.scriptNode = this.ac.createScriptProcessor(this.scriptBufferSize);
        } else {
            this.scriptNode = this.ac.createJavaScriptNode(this.scriptBufferSize);
        }

        this.scriptNode.connect(this.ac.destination);
    }

    addOnAudioProcess() {
        this.scriptNode.onaudioprocess = () => {
            const time = this.getCurrentTime();

            if (time >= this.getDuration()) {
                this.setState(FINISHED);
                this.fireEvent('pause');
            } else if (time >= this.scheduledPause) {
                this.pause();
            } else if (this.state === this.states[PLAYING]) {
                this.fireEvent('audioprocess', time);
            }
        };
    }

    removeOnAudioProcess() {
        this.scriptNode.onaudioprocess = null;
    }

    createAnalyserNode() {
        this.analyser = this.ac.createAnalyser();
        this.analyser.connect(this.gainNode);
    }

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
    }

    /**
     * Set the gain to a new value.
     *
     * @param {Number} newGain The new gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    setVolume(newGain) {
        this.gainNode.gain.value = newGain;
    }

    /**
     * Get the current gain.
     *
     * @returns {Number} The current gain, a floating point value
     * between 0 and 1. 0 being no gain and 1 being maximum gain.
     */
    getVolume() {
        return this.gainNode.gain.value;
    }

    decodeArrayBuffer(arraybuffer, callback, errback) {
        if (!this.offlineAc) {
            this.offlineAc = this.getOfflineAudioContext(this.ac ? this.ac.sampleRate : 44100);
        }
        this.offlineAc.decodeAudioData(arraybuffer, data => callback(data), errback);
    }

    /**
     * Set pre-decoded peaks.
     */
    setPeaks(peaks) {
        this.peaks = peaks;
    }

    /**
     * Set the rendered length (different from the length of the audio).
     */
    setLength(length) {
        // No resize, we can preserve the cached peaks.
        if (this.mergedPeaks && length == ((2 * this.mergedPeaks.length - 1) + 2)) {
            return;
        }

        this.splitPeaks = [];
        this.mergedPeaks = [];
        // Set the last element of the sparse array so the peak arrays are
        // appropriately sized for other calculations.
        const channels = this.buffer ? this.buffer.numberOfChannels : 1;
        let c;
        for (c = 0; c < channels; c++) {
            this.splitPeaks[c] = [];
            this.splitPeaks[c][2 * (length - 1)] = 0;
            this.splitPeaks[c][2 * (length - 1) + 1] = 0;
        }
        this.mergedPeaks[2 * (length - 1)] = 0;
        this.mergedPeaks[2 * (length - 1) + 1] = 0;
    }

    /**
     * Compute the max and min value of the waveform when broken into
     * <length> subranges.
     * @param {Number} length How many subranges to break the waveform into.
     * @param {Number} first First sample in the required range.
     * @param {Number} last Last sample in the required range.
     * @returns {Array} Array of 2*<length> peaks or array of arrays
     * of peaks consisting of (max, min) values for each subrange.
     */
    getPeaks(length, first, last) {
        if (this.peaks) { return this.peaks; }

        this.setLength(length);

        const sampleSize = this.buffer.length / length;
        const sampleStep = ~~(sampleSize / 10) || 1;
        const channels = this.buffer.numberOfChannels;
        let c;

        for (c = 0; c < channels; c++) {
            const peaks = this.splitPeaks[c];
            const chan = this.buffer.getChannelData(c);
            let i;

            for (i = first; i <= last; i++) {
                const start = ~~(i * sampleSize);
                const end = ~~(start + sampleSize);
                let min = 0;
                let max = 0;
                let j;

                for (j = start; j < end; j += sampleStep) {
                    const value = chan[j];

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
    }

    getPlayedPercents() {
        return this.state.getPlayedPercents.call(this);
    }

    disconnectSource() {
        if (this.source) {
            this.source.disconnect();
        }
    }

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
    }

    load(buffer) {
        this.startPosition = 0;
        this.lastPlay = this.ac.currentTime;
        this.buffer = buffer;
        this.createSource();
    }

    createSource() {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();

        //adjust for old browsers.
        this.source.start = this.source.start || this.source.noteGrainOn;
        this.source.stop = this.source.stop || this.source.noteOff;

        this.source.playbackRate.value = this.playbackRate;
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
    }

    isPaused() {
        return this.state !== this.states[PLAYING];
    }

    getDuration() {
        if (!this.buffer) {
            return 0;
        }
        return this.buffer.duration;
    }

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

        if (this.state === this.states[FINISHED]) {
            this.setState(PAUSED);
        }

        return {
            start: start,
            end: end
        };
    }

    getPlayedTime() {
        return (this.ac.currentTime - this.lastPlay) * this.playbackRate;
    }

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

        const adjustedTime = this.seekTo(start, end);

        start = adjustedTime.start;
        end = adjustedTime.end;

        this.scheduledPause = end;

        this.source.start(0, start, end - start);

        if (this.ac.state == 'suspended') {
            this.ac.resume && this.ac.resume();
        }

        this.setState(PLAYING);

        this.fireEvent('play');
    }

    /**
     * Pauses the loaded audio.
     */
    pause() {
        this.scheduledPause = null;

        this.startPosition += this.getPlayedTime();
        this.source && this.source.stop(0);

        this.setState(PAUSED);

        this.fireEvent('pause');
    }

    /**
    *   Returns the current time in seconds relative to the audioclip's duration.
    */
    getCurrentTime() {
        return this.state.getCurrentTime.call(this);
    }

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
}
