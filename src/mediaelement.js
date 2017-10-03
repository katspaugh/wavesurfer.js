import WebAudio from './webaudio';
import * as util from './util';

/**
 * MediaElement backend
 */
export default class MediaElement extends WebAudio {
    /**
     * Construct the backend
     *
     * @param {WavesurferParams} params
     */
    constructor(params) {
        super(params);
        /** @private */
        this.params = params;

        // Dummy media to catch errors
        /** @private */
        this.media = {
            currentTime: 0,
            duration: 0,
            paused: true,
            playbackRate: 1,
            play() {},
            pause() {}
        };

        /** @private */
        this.mediaType = params.mediaType.toLowerCase();
        /** @private */
        this.elementPosition = params.elementPosition;
        /** @private */
        this.peaks = null;
        /** @private */
        this.playbackRate = 1;
        /** @private */
        this.buffer = null;
        /** @private */
        this.onPlayEnd = null;
    }

    /**
     * Initialise the backend, called in `wavesurfer.createBackend()`
     */
    init() {
        this.setPlaybackRate(this.params.audioRate);
        this.createTimer();
    }

    /**
     * Create a timer to provide a more precise `audioprocess` event.
     *
     * @private
     */
    createTimer() {
        const onAudioProcess = () => {
            if (this.isPaused()) {
                return;
            }
            this.fireEvent('audioprocess', this.getCurrentTime());

            // Call again in the next frame
            const requestAnimationFrame =
                window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame;
            requestAnimationFrame(onAudioProcess);
        };

        this.on('play', onAudioProcess);
    }

    /**
     *  Create media element with url as its source,
     *  and append to container element.
     *
     *  @param {string} url Path to media file
     *  @param {HTMLElement} container HTML element
     *  @param {Array} peaks Array of peak data
     *  @param {string} preload HTML 5 preload attribute value
     */
    load(url, container, peaks, preload) {
        const media = document.createElement(this.mediaType);
        media.controls = this.params.mediaControls;
        media.autoplay = this.params.autoplay || false;
        media.preload = preload == null ? 'auto' : preload;
        media.src = url;
        media.style.width = '100%';

        const prevMedia = container.querySelector(this.mediaType);
        if (prevMedia) {
            container.removeChild(prevMedia);
        }
        container.appendChild(media);

        this._load(media, peaks);
    }

    /**
     *  Load existing media element.
     *
     *  @param {MediaElement} elt HTML5 Audio or Video element
     *  @param {Array} peaks Array of peak data
     */
    loadElt(elt, peaks) {
        elt.controls = this.params.mediaControls;
        elt.autoplay = this.params.autoplay || false;

        this._load(elt, peaks);
    }

    /**
     *  Private method called by both load (from url)
     *  and loadElt (existing media element).
     *
     *  @param  {MediaElement}  media     HTML5 Audio or Video element
     *  @param  {Array}         peaks   array of peak data
     *  @private
     */
    _load(media, peaks) {
        // load must be called manually on iOS, otherwise peaks won't draw
        // until a user interaction triggers load --> 'ready' event
        if (typeof media.load == 'function') {
            media.load();
        }

        media.addEventListener('error', () => {
            this.fireEvent('error', 'Error loading media element');
        });

        media.addEventListener('canplay', () => {
            this.fireEvent('canplay');
        });

        media.addEventListener('ended', () => {
            this.fireEvent('finish');
        });

        // Listen to and relay play and pause events to enable
        // playback control from the external media element
        media.addEventListener('play', () => {
            this.fireEvent('play');
        });

        media.addEventListener('pause', () => {
            this.fireEvent('pause');
        });

        this.media = media;
        this.peaks = peaks;
        this.onPlayEnd = null;
        this.buffer = null;
        this.setPlaybackRate(this.playbackRate);
    }

    /**
     * Used by `wavesurfer.isPlaying()` and `wavesurfer.playPause()`
     *
     * @return {boolean}
     */
    isPaused() {
        return !this.media || this.media.paused;
    }

    /**
     * Used by `wavesurfer.getDuration()`
     *
     * @return {number}
     */
    getDuration() {
        let duration = (this.buffer || this.media).duration;
        if (duration >= Infinity) {
            // streaming audio
            duration = this.media.seekable.end(0);
        }
        return duration;
    }

    /**
    * Returns the current time in seconds relative to the audioclip's
    * duration.
    *
    * @return {number}
    */
    getCurrentTime() {
        return this.media && this.media.currentTime;
    }

    /**
     * Get the position from 0 to 1
     *
     * @return {number}
     */
    getPlayedPercents() {
        return this.getCurrentTime() / this.getDuration() || 0;
    }

    /**
     * Get the audio source playback rate.
     *
     * @return {number}
     */
    getPlaybackRate() {
        return this.playbackRate || this.media.playbackRate;
    }

    /**
     * Set the audio source playback rate.
     *
     * @param {number} value
     */
    setPlaybackRate(value) {
        this.playbackRate = value || 1;
        this.media.playbackRate = this.playbackRate;
    }

    /**
     * Used by `wavesurfer.seekTo()`
     *
     * @param {number} start Position to start at in seconds
     */
    seekTo(start) {
        if (start != null) {
            this.media.currentTime = start;
        }
        this.clearPlayEnd();
    }

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds, relative to the beginning
     * of a clip.
     * @param {Number} end When to stop relative to the beginning of a clip.
     * @emits MediaElement#play
     */
    play(start, end) {
        this.seekTo(start);
        this.media.play();
        end && this.setPlayEnd(end);
    }

    /**
     * Pauses the loaded audio.
     *
     * @emits MediaElement#pause
     */
    pause() {
        this.media && this.media.pause();
        this.clearPlayEnd();
    }

    /** @private */
    setPlayEnd(end) {
        this._onPlayEnd = time => {
            if (time >= end) {
                this.pause();
                this.seekTo(end);
            }
        };
        this.on('audioprocess', this._onPlayEnd);
    }

    /** @private */
    clearPlayEnd() {
        if (this._onPlayEnd) {
            this.un('audioprocess', this._onPlayEnd);
            this._onPlayEnd = null;
        }
    }

    /**
     * Compute the max and min value of the waveform when broken into
     * <length> subranges.
     *
     * @param {number} length How many subranges to break the waveform into.
     * @param {number} first First sample in the required range.
     * @param {number} last Last sample in the required range.
     * @return {number[]|number[][]} Array of 2*<length> peaks or array of
     * arrays of peaks consisting of (max, min) values for each subrange.
     */
    getPeaks(length, first, last) {
        if (this.buffer) {
            return super.getPeaks(length, first, last);
        }
        return this.peaks || [];
    }

    /**
     * Get the current volume
     *
     * @return {number} value A floating point value between 0 and 1.
     */
    getVolume() {
        return this.media.volume;
    }

    /**
     * Set the audio volume
     *
     * @param {number} value A floating point value between 0 and 1.
     */
    setVolume(value) {
        this.media.volume = value;
    }

    /**
     * This is called when wavesurfer is destroyed
     *
     */
    destroy() {
        this.pause();
        this.unAll();
        this.media &&
            this.media.parentNode &&
            this.media.parentNode.removeChild(this.media);
        this.media = null;
    }
}
