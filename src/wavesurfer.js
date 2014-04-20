'use strict';

var WaveSurfer = {
    defaultParams: {
        height        : 128,
        waveColor     : '#999',
        progressColor : '#555',
        cursorColor   : '#333',
        selectionColor: '#0fc',
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
        maxDuration   : 10 * 60 // 10 minutes
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

        // Used to save the current volume when muting so we can
        // restore once unmuted
        this.savedVolume = 0;
        // The current muted state
        this.isMuted = false;

        this.loopSelection = this.params.loopSelection;
        this.minPxPerSec = this.params.minPxPerSec;

        this.createMedia();
        this.createBackend();
        this.createDrawer();
    },

    createMedia: function () {
        var my = this;

        this.media = document.createElement('audio');
        this.media.controls = false;
        this.media.autoplay = false;

        this.media.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading media element');
        });

        this.container.appendChild(this.media);
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
            my.seekTo(progress);
        });

        // Drag selection events
        if (this.params.dragSelection) {
            this.drawer.on('drag', function (drag) {
                my.updateSelection(drag);
            });
            this.drawer.on('drag-clear', function () {
                my.clearSelection();
            });
        }

        // Mouseup for plugins
        this.drawer.on('mouseup', function (e) {
            my.fireEvent('mouseup', e);
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

    playAtPercent: function (startPercentage) {
        this.play(startPercentage * this.getDuration());
    },

    play: function (start, end) {
        // for iOS
        this.fireEvent('user-action');

        this.backend.play(start, end);
    },

    pause: function () {
        // for iOS
        this.fireEvent('user-action');

        this.backend.pause();
    },

    playPause: function () {
        this.backend.isPaused() ? this.play() : this.pause();
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

    seekTo: function (progress) {
        var paused = this.backend.isPaused();
        this.playAtPercent(progress);
        if (paused) {
            this.pause();
        }
        this.fireEvent('seek', progress);
    },

    stop: function () {
        this.play(0);
        this.pause();
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
        mark.on('update', function () {
            my.drawer.updateMark(mark);
        });
        mark.on('remove', function () {
            my.drawer.removeMark(mark);
            delete my.markers[mark.id];
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
        var length = Math.round(
            this.getDuration() * this.minPxPerSec * this.params.pixelRatio
        );
        var peaks = new Uint8Array(length);
        var prevX = -1;
        this.params.scrollParent = true;
        this.drawer.setWidth(length);
        this.on('progress', function () {
            var x = ~~(my.backend.getPlayedPercents() * length);
            if (x != prevX) {
                prevX = x;
                peaks[x] = WaveSurfer.util.max(my.backend.waveform(), 128);
            }
            my.drawer.clearWave();
            my.drawer.drawWave(peaks, 128);
        });
    },

    /**
     * Loads audio from URL.
     */
    load: function (url) {
        var my = this;

        this.empty();
        this.media.src = url;

        if (my.media.duration > my.params.maxDuration) {
            // render as it plays
            my.drawAsItPlays();
            my.fireEvent('ready');
        } else {
            // load via XHR and render all at once
            my.loadArrayBuffer(url, function (arraybuffer) {
                my.backend.decodeArrayBuffer(arraybuffer, function () {
                    my.drawBuffer();
                    my.fireEvent('ready');
                }, function () {
                    my.fireEvent('error', 'Error decoding audiobuffer');
                });
            });
        }

        this.once('user-action', function () {
            my.backend.loadMedia(my.media);
        });
    },

    loadArrayBuffer: function (url, callback) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        xhr.addEventListener('load', function () {
            if (200 == xhr.status || 206 == xhr.status) {
                callback(xhr.response);
            } else {
                my.fireEvent('error', 'Server response: ' + xhr.statusText);
            }
        });
        xhr.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading audio via XHR');
        });
        xhr.send();
        my.fireEvent('xhr-start', xhr);
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

    /**
     * Display empty waveform.
     */
    empty: function () {
        if (!this.backend.isPaused()) {
            this.stop();
        }
        this.clearMarks();
        this.drawer.setWidth(0);
        this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
        this.backend.disconnectSource();
    },

    /**
     * Remove events, elements and disconnect WebAudio nodes.
     */
    destroy: function () {
        this.fireEvent('destroy');
        this.clearMarks();
        this.unAll();
        this.container.removeChild(this.media);
        this.backend.destroy();
        this.drawer.destroy();
    },

    updateSelection: function (selection) {
        var my = this;

        var percent0 = selection.startPercentage;
        var percent1 = selection.endPercentage;
        var color = this.params.selectionColor;

        if (percent0 > percent1) {
            var tmpPercent = percent0;
            percent0 = percent1;
            percent1 = tmpPercent;
        }

        if (this.selMark0) {
            this.selMark0.update({ percentage: percent0 });
        } else {
            this.selMark0 = this.mark({
                width: 0,
                percentage: percent0,
                color: color
            });
        }

        if (this.selMark1) {
            this.selMark1.update({ percentage: percent1 });
        } else {
            this.selMark1 = this.mark({
                width: 0,
                percentage: percent1,
                color: color
            });
        }

        this.drawer.updateSelection(percent0, percent1);

        if (this.loopSelection) {
            this.backend.updateSelection(percent0, percent1);
        }
    },

    clearSelection: function () {
        if (this.selMark0) {
            this.selMark0.remove();
            this.selMark0 = null;
        }
        if (this.selMark1) {
            this.selMark1.remove();
            this.selMark1 = null;
        }
        this.drawer.clearSelection();

        if (this.loopSelection) {
            this.backend.clearSelection();
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
            endPosition: this.selMark1.position
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
        color: '#333'
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
        var fn = (function () {
            handler();
            this.un(event, fn);
        }).bind(this);
        this.on(event, fn);
    },

    fireEvent: function (event) {
        if (!this.handlers) { return; }

        var handlers = this.handlers[event];
        var args = Array.prototype.slice.call(arguments, 1);
        if (handlers) {
            for (var i = 0, len = handlers.length; i < len; i += 1) {
                handlers[i].apply(null, args);
            }
        }
    }
};

/* Common utilities */
WaveSurfer.util = {
    extend: function (dest) {
        var sources = Array.prototype.slice.call(arguments, 1);
        sources.forEach(function (source) {
            if (source != null) {
                Object.keys(source).forEach(function (key) {
                    dest[key] = source[key];
                });
            }
        });
        return dest;
    },

    getId: function () {
        return 'wavesurfer_' + Math.random().toString(32).substring(2);
    },

    max: function (values, median) {
        var max = -Infinity;
        for (var i = 0, len = values.length; i < len; i++) {
            var val = values[i];
            if (median != null) {
                val = Math.abs(val - median);
            }
            if (val > max) { max = val; }
        }
        return max;
    },

    /**
     * @see http://underscorejs.org/#throttle
     */
    throttle: function(func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        options || (options = {});
        var later = function() {
            previous = options.leading === false ? 0 : Date.now();
            timeout = null;
            result = func.apply(context, args);
            context = args = null;
        };
        return function() {
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
