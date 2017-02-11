import Webaudio from './webaudio';
import * as util from './util';

export default class MediaElement extends Webaudio {
    constructor(params) {
        super(params);
        this.params = params;

        // Dummy media to catch errors
        this.media = {
            currentTime: 0,
            duration: 0,
            paused: true,
            playbackRate: 1,
            play() {},
            pause() {}
        };

        this.mediaType = params.mediaType.toLowerCase();
        this.elementPosition = params.elementPosition;
    }

    init() {
        this.setPlaybackRate(this.params.audioRate);
        this.createTimer();
    }

    /**
     * Create a timer to provide a more precise `audioprocess' event.
     */
    createTimer() {
        const onAudioProcess = () => {
            if (this.isPaused()) { return; }
            this.fireEvent('audioprocess', this.getCurrentTime());

            // Call again in the next frame
            const requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
            requestAnimationFrame(onAudioProcess);
        };

        this.on('play', onAudioProcess);
    }

    /**
     *  Create media element with url as its source,
     *  and append to container element.
     *  @param  {String}        url         path to media file
     *  @param  {HTMLElement}   container   HTML element
     *  @param  {Array}         peaks       array of peak data
     *  @param  {String}        preload     HTML 5 preload attribute value
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
     *  @param  {MediaElement}  elt     HTML5 Audio or Video element
     *  @param  {Array}         peaks   array of peak data
     */
    loadElt(elt, peaks) {
        elt.controls = this.params.mediaControls;
        elt.autoplay = this.params.autoplay || false;

        this._load(elt, peaks);
    }

    /**
     *  Private method called by both load (from url)
     *  and loadElt (existing media element).
     *  @param  {MediaElement}  media     HTML5 Audio or Video element
     *  @param  {Array}         peaks   array of peak data
     *  @private
     */
    _load(media, peaks) {
        // load must be called manually on iOS, otherwise peaks won't draw
        // until a user interaction triggers load --> 'ready' event
        media.load();

        media.addEventListener('error', () => {
            this.fireEvent('error', 'Error loading media element');
        });

        media.addEventListener('canplay', () => {
            this.fireEvent('canplay');
        });

        media.addEventListener('ended', () => {
            this.fireEvent('finish');
        });

        this.media = media;
        this.peaks = peaks;
        this.onPlayEnd = null;
        this.buffer = null;
        this.setPlaybackRate(this.playbackRate);
    }

    isPaused() {
        return !this.media || this.media.paused;
    }

    getDuration() {
        let duration = this.media.duration;
        if (duration >= Infinity) { // streaming audio
            duration = this.media.seekable.end(0);
        }
        return duration;
    }

    getCurrentTime() {
        return this.media && this.media.currentTime;
    }

    getPlayedPercents() {
        return (this.getCurrentTime() / this.getDuration()) || 0;
    }

    /**
     * Set the audio source playback rate.
     */
    setPlaybackRate(value) {
        this.playbackRate = value || 1;
        this.media.playbackRate = this.playbackRate;
    }

    seekTo(start) {
        if (start != null) {
            this.media.currentTime = start;
        }
        this.clearPlayEnd();
    }

    /**
     * Plays the loaded audio region.
     *
     * @param {Number} start Start offset in seconds,
     * relative to the beginning of a clip.
     * @param {Number} end End offset in seconds,
     * relative to the beginning of a clip.
     */
    play(start, end) {
        this.seekTo(start);
        this.media.play();
        end && this.setPlayEnd(end);
        this.fireEvent('play');
    }

    /**
     * Pauses the loaded audio.
     */
    pause() {
        this.media && this.media.pause();
        this.clearPlayEnd();
        this.fireEvent('pause');
    }

    setPlayEnd(end) {
        this._onPlayEnd = time => {
            if (time >= end) {
                this.pause();
                this.seekTo(end);
            }
        };
        this.on('audioprocess', this._onPlayEnd);
    }

    clearPlayEnd() {
        if (this._onPlayEnd) {
            this.un('audioprocess', this._onPlayEnd);
            this._onPlayEnd = null;
        }
    }

    getPeaks(length, start, end) {
        if (this.buffer) {
            return super.getPeaks(length, start, end);
        }
        return this.peaks || [];
    }

    getVolume() {
        return this.media.volume;
    }

    setVolume(val) {
        this.media.volume = val;
    }

    destroy() {
        this.pause();
        this.unAll();
        this.media && this.media.parentNode && this.media.parentNode.removeChild(this.media);
        this.media = null;
    }
}
