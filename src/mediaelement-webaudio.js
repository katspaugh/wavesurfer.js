import MediaElement from './mediaelement';

/**
 * MediaElementWebAudio backend: allows to load audio as HTML5 audio tag and use it with WebAudio API.
 * Setting the MediaElementWebAudio backend, there is the possibility to load audio of big dimensions, using the WebAudio API features.
 * The audio to load is an HTML5 audio tag, so you have to use the same methods of MediaElement backend for loading and playback.
 * In this way, the audio resource is not loaded entirely from server, but in ranges, since you load an HTML5 audio tag.
 * In this way, filters and other functionalities can be performed like with WebAudio backend, but without decoding
 * internally audio data, that caused crashing of the browser. You have to give also peaks, so the audio data are not decoded.
 *
 * @since 3.2.0
 */
export default class MediaElementWebAudio extends MediaElement {
    /**
     * Construct the backend
     *
     * @param {WavesurferParams} params Wavesurfer parameters
     */
    constructor(params) {
        super(params);
        /** @private */
        this.params = params;
        /** @private */
        this.sourceMediaElement = null;
    }

    /**
     * Initialise the backend, called in `wavesurfer.createBackend()`
     */
    init() {
        this.setPlaybackRate(this.params.audioRate);
        this.createTimer();
        this.createVolumeNode();
        this.createScriptNode();
        this.createAnalyserNode();
    }
    /**
     * Private method called by both `load` (from url)
     * and `loadElt` (existing media element) methods.
     *
     * @param {HTMLMediaElement} media HTML5 Audio or Video element
     * @param {number[]|Number.<Array[]>} peaks Array of peak data
     * @private
     */
    _load(media, peaks) {
        super._load(media, peaks);
        this.createMediaElementSource(media);
    }

    /**
     * Create MediaElementSource node
     *
     * @since 3.2.0
     * @param {HTMLMediaElement} mediaElement HTML5 Audio to load
     */
    createMediaElementSource(mediaElement) {
        this.sourceMediaElement = this.ac.createMediaElementSource(
            mediaElement
        );
        this.sourceMediaElement.connect(this.analyser);
    }
}
