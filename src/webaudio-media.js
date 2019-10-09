import MediaElement from './mediaelement';

/**
 * WebAudioMedia backend
 * @since Version 3.1.0
 */
export default class WebAudioMedia extends MediaElement {
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
     * @since Version 3.1.0
     * @param {HTMLMediaElement} mediaElement HTML5 Audio to load
     */
    createMediaElementSource(mediaElement) {
        this.sourceMediaElement = this.ac.createMediaElementSource(
            mediaElement
        );
        this.sourceMediaElement.connect(this.analyser);
    }
}
