'use strict';

var WaveSurfer = {
    defaultParams: {
        height        : 128,
        waveColor     : '#999',
        progressColor : '#555',
        cursorColor   : '#333',
        selectionColor: '#0fc',
        selectionBorder: false,
        selectionForeground: false,
        selectionBorderColor: '#000',
        cursorWidth   : 1,
        markerWidth   : 2,
        skipLength    : 2,
        minPxPerSec   : 10,
        samples       : 3,
        pixelRatio    : window.devicePixelRatio,
        fillParent    : true,
        scrollParent  : false,
        normalize     : false,
        audioContext  : null,
        container     : null,
        renderer      : 'Canvas',
        dragSelection : true,
        loopSelection : true,
        audioRate     : 1,
        interact      : true,
        draggableMarkers: false
    },

    init: function (params) {
        // Extract relevant parameters (or defaults)
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.container = 'string' == typeof params.container ?
            document.querySelector(this.params.container) :
            this.params.container;

        if (!this.container) {
            throw new Error('wavesurfer.js: container element not found');
        }

        // Marker objects
        this.markers = {};
        this.once('marked', this.bindMarks.bind(this));
        this.once('region-created', this.bindRegions.bind(this));

        // Region objects
        this.regions = {};

        // Used to save the current volume when muting so we can
        // restore once unmuted
        this.savedVolume = 0;
        // The current muted state
        this.isMuted = false;

        this.loopSelection = this.params.loopSelection;
        this.minPxPerSec = this.params.minPxPerSec;

        this.bindUserAction();
        this.createDrawer();
        this.createBackend();
    },

    bindUserAction: function () {
        // iOS requires user input to start loading audio
        var my = this;
        var onUserAction = function () {
            my.fireEvent('user-action');
        };
        document.addEventListener('mousedown', onUserAction);
        document.addEventListener('keydown', onUserAction);
        this.on('destroy', function () {
            document.removeEventListener('mousedown', onUserAction);
            document.removeEventListener('keydown', onUserAction);
        });
    },

    /**
     * Used with loadStream.
     */
    createMedia: function (url) {
        var my = this;

        var media = document.createElement('audio');
        media.controls = false;
        media.autoplay = false;
        media.src = url;

        media.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading media element');
        });

        var prevMedia = this.container.querySelector('audio');
        if (prevMedia) {
            this.container.removeChild(prevMedia);
        }
        this.container.appendChild(media);

        return media;
    },

    createDrawer: function () {
        var my = this;

        this.drawer = Object.create(WaveSurfer.Drawer[this.params.renderer]);
        this.drawer.init(this.container, this.params);

        this.drawer.on('redraw', function () {
            my.drawBuffer();
            my.drawer.progress(my.backend.getPlayedPercents());
        });

        this.on('progress', function (progress) {
            my.drawer.progress(progress);
        });

        // Click-to-seek
        this.drawer.on('mousedown', function (progress) {
            setTimeout(function () {
                my.seekTo(progress);
            }, 0);
        });
        
        // handle dbl click envent to clear selection or delete marker
        this.drawer.on('dblclick', function(e) {      
            if (e.target.tagName.toLowerCase() === 'handler' && e.target.id.indexOf('wavesurfer') === -1) {
                var mark = my.markers[e.target.parentNode.id];
                mark.remove();
            }
            else if (my.params.dragSelection) {
                my.clearSelection();
            }
        });

        // Drag selection or marker events
        if (this.params.dragSelection) {
            this.drawer.on('drag', function (drag) {
                my.dragging = true;
                my.updateSelection(drag);
            });
        }

        this.drawer.on('drag-mark', function (drag, mark) {
            mark.fireEvent('drag', drag);
        });

        // Mouseup for plugins
        this.drawer.on('mouseup', function (e) {
            my.fireEvent('mouseup', e);
            my.dragging = false;
        });
    },

    createBackend: function () {
        var my = this;

        this.backend = Object.create(WaveSurfer.WebAudio);

        this.backend.on('play', function () {
            my.fireEvent('play');
        });

        this.on('play', function () {
            my.restartAnimationLoop();
        });

        this.backend.on('finish', function () {
            my.fireEvent('finish');
        });

        this.backend.init(this.params);
    },

    restartAnimationLoop: function () {
        var my = this;
        var requestFrame = window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame;
        var frame = function () {
            if (!my.backend.isPaused()) {
                my.fireEvent('progress', my.backend.getPlayedPercents());
                requestFrame(frame);
            }
        };
        frame();
    },

    getDuration: function () {
        return this.backend.getDuration();
    },

    getCurrentTime: function () {
        return this.backend.getCurrentTime();
    },

    play: function (start, end) {
        this.backend.play(start, end);
    },

    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        this.backend.isPaused() ? this.play() : this.pause();
    },

    playPauseSelection: function () {
        var sel = this.getSelection();
        if (sel !== null) {
            this.seekTo(sel.startPercentage);
            this.playPause();
        }
    },

    skipBackward: function (seconds) {
        this.skip(seconds || -this.params.skipLength);
    },

    skipForward: function (seconds) {
        this.skip(seconds || this.params.skipLength);
    },

    skip: function (offset) {
        var timings = this.timings(offset);
        var progress = timings[0] / timings[1];

        this.seekTo(progress);
    },

    seekAndCenter: function (progress) {
        this.seekTo(progress);
        this.drawer.recenter(progress);
    },

    seekTo: function (progress) {
        var paused = this.backend.isPaused();
        // avoid small scrolls while paused seeking
        var oldScrollParent = this.params.scrollParent;
        if (paused) {
            this.params.scrollParent = false;
            // avoid noise while seeking
            this.savedVolume = this.backend.getVolume();
            this.backend.setVolume(0);
        }
        this.play(progress * this.getDuration());
        if (paused) {
            this.pause();
            this.backend.setVolume(this.savedVolume);
        }
        this.params.scrollParent = oldScrollParent;
        this.fireEvent('seek', progress);
    },

    stop: function () {
        this.pause();
        this.seekTo(0);
        this.drawer.progress(0);
    },

    /**
     * Set the playback volume.
     *
     * @param {Number} newVolume A value between 0 and 1, 0 being no
     * volume and 1 being full volume.
     */
    setVolume: function (newVolume) {
        this.backend.setVolume(newVolume);
    },

    /**
     * Toggle the volume on and off. It not currenly muted it will
     * save the current volume value and turn the volume off.
     * If currently muted then it will restore the volume to the saved
     * value, and then rest the saved value.
     */
    toggleMute: function () {
        if (this.isMuted) {
            // If currently muted then restore to the saved volume
            // and update the mute properties
            this.backend.setVolume(this.savedVolume);
            this.isMuted = false;
        } else {
            // If currently not muted then save current volume,
            // turn off the volume and update the mute properties
            this.savedVolume = this.backend.getVolume();
            this.backend.setVolume(0);
            this.isMuted = true;
        }
    },

    toggleScroll: function () {
        this.params.scrollParent = !this.params.scrollParent;
    },

    mark: function (options) {
        var my = this;

        var opts = WaveSurfer.util.extend({
            id: WaveSurfer.util.getId(),
            width: this.params.markerWidth
        }, options);

        if (opts.percentage && !opts.position) {
            opts.position = opts.percentage * this.getDuration();
        }
        opts.percentage = opts.position / this.getDuration();

        // If exists, just update and exit early
        if (opts.id in this.markers) {
            return this.markers[opts.id].update(opts);
        }

        // Ensure position for a new marker
        if (!opts.position) {
            opts.position = this.getCurrentTime();
            opts.percentage = opts.position / this.getDuration();
        }

        var mark = Object.create(WaveSurfer.Mark);
        mark.init(opts);

        // If we create marker while dragging we are creating selMarks
        if (this.dragging) {
            mark.on('drag', function(drag){
                my.updateSelectionByMark(drag, mark);
            });
        } else {
            mark.on('drag', function(drag){
                my.moveMark(drag, mark);
            });
        }

        mark.on('update', function () {
            my.drawer.updateMark(mark);
            my.fireEvent('mark-updated', mark);
        });
        mark.on('remove', function () {
            my.drawer.removeMark(mark);
            delete my.markers[mark.id];
            my.fireEvent('mark-removed', mark);
        });

        this.drawer.addMark(mark);
        this.drawer.on('mark-over', function (mark, e) {
            mark.fireEvent('over', e);
            my.fireEvent('mark-over', mark, e);
        });
        this.drawer.on('mark-leave', function (mark, e) {
            mark.fireEvent('leave', e);
            my.fireEvent('mark-leave', mark, e);
        });
        this.drawer.on('mark-click', function (mark, e) {
            mark.fireEvent('click', e);
            my.fireEvent('mark-click', mark, e);
        });

        this.markers[mark.id] = mark;
        this.fireEvent('marked', mark);

        return mark;
    },

    redrawMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            this.mark(this.markers[id]);
        }, this);
    },

    clearMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            this.markers[id].remove();
        }, this);
        this.markers = {};
    },

    redrawRegions: function () {
        Object.keys(this.regions).forEach(function (id) {
            this.region(this.regions[id]);
        }, this);
    },

    clearRegions: function() {
        Object.keys(this.regions).forEach(function (id) {
            this.regions[id].remove();
        }, this);
        this.regions = {};
    },

    region: function(options) {
        var my = this;

        var opts = WaveSurfer.util.extend({
            id: WaveSurfer.util.getId()
        }, options);

        opts.startPercentage = opts.startPosition / this.getDuration();
        opts.endPercentage = opts.endPosition / this.getDuration();

        // If exists, just update and exit early
        if (opts.id in this.regions) {
            return this.regions[opts.id].update(opts);
        }

        var region = Object.create(WaveSurfer.Region);
        region.init(opts);

        region.on('update', function () {
            my.drawer.updateRegion(region);
            my.fireEvent('region-updated', region);
        });
        region.on('remove', function () {
            my.drawer.removeRegion(region);
            my.fireEvent('region-removed', region);
            delete my.regions[region.id];
        });

        this.drawer.addRegion(region);

        this.drawer.on('region-over', function (region, e) {
            region.fireEvent('over', e);
            my.fireEvent('region-over', region, e);
        });
        this.drawer.on('region-leave', function (region, e) {
            region.fireEvent('leave', e);
            my.fireEvent('region-leave', region, e);
        });
        this.drawer.on('region-click', function (region, e) {
            region.fireEvent('click', e);
            my.fireEvent('region-click', region, e);
        });

        this.regions[region.id] = region;
        this.fireEvent('region-created', region);

        return region;

    },

    timings: function (offset) {
        var position = this.getCurrentTime() || 0;
        var duration = this.getDuration() || 1;
        position = Math.max(0, Math.min(duration, position + (offset || 0)));
        return [ position, duration ];
    },

    drawBuffer: function () {
        if (this.params.fillParent && !this.params.scrollParent) {
            var length = this.drawer.getWidth();
        } else {
            length = Math.round(
                this.getDuration() * this.minPxPerSec * this.params.pixelRatio
            );
        }

        this.drawer.drawPeaks(this.backend.getPeaks(length), length);
        this.redrawMarks();
        this.fireEvent('redraw');
    },

    drawAsItPlays: function () {
        var my = this;
        var peaks;
        this.drawFrame = function () {
            var duration = my.getDuration();
            var time = my.getCurrentTime();
            var length = Math.round(duration * my.minPxPerSec * my.params.pixelRatio);
            var x = ~~((time / duration) * length);
            if (!peaks) {
                peaks = new Uint8Array(length);
            }
            // 0 is the default value in Uint8Array
            if (0 == peaks[x]) {
                peaks[x] = WaveSurfer.util.max(my.backend.waveform(), 128);
                my.drawer.setWidth(length);
                my.drawer.clearWave();
                my.drawer.drawWave(peaks, 128);
            }
        };
        this.on('progress', this.drawFrame);
    },

    /**
     * Internal method.
     */
    loadArrayBuffer: function (arraybuffer) {
        var my = this;
        this.backend.decodeArrayBuffer(arraybuffer, function (data) {
            my.backend.loadBuffer(data);
            my.drawBuffer();
            my.fireEvent('ready');
        }, function () {
            my.fireEvent('error', 'Error decoding audiobuffer');
        });
    },

    /**
     * Directly load an externally decoded AudioBuffer.
     */
    loadDecodedBuffer: function (buffer) {
        this.empty();
        this.backend.loadBuffer(buffer);
        this.drawBuffer();
        this.fireEvent('ready');
    },

    /**
     * Loads audio data from a Blob or File object.
     *
     * @param {Blob|File} blob Audio data.
     */
    loadBlob: function (blob) {
        var my = this;
        // Create file reader
        var reader = new FileReader();
        reader.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        reader.addEventListener('load', function (e) {
            my.empty();
            my.loadArrayBuffer(e.target.result);
        });
        reader.addEventListener('error', function () {
            my.fireEvent('error', 'Error reading file');
        });
        reader.readAsArrayBuffer(blob);
    },

    /**
     * Loads audio and prerenders its waveform.
     */
    load: function (url) {
        this.empty();
        // load via XHR and render all at once
        return this.downloadArrayBuffer(url, this.loadArrayBuffer.bind(this));
    },

    /**
     * Load audio stream and render its waveform as it plays.
     */
    loadStream: function (url) {
        var my = this;

        this.empty();
        this.drawAsItPlays();
        this.media = this.createMedia(url);

        // iOS requires a touch to start loading audio
        this.once('user-action', function () {
            // Assume media.readyState >= media.HAVE_ENOUGH_DATA
            my.backend.loadMedia(my.media);
        });

        setTimeout(this.fireEvent.bind(this, 'ready'), 0);
    },

    downloadArrayBuffer: function (url, callback) {
        var my = this;
        var ajax = WaveSurfer.util.ajax({
            url: url,
            responseType: 'arraybuffer'
        });
        ajax.on('progress', function (e) {
            my.onProgress(e);
        });
        ajax.on('success', callback);
        ajax.on('error', function (e) {
            my.fireEvent('error', 'XHR error: ' + e.target.statusText);
        });
        return ajax;
    },

    onProgress: function (e) {
        if (e.lengthComputable) {
            var percentComplete = e.loaded / e.total;
        } else {
            // Approximate progress with an asymptotic
            // function, and assume downloads in the 1-3 MB range.
            percentComplete = e.loaded / (e.loaded + 1000000);
        }
        this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
    },

    bindMarks: function () {
        var my = this;
        var prevTime = 0;

        this.backend.on('play', function () {
            // Reset marker events
            Object.keys(my.markers).forEach(function (id) {
                my.markers[id].played = false;
            });
        });

        this.backend.on('audioprocess', function (time) {
            Object.keys(my.markers).forEach(function (id) {
                var marker = my.markers[id];
                if (!marker.played) {
                    if (marker.position <= time && marker.position >= prevTime) {
                        // Prevent firing the event more than once per playback
                        marker.played = true;

                        my.fireEvent('mark', marker);
                        marker.fireEvent('reached');
                    }
                }
            });
            prevTime = time;
        });
    },

    bindRegions: function() {
        var my = this;
        this.backend.on('play', function () {
            Object.keys(my.regions).forEach(function (id) {
                my.regions[id].fired_in = false;
                my.regions[id].fired_out = false;
            });
        });
        this.backend.on('audioprocess', function (time) {
            Object.keys(my.regions).forEach(function (id) {
                var region = my.regions[id];
                if (!region.fired_in && region.startPosition <= time && region.endPosition >= time) {
                    my.fireEvent('region-in', region);
                    region.fireEvent('in');
                    region.fired_in = true;
                }
                if (!region.fired_out && region.endPosition < time) {
                    my.fireEvent('region-out', region);
                    region.fireEvent('out');
                    region.fired_out = true;
                }
            });
        });
    },

    /**
     * Display empty waveform.
     */
    empty: function () {
        if (this.drawFrame) {
            this.un('progress', this.drawFrame);
            this.drawFrame = null;
        }

        if (this.backend && !this.backend.isPaused()) {
            this.stop();
            this.backend.disconnectSource();
        }
        this.clearMarks();
        this.clearRegions();
        this.drawer.setWidth(0);
        this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
    },

    /**
     * Remove events, elements and disconnect WebAudio nodes.
     */
    destroy: function () {
        this.fireEvent('destroy');
        this.clearMarks();
        this.clearRegions();
        this.unAll();
        this.backend.destroy();
        this.drawer.destroy();
        if (this.media) {
            this.container.removeChild(this.media);
        }
    },

    updateSelectionByMark: function (markDrag, mark) {
        var selection;
        if (mark.id == this.selMark0.id) {
            selection = {
                'startPercentage': markDrag.endPercentage,
                'endPercentage': this.selMark1.percentage
            };
        } else {
            selection = {
                'startPercentage': this.selMark0.percentage,
                'endPercentage': markDrag.endPercentage
            };
        }
        this.updateSelection(selection);
    },

    updateSelection: function (selection) {
        var my = this;
        var percent0 = selection.startPercentage;
        var percent1 = selection.endPercentage;
        var color = this.params.selectionColor;
        var width = 0;
        if (this.params.selectionBorder) {
            color = this.params.selectionBorderColor;
            width = 2; // parametrize?
        }

        if (percent0 > percent1) {
            var tmpPercent = percent0;
            percent0 = percent1;
            percent1 = tmpPercent;
        }

        if (this.selMark0) {
            this.selMark0.update({
                percentage: percent0,
                position: percent0 * this.getDuration()
            });
        } else {
            this.selMark0 = this.mark({
                width: width,
                percentage: percent0,
                position: percent0 * this.getDuration(),
                color: color,
                draggable: my.params.selectionBorder
            });
        }

        if (this.selMark1) {
            this.selMark1.update({
                percentage: percent1,
                position: percent1 * this.getDuration()
            });
        } else {
            this.selMark1 = this.mark({
                width: width,
                percentage: percent1,
                position: percent1 * this.getDuration(),
                color: color,
                draggable: my.params.selectionBorder
            });
        }

        this.drawer.updateSelection(percent0, percent1);

        if (this.loopSelection) {
            this.backend.updateSelection(percent0, percent1);
        }
        my.fireEvent('selection-update', this.getSelection());
    },

    moveMark: function (drag, mark) {
        mark.update({
            percentage: drag.endPercentage,
            position: drag.endPercentage * this.getDuration()
        });
        this.markers[mark.id] = mark;
    },

    clearSelection: function () {
        if (this.selMark0 && this.selMark1) {
            this.drawer.clearSelection(this.selMark0, this.selMark1);
            if (this.selMark0) {
                this.selMark0.remove();
                this.selMark0 = null;
            }
            if (this.selMark1) {
                this.selMark1.remove();
                this.selMark1 = null;
            }

            if (this.loopSelection) {
                this.backend.clearSelection();
            }
            this.fireEvent('selection-update', this.getSelection());
        }
    },

    toggleLoopSelection: function () {
        this.loopSelection = !this.loopSelection;

        if (this.selMark0) this.selectionPercent0 = this.selMark0.percentage;
        if (this.selMark1) this.selectionPercent1 = this.selMark1.percentage;
        this.updateSelection();
        this.selectionPercent0 = null;
        this.selectionPercent1 = null;
    },

    getSelection: function () {
        if (!this.selMark0 || !this.selMark1) return null;
        return {
            startPercentage: this.selMark0.percentage,
            startPosition: this.selMark0.position,
            endPercentage: this.selMark1.percentage,
            endPosition: this.selMark1.position,
            startTime: this.selMark0.getTitle(),
            endTime: this.selMark1.getTitle()
        };
    },

    enableInteraction: function () {
        this.drawer.interact = true;
    },

    disableInteraction: function () {
        this.drawer.interact = false;
    },

    toggleInteraction: function () {
        this.drawer.interact = !this.drawer.interact;
    }
};


/* Mark */
WaveSurfer.Mark = {
    defaultParams: {
        id: null,
        position: 0,
        percentage: 0,
        width: 1,
        color: '#333',
        draggable: false
    },

    init: function (options) {
        this.apply(
            WaveSurfer.util.extend({}, this.defaultParams, options)
        );
        return this;
    },

    getTitle: function () {
        return [
            ~~(this.position / 60),                   // minutes
            ('00' + ~~(this.position % 60)).slice(-2) // seconds
        ].join(':');
    },

    apply: function (options) {
        Object.keys(options).forEach(function (key) {
            if (key in this.defaultParams) {
                this[key] = options[key];
            }
        }, this);
    },

    update: function (options) {
        this.apply(options);
        this.fireEvent('update');
    },

    remove: function () {
        this.fireEvent('remove');
        this.unAll();
    }
};

/* Region */

WaveSurfer.Region = {
    defaultParams: {
        id: null,
        startPosition: 0,
        endPosition: 0,
        startPercentage: 0,
        endPercentage: 0,
        color: 'rgba(0, 0, 255, 0.2)'
    },

    init: function (options) {
        this.apply(
            WaveSurfer.util.extend({}, this.defaultParams, options)
        );
        return this;
    },

    apply: function (options) {
        Object.keys(options).forEach(function (key) {
            if (key in this.defaultParams) {
                this[key] = options[key];
            }
        }, this);
    },

    update: function (options) {
        this.apply(options);
        this.fireEvent('update');
    },

    remove: function () {
        this.fireEvent('remove');
        this.unAll();
    }
};

/* Observer */
WaveSurfer.Observer = {
    on: function (event, fn) {
        if (!this.handlers) { this.handlers = {}; }

        var handlers = this.handlers[event];
        if (!handlers) {
            handlers = this.handlers[event] = [];
        }
        handlers.push(fn);
    },

    un: function (event, fn) {
        if (!this.handlers) { return; }

        var handlers = this.handlers[event];
        if (handlers) {
            if (fn) {
                for (var i = handlers.length - 1; i >= 0; i--) {
                    if (handlers[i] == fn) {
                        handlers.splice(i, 1);
                    }
                }
            } else {
                handlers.length = 0;
            }
        }
    },

    unAll: function () {
        this.handlers = null;
    },

    once: function (event, handler) {
        var my = this;
        var fn = function () {
            handler();
            setTimeout(function () {
                my.un(event, fn);
            }, 0);
        };
        this.on(event, fn);
    },

    fireEvent: function (event) {
        if (!this.handlers) { return; }
        var handlers = this.handlers[event];
        var args = Array.prototype.slice.call(arguments, 1);
        handlers && handlers.forEach(function (fn) {
            fn.apply(null, args);
        });
    }
};

/* Common utilities */
WaveSurfer.util = {
    extend: function (dest) {
        var sources = Array.prototype.slice.call(arguments, 1);
        sources.forEach(function (source) {
            Object.keys(source).forEach(function (key) {
                dest[key] = source[key];
            });
        });
        return dest;
    },

    getId: function () {
        return 'wavesurfer_' + Math.random().toString(32).substring(2);
    },

    max: function (values, min) {
        var max = -Infinity;
        for (var i = 0, len = values.length; i < len; i++) {
            var val = values[i];
            if (min != null) {
                val = Math.abs(val - min);
            }
            if (val > max) { max = val; }
        }
        return max;
    },

    ajax: function (options) {
        var ajax = Object.create(WaveSurfer.Observer);
        var xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', options.url, true);
        xhr.responseType = options.responseType;
        xhr.addEventListener('progress', function (e) {
            ajax.fireEvent('progress', e);
        });
        xhr.addEventListener('load', function (e) {
            ajax.fireEvent('load', e);

            if (200 == xhr.status || 206 == xhr.status) {
                ajax.fireEvent('success', xhr.response, e);
            } else {
                ajax.fireEvent('error', e);
            }
        });
        xhr.addEventListener('error', function (e) {
            ajax.fireEvent('error', e);
        });
        xhr.send();
        ajax.xhr = xhr;
        return ajax;
    },

    /**
     * @see http://underscorejs.org/#throttle
     */
    throttle: function (func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        options || (options = {});
        var later = function () {
            previous = options.leading === false ? 0 : Date.now();
            timeout = null;
            result = func.apply(context, args);
            context = args = null;
        };
        return function () {
            var now = Date.now();
            if (!previous && options.leading === false) previous = now;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0) {
                clearTimeout(timeout);
                timeout = null;
                previous = now;
                result = func.apply(context, args);
                context = args = null;
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    }
};

WaveSurfer.util.extend(WaveSurfer, WaveSurfer.Observer);
WaveSurfer.util.extend(WaveSurfer.Mark, WaveSurfer.Observer);
WaveSurfer.util.extend(WaveSurfer.Region, WaveSurfer.Observer);
