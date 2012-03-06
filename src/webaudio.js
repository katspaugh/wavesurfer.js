WaveSurfer.WebAudio = {
    ac: new (window.AudioContext || window.webkitAudioContext),

    /**
     * Initializes the analyser with given params.
     *
     * @param {Object} params
     * @param {String} params.smoothingTimeConstant
     */
    init: function (params) {
        params = params || {};

        this.destination = params.destination || this.ac.destination;

        this.analyser = this.ac.createAnalyser();
        this.analyser.smoothingTimeConstant =
            params.smoothingTimeConstant || 1;
        this.analyser.connect(this.destination);

        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.defineSource();

        this.paused = true;
    },

    /**
     * @private
     */
    defineSource: function () {
        var self = this, source;

        Object.defineProperty(this, 'source', {
            get: function () {
                return source;
            },
            set: function (value) {
                source && source.disconnect();
                source = value;
                source.connect(self.analyser);
            }
        });
    },

    /**
     * Loads data as an audiobuffer.
     *
     * @param {AudioBuffer} audioData Audio data.
     */
    loadData: function (audioData, cb) {
        var self = this;
        this.ac.decodeAudioData(
            audioData,

            /* success */
            function (buffer) {
                self.currentBuffer = buffer;
                self.lastPause = 0;
                self.lastPlay = 0;
                cb();
            },
            /* failure */
            function (e) {
                throw e;
            }
        );
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

        this.source = this.ac.createBufferSource();
        this.source.buffer = this.currentBuffer;

        start = start || this.lastPause;
        end = end || this.source.buffer.duration;
        delay = delay || 0;

        this.lastPlay = this.ac.currentTime;

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

        this.lastPause += (this.ac.currentTime - this.lastPlay);

        this.source.noteOff(delay || 0);

        this.paused = true;
    },

    /**
     * Returns the real-time waveform data.
     *
     * @return {Uint8Array} The waveform data.
     * Values range from 0 to 255.
     */
    waveform: function () {
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    },

    /**
     * Returns the real-time frequency data.
     *
     * @return {Uint8Array} The frequency data.
     * Values range from 0 to 255.
     */
    frequency: function () {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }
};