WaveSurfer.Backend = {
    postInit: function () {},
    load: function () {},

    /**
     * Get current position in seconds.
     */
    getCurrentTime: function () {
        return 0;
    },

    /**
     * @returns {Boolean}
     */
    isPaused: function () {
        return true;
    },

    /**
     * Get duration in seconds.
     */
    getDuration: function () {
        return 0;
    },

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end When to stop
     * relative to the beginning of a clip.
     */
    play: function (start, end) {},

    /**
     * Pauses the loaded audio.
     */
    pause: function () {},

    getPlayedPercents: function () {
        var duration = this.getDuration();
        return (this.getCurrentTime() / duration) || 0;
    },

    setVolume: function (volume) {
    },

    getVolume: function (volume) {
    },

    updateSelection: function (startPercent, endPercent) {
        var duration = this.getDuration();
        this.loop = true;
        this.loopStart = duration * startPercent;
        this.loopEnd = duration * endPercent;
    },

    clearSelection: function (startPercent, endPercent) {
        this.loop = false;
        this.loopStart = 0;
        this.loopEnd = 0;
    },

    disconnectSource: function () {
    },

    getPeaks: function (length) {
    },

    loadMedia: function(url) {
    },

    destroy: function(url) {
    }
};
