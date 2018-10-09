import * as util from './util';

// using constants to prevent someone writing the string wrong
const PLAYING = 'playing';
const PAUSED = 'paused';
const FINISHED = 'finished';

/**
 * WebAudio backend
 *
 * @extends {Observer}
 */
export default class WebAudio extends util.Observer {
    /** @private */
    static scriptBufferSize = 256;
    /** @private */
    audioContext = null;
    /** @private */
    offlineAudioContext = null;
    /** @private */
    stateBehaviors = {
        [PLAYING]: {
            init() {
                this.addOnAudioProcess();
            },
            getPlayedPercents() {
                const duration = this.getDuration();
                return this.getCurrentTime() / duration || 0;
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
                return this.getCurrentTime() / duration || 0;
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
    };

    /**
     * Does the browser support this backend
     *
     * @return {boolean}
     */
    supportsWebAudio() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }

    /**
     * Get the audio context used by this backend or create one
     *
     * @return {AudioContext}
     */
    getAudioContext() {
        if (!window.WaveSurferAudioContext) {
            window.WaveSurferAudioContext = new (window.AudioContext ||
                window.webkitAudioContext)();
        }
        return window.WaveSurferAudioContext;
    }

    /**
     * Get the offline audio context used by this backend or create one
     *
     * @param {number} sampleRate
     * @return {OfflineAudioContext}
     */
    getOfflineAudioContext(sampleRate) {
        if (!window.WaveSurferOfflineAudioContext) {
            window.WaveSurferOfflineAudioContext = new (window.OfflineAudioContext ||
                window.webkitOfflineAudioContext)(1, 2, sampleRate);
        }
        return window.WaveSurferOfflineAudioContext;
    }

    /**
     * Construct the backend
     *
     * @param {WavesurferParams} params
     */
    constructor(params) {
        super();
        /** @private */
        this.params = params;
        /** @private */
        this.ac = params.audioContext || this.getAudioContext();
        /**@private */
        this.lastPlay = this.ac.currentTime;
        /** @private */
        this.startPosition = 0;
        /** @private  */
        this.scheduledPause = null;
        /** @private */
        this.states = {
            [PLAYING]: Object.create(this.stateBehaviors[PLAYING]),
            [PAUSED]: Object.create(this.stateBehaviors[PAUSED]),
            [FINISHED]: Object.create(this.stateBehaviors[FINISHED])
        };
        /** @private */
        this.analyser = null;
        /** @private */
        this.buffer = null;
        /** @private */
        this.filters = [];
        /** @private */
        this.gainNode = null;
        /** @private */
        this.mergedPeaks = null;
        /** @private */
        this.offlineAc = null;
        /** @private */
        this.peaks = null;
        /** @private */
        this.playbackRate = 1;
        /** @private */
        this.analyser = null;
        /** @private */
        this.scriptNode = null;
        /** @private */
        this.source = null;
        /** @private */
        this.splitPeaks = [];
        /** @private */
        this.state = null;
        /** @private */
        this.explicitDuration = null;
    }

    /**
     * Initialise the backend, called in `wavesurfer.createBackend()`
     */
    init() {
        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();

        this.setState(PAUSED);
        this.setPlaybackRate(this.params.audioRate);
        this.setLength(0);
    }

    /** @private */
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

    /** @private */
    setState(state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    }

    /**
     * Unpacked `setFilters()`
     *
     * @param {...AudioNode} filters
     */
    setFilter(...filters) {
        this.setFilters(filters);
    }

    /**
     * Insert custom Web Audio nodes into the graph
     *
     * @param {AudioNode[]} filters Packed filters array
     * @example
     * const lowpass = wavesurfer.backend.ac.createBiquadFilter();
     * wavesurfer.backend.setFilter(lowpass);
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
            filters
                .reduce((prev, curr) => {
                    prev.connect(curr);
                    return curr;
                }, this.analyser)
                .connect(this.gainNode);
        }
    }

    /** @private */
    createScriptNode() {
        if (this.params.audioScriptProcessor) {
            this.scriptNode = this.params.audioScriptProcessor;
        } else {
            if (this.ac.createScriptProcessor) {
                this.scriptNode = this.ac.createScriptProcessor(
                    WebAudio.scriptBufferSize
                );
            } else {
                this.scriptNode = this.ac.createJavaScriptNode(
                    WebAudio.scriptBufferSize
                );
            }
        }
        this.scriptNode.connect(this.ac.destination);
    }

    /** @private */
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

    /** @private */
    removeOnAudioProcess() {
        this.scriptNode.onaudioprocess = null;
    }

    /** @private */
    createAnalyserNode() {
        this.analyser = this.ac.createAnalyser();
        this.analyser.connect(this.gainNode);
    }

    /**
     * Create the gain node needed to control the playback volume.
     *
     * @private
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
     * Set the sink id for the media player
     *
     * @param {string} deviceId String value representing audio device id.
     */
    setSinkId(deviceId) {
        if (deviceId) {
            /**
             * The webaudio API doesn't currently support setting the device
             * output. Here we create an HTMLAudioElement, connect the
             * webaudio stream to that element and setSinkId there.
             */
            let audio = new window.Audio();
            if (!audio.setSinkId) {
                return Promise.reject(
                    new Error('setSinkId is not supported in your browser')
                );
            }
            audio.autoplay = true;
            var dest = this.ac.createMediaStreamDestination();
            this.gainNode.disconnect();
            this.gainNode.connect(dest);
            audio.srcObject = dest.stream;

            return audio.setSinkId(deviceId);
        } else {
            return Promise.reject(new Error('Invalid deviceId: ' + deviceId));
        }
    }

    /**
     * Set the audio volume
     *
     * @param {number} value A floating point value between 0 and 1.
     */
    setVolume(value) {
        this.gainNode.gain.setValueAtTime(value, this.ac.currentTime);
    }

    /**
     * Get the current volume
     *
     * @return {number} value A floating point value between 0 and 1.
     */
    getVolume() {
        return this.gainNode.gain.value;
    }

    /** @private */
    decodeArrayBuffer(arraybuffer, callback, errback) {
        if (!this.offlineAc) {
            this.offlineAc = this.getOfflineAudioContext(
                this.ac && this.ac.sampleRate ? this.ac.sampleRate : 44100
            );
        }
        this.offlineAc.decodeAudioData(
            arraybuffer,
            data => callback(data),
            errback
        );
    }

    /**
     * Set pre-decoded peaks
     *
     * @param {number[]|number[][]} peaks
     * @param {?number} duration
     */
    setPeaks(peaks, duration) {
        this.explicitDuration = duration;
        this.peaks = peaks;
    }

    /**
     * Set the rendered length (different from the length of the audio).
     *
     * @param {number} length
     */
    setLength(length) {
        // No resize, we can preserve the cached peaks.
        if (this.mergedPeaks && length == 2 * this.mergedPeaks.length - 1 + 2) {
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
     * Compute the max and min value of the waveform when broken into <length> subranges.
     *
     * @param {number} length How many subranges to break the waveform into.
     * @param {number} first First sample in the required range.
     * @param {number} last Last sample in the required range.
     * @return {number[]|number[][]} Array of 2*<length> peaks or array of arrays of
     * peaks consisting of (max, min) values for each subrange.
     */
    getPeaks(length, first, last) {
        if (this.peaks) {
            return this.peaks;
        }

        first = first || 0;
        last = last || length - 1;

        this.setLength(length);

        /**
         * The following snippet fixes a buffering data issue on the Safari
         * browser which returned undefined It creates the missing buffer based
         * on 1 channel, 4096 samples and the sampleRate from the current
         * webaudio context 4096 samples seemed to be the best fit for rendering
         * will review this code once a stable version of Safari TP is out
         */
        if (!this.buffer.length) {
            const newBuffer = this.createBuffer(1, 4096, this.sampleRate);
            this.buffer = newBuffer.buffer;
        }

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

    /**
     * Get the position from 0 to 1
     *
     * @return {number}
     */
    getPlayedPercents() {
        return this.state.getPlayedPercents.call(this);
    }

    /** @private */
    disconnectSource() {
        if (this.source) {
            this.source.disconnect();
        }
    }

    /**
     * This is called when wavesurfer is destroyed
     */
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

        // close the audioContext if closeAudioContext option is set to true
        if (this.params.closeAudioContext) {
            // check if browser supports AudioContext.close()
            if (
                typeof this.ac.close === 'function' &&
                this.ac.state != 'closed'
            ) {
                this.ac.close();
            }
            // clear the reference to the audiocontext
            this.ac = null;
            // clear the actual audiocontext, either passed as param or the
            // global singleton
            if (!this.params.audioContext) {
                window.WaveSurferAudioContext = null;
            } else {
                this.params.audioContext = null;
            }
            // clear the offlineAudioContext
            window.WaveSurferOfflineAudioContext = null;
        }
    }

    /**
     * Loaded a decoded audio buffer
     *
     * @param {Object} buffer
     */
    load(buffer) {
        this.startPosition = 0;
        this.lastPlay = this.ac.currentTime;
        this.buffer = buffer;
        this.createSource();
    }

    /** @private */
    createSource() {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();

        // adjust for old browsers
        this.source.start = this.source.start || this.source.noteGrainOn;
        this.source.stop = this.source.stop || this.source.noteOff;

        this.source.playbackRate.setValueAtTime(
            this.playbackRate,
            this.ac.currentTime
        );
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
    }

    /**
     * Used by `wavesurfer.isPlaying()` and `wavesurfer.playPause()`
     *
     * @return {boolean}
     */
    isPaused() {
        return this.state !== this.states[PLAYING];
    }

    /**
     * Used by `wavesurfer.getDuration()`
     *
     * @return {number}
     */
    getDuration() {
        if (!this.buffer) {
            if (this.explicitDuration) {
                return this.explicitDuration;
            }
            return 0;
        }
        return this.buffer.duration;
    }

    /**
     * Used by `wavesurfer.seekTo()`
     *
     * @param {number} start Position to start at in seconds
     * @param {number} end Position to end at in seconds
     * @return {{start: number, end: number}}
     */
    seekTo(start, end) {
        if (!this.buffer) {
            return;
        }

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

    /**
     * Get the playback position in seconds
     *
     * @return {number}
     */
    getPlayedTime() {
        return (this.ac.currentTime - this.lastPlay) * this.playbackRate;
    }

    /**
     * Plays the loaded audio region.
     *
     * @param {number} start Start offset in seconds, relative to the beginning
     * of a clip.
     * @param {number} end When to stop relative to the beginning of a clip.
     */
    play(start, end) {
        if (!this.buffer) {
            return;
        }

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
     * Returns the current time in seconds relative to the audio-clip's
     * duration.
     *
     * @return {number}
     */
    getCurrentTime() {
        return this.state.getCurrentTime.call(this);
    }

    /**
     * Returns the current playback rate. (0=no playback, 1=normal playback)
     *
     * @return {number}
     */
    getPlaybackRate() {
        return this.playbackRate;
    }

    /**
     * Set the audio source playback rate.
     *
     * @param {number} value
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
