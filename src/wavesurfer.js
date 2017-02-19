import * as util from './util';
import MultiCanvas from './drawer.multicanvas';
import WebAudio from './webaudio';
import MediaElement from './mediaelement';
import PeakCache from './peakcache';

/** @external {HTMLElement} https://developer.mozilla.org/en/docs/Web/API/HTMLElement */
/** @external {OfflineAudioContext} https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext */
/** @external {File} https://developer.mozilla.org/en-US/docs/Web/API/File */
/** @external {Blob} https://developer.mozilla.org/en-US/docs/Web/API/Blob */
/** @external {CanvasRenderingContext2D} https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D */
/** @external {MediaStreamConstraints} https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints */
/** @external {AudioNode} https://developer.mozilla.org/de/docs/Web/API/AudioNode */

/**
 * @typedef {Object} WavesurferParams
 * @property {AudioContext} audioContext=null Use your own previously
 * initialized AudioContext or leave blank.
 * @property {number} audioRate=1 Speed at which to play audio. Lower number is
 * slower.
 * @property {boolean} autoCenter=true If a scrollbar is present, center the
 * waveform around the progress
 * @property {string} backend='WebAudio' `'WebAudio'|'MediaElement'` In most cases
 * you don't have to set this manually. MediaElement is a fallback for
 * unsupported browsers.
 * @property {!string|HTMLElement} container CSS selector or HTML element where
 * the waveform should be drawn. This is the only required parameter.
 * @property {string} cursorColor='#333' The fill color of the cursor indicating
 * the playhead position.
 * @property {number} cursorWidth=1 Measured in pixels.
 * @property {boolean} fillParent=true Whether to fill the entire container or
 * draw only according to `minPxPerSec`.
 * @property {number} height=128 The height of the waveform. Measured in
 * pixels.
 * @property {boolean} hideScrollbar=false Whether to hide the horizontal
 * scrollbar when one would normally be shown.
 * @property {boolean} interact=true Whether the mouse interaction will be
 * enabled at initialization. You can switch this parameter at any time later
 * on.
 * @property {boolean} loopSelection=true (Use with regions plugin) Enable
 * looping of selected regions
 * @property {number} maxCanvasWidth=4000 Maximum width of a single canvas in
 * pixels, excluding a small overlap (2 * `pixelRatio`, rounded up to the next
 * even integer). If the waveform is longer than this value, additional canvases
 * will be used to render the waveform, which is useful for very large waveforms
 * that may be too wide for browsers to draw on a single canvas.
 * @property {boolean} mediaControls=false (Use with backend `MediaElement`)
 * this enables the native controls for the media element
 * @property {string} mediaType='audio' (Use with backend `MediaElement`)
 * `'audio'|'video'`
 * @property {number} minPxPerSec=20 Minimum number of pixels per second of
 * audio.
 * @property {boolean} normalize=false If true, normalize by the maximum peak
 * instead of 1.0.
 * @property {boolean} partialRender=false Use the PeakCache to improve
 * rendering speed of large waveforms
 * @property {number} pixelRatio=window.devicePixelRatio The pixel ratio used to
 * calculate display
 * @property {PluginDefinition[]} plugins=[] An array of plugin definitions to
 * register during instantiation, they will be directly initialised unless they
 * are added with the `deferInit` property set to true.
 * @property {string} progressColor='#555' The fill color of the part of the
 * waveform behind the cursor.
 * @property {Object} renderer=MultiCanvas Can be used to inject a custom
 * renderer.
 * @property {boolean} scrollParent=false Whether to scroll the container with a
 * lengthy waveform. Otherwise the waveform is shrunk to the container width
 * (see fillParent).
 * @property {number} skipLength=2 Number of seconds to skip with the
 * skipForward() and skipBackward() methods.
 * @property {boolean} splitChannels=false Render with seperate waveforms for
 * the channels of the audio
 * @property {string} waveColor='#999' The fill color of the waveform after the
 * cursor.
 */

/**
 * @typedef {Object} PluginDefinition
 * @desc The Object used to describe a plugin
 * @example wavesurfer.addPlugin(pluginDefinition);
 * @property {string} name The name of the plugin, the plugin instance will be
 * added as a property to the wavesurfer instance under this name
 * @property {boolean} deferInit=params.deferInit||false Don't initialise plugin
 * automatically
 * @property {string} extends `'observer'|'drawer'` The name of the object to
 * inject into the plugin instance factory. Currently only the observer and
 * drawer objects are possible.
 * @property {PluginClass} instance The plugin instance factory, is called with
 * the dependency specified in extends. Returns the plugin class.
 */

/**
 * @typedef {function} PluginClass
 * @property {function} init The method to initialise the plugin
 * @property {function} destroy Destroy the plugin instance
 */

/**
 * WaveSurfer core library class
 *
 * @extends {Observer}
 * @example
 * const params = {
 *   container: '#waveform',
 *   waveColor: 'violet',
 *   progressColor: 'purple'
 * };
 *
 * // initialise like this
 * const wavesurfer = WaveSurfer.create(params);
 *
 * // or like this ...
 * const wavesurfer = new WaveSurfer(params);
 * wavesurfer.init();
 *
 * // load audio file
 * wavesurfer.load('example/media/demo.wav');
 */
export default class WaveSurfer extends util.Observer {
    /** @private */
    defaultParams = {
        audioContext  : null,
        audioRate     : 1,
        autoCenter    : true,
        backend       : 'WebAudio',
        container     : null,
        cursorColor   : '#333',
        cursorWidth   : 1,
        dragSelection : true,
        fillParent    : true,
        height        : 128,
        hideScrollbar : false,
        interact      : true,
        loopSelection : true,
        maxCanvasWidth: 4000,
        mediaContainer: null,
        mediaControls : false,
        mediaType     : 'audio',
        minPxPerSec   : 20,
        normalize     : false,
        partialRender : false,
        pixelRatio    : window.devicePixelRatio || screen.deviceXDPI / screen.logicalXDPI,
        plugins       : [],
        progressColor : '#555',
        renderer      : MultiCanvas,
        scrollParent  : false,
        skipLength    : 2,
        splitChannels : false,
        waveColor     : '#999'
    }

    backends = {
        MediaElement,
        WebAudio
    }

    static create(params) {
        const wavesurfer = new WaveSurfer(params);
        return wavesurfer.init();
    }

    // util should be available as a prototype property to all instances and as
    // a static property on the uninstantiated wavesurfer class
    util = util
    static util = util

    /**
     * Initialise wavesurfer instance
     *
     * @param {WavesurferParams} params Instantiation options for wavesurfer
     * @returns {WavesurferInstance} wavesurfer instance
     */
    constructor(params) {
        super();
        // Extract relevant parameters (or defaults)
        this.params = util.extend({}, this.defaultParams, params);

        this.container = 'string' == typeof params.container ?
            document.querySelector(this.params.container) :
            this.params.container;

        if (!this.container) {
            throw new Error('Container element not found');
        }

        if (this.params.mediaContainer == null) {
            this.mediaContainer = this.container;
        } else if (typeof this.params.mediaContainer == 'string') {
            this.mediaContainer = document.querySelector(this.params.mediaContainer);
        } else {
            this.mediaContainer = this.params.mediaContainer;
        }

        if (!this.mediaContainer) {
            throw new Error('Media Container element not found');
        }

        if (this.params.maxCanvasWidth <= 1) {
            throw new Error('maxCanvasWidth must be greater than 1');
        } else if (this.params.maxCanvasWidth % 2 == 1) {
            throw new Error('maxCanvasWidth must be an even number');
        }

        // Used to save the current volume when muting so we can
        // restore once unmuted
        this.savedVolume = 0;

        // The current muted state
        this.isMuted = false;

        // Will hold a list of event descriptors that need to be
        // cancelled on subsequent loads of audio
        this.tmpEvents = [];

        // Holds any running audio downloads
        this.currentAjax = null;

        // cache constructor objects
        if (typeof this.params.renderer !== 'function') {
            throw new Error('Renderer parameter is invalid');
        }
        this.Drawer = this.params.renderer;
        this.Backend = this.backends[this.params.backend];

        // plugins that are currently initialised
        this.initialisedPluginList = {};
        this.isDestroyed = false;
        this.isReady = false;
        return this;
    }

    init() {
        this.registerPlugins(this.params.plugins);
        this.createDrawer();
        this.createBackend();
        this.createPeakCache();
        return this;
    }

    /**
     * Add and initialise array of plugins (if plugin.deferInit is falsey)
     *
     * @param {PluginDefinition[]} plugins a list of plugin definitions
     */
    registerPlugins(plugins) {
        // first instantiate all the plugins
        plugins.forEach(plugin => this.addPlugin(plugin));

        // now run the init functions
        plugins.forEach(plugin => {
            // call init function of the plugin if deferInit is falsey
            // in that case you would manually use initPlugins()
            if (!plugin.deferInit) {
                this.initPlugin(plugin.name);
            }
        });
        this.fireEvent('plugins-registered', plugins);
        return this;
    }

    /**
     * Add a plugin object to wavesurfer
     *
     * @param {PluginDefinition} plugin a plugin definition
     */
    addPlugin(plugin) {
        if (!plugin.name) {
            throw new Error('Plugin does not have a name!');
        }
        if (!plugin.instance) {
            throw new Error(`Plugin ${plugin.name} does not have an instance factory!`);
        }

        // static properties are applied to wavesurfer instance
        if (plugin.static) {
            Object.keys(plugin.static).forEach(key => {
                this[key] = plugin.static[key];
            });
        }

        // default for deferInit is false
        plugin.deferInit = plugin.deferInit || false;

        // The super class of the plugin instance (the class the plugin instance
        // extends) is defined in the extends property in the plugin definition
        // object. This string is mapped to a class in the superClassMap below
        // and injected into the plugin instance generator function.
        let SuperClass = null;
        const superClassMap = {
            observer: util.Observer,
            drawer: this.Drawer
        };
        if (plugin.extends) {
            if (!superClassMap[plugin.extends]) {
                throw new Error(`Plugin ${plugin.name} has invalid extends property: ${plugin.extends}!`);
            }
            SuperClass = superClassMap[plugin.extends];
        }

        // instantiate plugin class
        /* eslint-disable new-cap */
        this[plugin.name] = new (plugin.instance(SuperClass))(this);
        /* eslint-enable new-cap */
        this.fireEvent('plugin-added', plugin.name);
        return this;
    }

    /**
     * Initialise a plugin
     *
     * @param {string} name a plugin name
     */
    initPlugin(name) {
        if (!this[name]) {
            throw new Error(`Plugin ${name} has not been added yet!`);
        }
        if (this.initialisedPluginList[name]) {
            // destroy any already initialised plugins
            this.destroyPlugin(name);
        }
        this[name].init();
        this.initialisedPluginList[name] = true;
        this.fireEvent('plugin-initialised', name);
        return this;
    }

    /**
     * Destroy a plugin
     *
     * @param {string} name a plugin name
     */
    destroyPlugin(name) {
        if (!this[name]) {
            throw new Error(`Plugin ${name} has not been added yet and cannot be destroyed!`);
        }
        if (!this.initialisedPluginList[name]) {
            throw new Error(`Plugin ${name} is not active and cannot be destroyed!`);
        }
        if (typeof this[name].destroy !== 'function') {
            throw new Error(`Plugin ${name} does not have a destroy function!`);
        }

        this[name].destroy();
        delete this.initialisedPluginList[name];
        this.fireEvent('plugin-destroyed', name);
        return this;
    }

    /**
     * Destroy all initialised plugins
     *
     * Convenience function to use when wavesurfer is removed
     */
    destroyAllPlugins() {
        Object.keys(this.initialisedPluginList).forEach(name => this.destroyPlugin(name));
    }

    createDrawer() {
        this.drawer = new this.Drawer(this.container, this.params, this);
        this.drawer.init();
        this.fireEvent('drawer-created', this.drawer);

        this.drawer.on('redraw', () => {
            this.drawBuffer();
            this.drawer.progress(this.backend.getPlayedPercents());
        });

        // Click-to-seek
        this.drawer.on('click', (e, progress) => {
            setTimeout(() => this.seekTo(progress), 0);
        });

        // Relay the scroll event from the drawer
        this.drawer.on('scroll', e => {
            if (this.params.partialRender) {
                this.drawBuffer();
            }
            this.fireEvent('scroll', e);
        });
    }

    createBackend() {
        if (this.backend) {
            this.backend.destroy();
        }

        // Back compat
        if (this.params.backend == 'AudioElement') {
            this.params.backend = 'MediaElement';
        }

        if (this.params.backend == 'WebAudio' && !this.Backend.prototype.supportsWebAudio.call(null)) {
            this.params.backend = 'MediaElement';
        }

        this.backend = new this.Backend(this.params);
        this.backend.init();
        this.fireEvent('backend-created', this.backend);

        this.backend.on('finish', () => this.fireEvent('finish'));
        this.backend.on('play', () => this.fireEvent('play'));
        this.backend.on('pause', () => this.fireEvent('pause'));

        this.backend.on('audioprocess', time => {
            this.drawer.progress(this.backend.getPlayedPercents());
            this.fireEvent('audioprocess', time);
        });
    }

    createPeakCache() {
        if (this.params.partialRender) {
            this.peakCache = new PeakCache();
        }
    }

    getDuration() {
        return this.backend.getDuration();
    }

    getCurrentTime() {
        return this.backend.getCurrentTime();
    }

    play(start, end) {
        this.fireEvent('interaction', () => this.play(start, end));
        this.backend.play(start, end);
    }

    pause() {
        this.backend.pause();
    }

    playPause() {
        this.backend.isPaused() ? this.play() : this.pause();
    }

    isPlaying() {
        return !this.backend.isPaused();
    }

    skipBackward(seconds) {
        this.skip(-seconds || -this.params.skipLength);
    }

    skipForward(seconds) {
        this.skip(seconds || this.params.skipLength);
    }

    skip(offset) {
        const duration = this.getDuration() || 1;
        let position = this.getCurrentTime() || 0;
        position = Math.max(0, Math.min(duration, position + (offset || 0)));
        this.seekAndCenter(position / duration);
    }

    seekAndCenter(progress) {
        this.seekTo(progress);
        this.drawer.recenter(progress);
    }

    seekTo(progress) {
        this.fireEvent('interaction', () => this.seekTo(progress));

        const paused = this.backend.isPaused();
        // avoid draw wrong position while playing backward seeking
        if (!paused) {
            this.backend.pause();
        }
        // avoid small scrolls while paused seeking
        const oldScrollParent = this.params.scrollParent;
        this.params.scrollParent = false;
        this.backend.seekTo(progress * this.getDuration());
        this.drawer.progress(this.backend.getPlayedPercents());

        if (!paused) {
            this.backend.play();
        }
        this.params.scrollParent = oldScrollParent;
        this.fireEvent('seek', progress);
    }

    stop() {
        this.pause();
        this.seekTo(0);
        this.drawer.progress(0);
    }

    /**
     * Set the playback volume.
     *
     * @param {Number} newVolume A value between 0 and 1, 0 being no
     * volume and 1 being full volume.
     */
    setVolume(newVolume) {
        this.backend.setVolume(newVolume);
    }

    /**
     * Set the playback rate.
     *
     * @param {Number} rate A positive number. E.g. 0.5 means half the
     * normal speed, 2 means double speed and so on.
     */
    setPlaybackRate(rate) {
        this.backend.setPlaybackRate(rate);
    }

    /**
     * Toggle the volume on and off. It not currenly muted it will
     * save the current volume value and turn the volume off.
     * If currently muted then it will restore the volume to the saved
     * value, and then rest the saved value.
     */
    toggleMute() {
        this.setMute(!this.isMuted);
    }

    setMute(mute) {
        // ignore all muting requests if the audio is already in that state
        if (mute === this.isMuted) {
            return;
        }

        if (mute) {
            // If currently not muted then save current volume,
            // turn off the volume and update the mute properties
            this.savedVolume = this.backend.getVolume();
            this.backend.setVolume(0);
            this.isMuted = true;
        } else {
            // If currently muted then restore to the saved volume
            // and update the mute properties
            this.backend.setVolume(this.savedVolume);
            this.isMuted = false;
        }
    }

    toggleScroll() {
        this.params.scrollParent = !this.params.scrollParent;
        this.drawBuffer();
    }

    toggleInteraction() {
        this.params.interact = !this.params.interact;
    }

    drawBuffer() {
        const nominalWidth = Math.round(
            this.getDuration() * this.params.minPxPerSec * this.params.pixelRatio
        );
        const parentWidth = this.drawer.getWidth();
        let width = nominalWidth;
        let start = this.drawer.getScrollX();
        let end = Math.min(start + parentWidth, width);

        // Fill container
        if (this.params.fillParent && (!this.params.scrollParent || nominalWidth < parentWidth)) {
            width = parentWidth;
            start = 0;
            end = width;
        }

        let peaks;
        if (this.params.partialRender) {
            const newRanges = this.peakCache.addRangeToPeakCache(width, start, end);
            let i;
            for (i = 0; i < newRanges.length; i++) {
                peaks = this.backend.getPeaks(width, newRanges[i][0], newRanges[i][1]);
                this.drawer.drawPeaks(peaks, width, newRanges[i][0], newRanges[i][1]);
            }
        } else {
            start = 0;
            end = width;
            peaks = this.backend.getPeaks(width, start, end);
            this.drawer.drawPeaks(peaks, width, start, end);
        }
        this.fireEvent('redraw', peaks, width);
    }

    zoom(pxPerSec) {
        this.params.minPxPerSec = pxPerSec;

        this.params.scrollParent = true;

        this.drawBuffer();
        this.drawer.progress(this.backend.getPlayedPercents());

        this.drawer.recenter(
            this.getCurrentTime() / this.getDuration()
        );
        this.fireEvent('zoom', pxPerSec);
    }

    /**
     * Internal method.
     */
    loadArrayBuffer(arraybuffer) {
        this.decodeArrayBuffer(arraybuffer, data => {
            if (!this.isDestroyed) {
                this.loadDecodedBuffer(data);
            }
        });
    }

    /**
     * Directly load an externally decoded AudioBuffer.
     */
    loadDecodedBuffer(buffer) {
        this.backend.load(buffer);
        this.drawBuffer();
        this.fireEvent('ready');
        this.isReady = true;
    }

    /**
     * Loads audio data from a Blob or File object.
     *
     * @param {Blob|File} blob Audio data.
     */
    loadBlob(blob) {
        // Create file reader
        const reader = new FileReader();
        reader.addEventListener('progress', e => this.onProgress(e));
        reader.addEventListener('load', e => this.loadArrayBuffer(e.target.result));
        reader.addEventListener('error', () => this.fireEvent('error', 'Error reading file'));
        reader.readAsArrayBuffer(blob);
        this.empty();
    }

    /**
     * Loads audio and re-renders the waveform.
     */
    load(url, peaks, preload) {
        this.empty();

        switch (this.params.backend) {
            case 'WebAudio': return this.loadBuffer(url, peaks);
            case 'MediaElement': return this.loadMediaElement(url, peaks, preload);
        }
    }

    /**
     * Loads audio using Web Audio buffer backend.
     */
    loadBuffer(url, peaks) {
        const load = action => {
            if (action) {
                this.tmpEvents.push(this.once('ready', action));
            }
            return this.getArrayBuffer(url, (data) => this.loadArrayBuffer(data));
        };

        if (peaks) {
            this.backend.setPeaks(peaks);
            this.drawBuffer();
            this.tmpEvents.push(this.once('interaction', load));
        } else {
            return load();
        }
    }

    /**
     * Either create a media element, or load an existing media element.
     * @param {String|HTMLElement} urlOrElt Either a path to a media file, or an
     * existing HTML5 Audio/Video Element
     * @param {Number[]} peaks Array of peaks. Required to bypass web audio
     * dependency
     * @param {Boolean} preload Set to true if the preload attribute of the audio
     * element should be enabled
     */
    loadMediaElement(urlOrElt, peaks, preload) {
        let url = urlOrElt;

        if (typeof urlOrElt === 'string') {
            this.backend.load(url, this.mediaContainer, peaks, preload);
        } else {
            const elt = urlOrElt;
            this.backend.loadElt(elt, peaks);

            // If peaks are not provided,
            // url = element.src so we can get peaks with web audio
            url = elt.src;
        }

        this.tmpEvents.push(
            this.backend.once('canplay', () => {
                this.drawBuffer();
                this.fireEvent('ready');
            }),
            this.backend.once('error', err => this.fireEvent('error', err))
        );

        // If no pre-decoded peaks provided, attempt to download the
        // audio file and decode it with Web Audio.
        if (peaks) {
            this.backend.setPeaks(peaks);
        } else if (this.backend.supportsWebAudio()) {
            this.getArrayBuffer(url, arraybuffer => {
                this.decodeArrayBuffer(arraybuffer, buffer => {
                    this.backend.buffer = buffer;
                    this.drawBuffer();
                    this.fireEvent('waveform-ready');
                });
            });
        }
    }

    decodeArrayBuffer(arraybuffer, callback) {
        this.arraybuffer = arraybuffer;

        this.backend.decodeArrayBuffer(
            arraybuffer,
            data => {
                // Only use the decoded data if we haven't been destroyed or another decode started in the meantime
                if (!this.isDestroyed && this.arraybuffer == arraybuffer) {
                    callback(data);
                    this.arraybuffer = null;
                }
            },
            () => this.fireEvent('error', 'Error decoding audiobuffer')
        );
    }

    getArrayBuffer(url, callback) {
        const ajax = util.ajax({
            url: url,
            responseType: 'arraybuffer'
        });

        this.currentAjax = ajax;

        this.tmpEvents.push(
            ajax.on('progress', e => {
                this.onProgress(e);
            }),
            ajax.on('success', (data, e) => {
                callback(data);
                this.currentAjax = null;
            }),
            ajax.on('error', e => {
                this.fireEvent('error', 'XHR error: ' + e.target.statusText);
                this.currentAjax = null;
            })
        );

        return ajax;
    }

    onProgress(e) {
        let percentComplete;
        if (e.lengthComputable) {
            percentComplete = e.loaded / e.total;
        } else {
            // Approximate progress with an asymptotic
            // function, and assume downloads in the 1-3 MB range.
            percentComplete = e.loaded / (e.loaded + 1000000);
        }
        this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
    }

    /**
     * Exports PCM data into a JSON array and opens in a new window.
     */
    exportPCM(length, accuracy, noWindow) {
        length = length || 1024;
        accuracy = accuracy || 10000;
        noWindow = noWindow || false;
        const peaks = this.backend.getPeaks(length, accuracy);
        const arr = [].map.call(peaks, val => Math.round(val * accuracy) / accuracy);
        const json = JSON.stringify(arr);
        if (!noWindow) {
            window.open('data:application/json;charset=utf-8,' +
                encodeURIComponent(json));
        }
        return json;
    }

    /**
     * Save waveform image as data URI.
     *
     * The default format is 'image/png'. Other supported types are
     * 'image/jpeg' and 'image/webp'.
     */
    exportImage(format, quality) {
        if (!format) {
            format = 'image/png';
        }
        if (!quality) {
            quality = 1;
        }

        return this.drawer.getImage(format, quality);
    }

    cancelAjax() {
        if (this.currentAjax) {
            this.currentAjax.xhr.abort();
            this.currentAjax = null;
        }
    }

    clearTmpEvents() {
        this.tmpEvents.forEach(e => e.un());
    }

    /**
     * Display empty waveform.
     */
    empty() {
        if (!this.backend.isPaused()) {
            this.stop();
            this.backend.disconnectSource();
        }
        this.cancelAjax();
        this.clearTmpEvents();
        this.drawer.progress(0);
        this.drawer.setWidth(0);
        this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
    }

    /**
     * Remove events, elements and disconnect WebAudio nodes.
     */
    destroy() {
        this.destroyAllPlugins();
        this.fireEvent('destroy');
        this.cancelAjax();
        this.clearTmpEvents();
        this.unAll();
        this.backend.destroy();
        this.drawer.destroy();
        this.isDestroyed = true;
    }
}
