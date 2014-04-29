'use strict';

WaveSurfer.WebAudio.Buffer = {
    postInit: function () {
        this.lastStartPosition = 0;
        this.lastPlay = this.lastPause = this.nextPause = this.ac.currentTime;
    },

    load: function (buffer) {
        this.lastStartPosition = 0;
        this.lastPlay = this.lastPlay = this.nextPause = this.ac.currentTime;
        this.buffer = buffer;
        this.createSource();
    },

    createSource: function () {
        this.disconnectSource();
        this.source = this.ac.createBufferSource();
        this.source.playbackRate.value = this.playbackRate;
        this.source.buffer = this.buffer;
        this.source.connect(this.analyser);
    },

    isPaused: function () {
        return this.nextPause <= this.ac.currentTime;
    },

    getDuration: function () {
        return this.buffer.duration;
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
        // need to re-create source on each playback
        this.createSource();

        if (start == null) {
            start = this.getCurrentTime();
        }
        if (end == null) {
            if (this.scheduledPause != null) {
                end = this.scheduledPause;
            } else {
                end = this.getDuration();
            }
        }

        this.lastPlay = this.ac.currentTime;
        this.lastStartPosition = start;
        this.lastPause = this.nextPause = this.ac.currentTime + (end - start);
        this.prevFrameTime = -1; // break free from a loop

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
        this.scheduledPause = null;
        this.lastPause = this.nextPause = this.ac.currentTime;

        if (this.source.stop) {
            this.source.stop(0);
        } else {
            this.source.noteOff(0);
        }

        this.fireEvent('pause');
    },

    getCurrentTime: function () {
        if (this.isPaused()) {
            return this.lastStartPosition + (this.lastPause - this.lastPlay) * this.playbackRate;
        } else {
            return this.lastStartPosition + (this.ac.currentTime - this.lastPlay) * this.playbackRate;
        }
    },

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate: function (value) {
        this.playbackRate = value || 1;
        this.source.playbackRate.value = this.playbackRate;
    }
};
