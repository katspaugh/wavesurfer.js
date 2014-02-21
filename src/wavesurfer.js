'use strict';

var WaveSurfer = {
    defaultParams: {
        height        : 128,
        waveColor     : '#999',
        progressColor : '#555',
        cursorColor   : '#333',
        selectionColor: '#0fc',
        cursorWidth   : 1,
        markerWidth   : 1,
        skipLength    : 2,
        minPxPerSec   : 1,
        samples       : 3,
        pixelRatio    : window.devicePixelRatio,
        fillParent    : true,
        scrollParent  : false,
        normalize     : false,
        audioContext  : null,
        container     : null,
        renderer      : 'Canvas',
        dragSelection : true,
        loopSelection : true
    },

    init: function (params) {
        // Extract relevant parameters (or defaults)
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        // Marker objects
        this.markers = {};
        this.once('marked', this.bindMarks.bind(this));

        // Used to save the current volume when muting so we can
        // restore once unmuted
        this.savedVolume = 0;
        // The current muted state
        this.isMuted = false;

        this.loopSelection = this.params.loopSelection;

        this.createBackend();
        this.createDrawer();

        this.on('loaded', this.loadBuffer.bind(this));
    },

    createDrawer: function () {
        var my = this;

        this.drawer = Object.create(WaveSurfer.Drawer[this.params.renderer]);
        this.drawer.init(this.params);

        this.drawer.on('redraw', function () {
            my.drawBuffer();
        });

        this.on('progress', function (progress) {
            my.drawer.progress(progress);
        });

        // Click-to-seek
        this.drawer.on('click', function (progress) {
            my.seekTo(progress);
        });

        // Drag selection events
        if (this.params.dragSelection) {
            this.drawer.on('drag', function (drag) {
                my.updateSelection(drag);
                my.seekTo(drag.startPercentage);
            });
            this.drawer.on('drag-clear', function () {
                my.clearSelection();
            });
        }
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
            my.fireEvent('progress', my.backend.getPlayedPercents());
            if (!my.backend.isPaused()) {
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

    playAt: function (percents) {
        this.backend.play(this.getDuration() * percents);
    },

    play: function () {
        this.backend.play();
    },

    pause: function () {
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
        this.playAt(progress);
        if (paused) {
            this.pause();
        }
        this.fireEvent('seek', progress);
    },

    stop: function () {
        this.playAt(0);
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
        if (options.id && options.id in this.markers) {
            return this.markers[options.id].update(options);
        }

        var my = this;

        var opts = WaveSurfer.util.extend({
            id: WaveSurfer.util.getId(),
            position: this.getCurrentTime(),
            width: this.params.markerWidth
        }, options);

        var marker = Object.create(WaveSurfer.Mark);

        marker.on('update', function () {
            var duration = my.getDuration() || 1;
            if (null == marker.position) {
                marker.position = marker.percentage * duration;
            }
            // validate percentage
            marker.percentage = marker.position / duration;
            my.markers[marker.id] = marker;

            // redraw marker
            my.drawer.addMark(marker);
        });

        marker.on('remove', function () {
            my.drawer.removeMark(marker);
            delete my.markers[marker.id];
        });

        this.fireEvent('marked', marker);

        return marker.init(opts);
    },

    redrawMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            var marker = this.markers[id];
            this.drawer.addMark(marker);
        }, this);
    },

    clearMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            this.markers[id].remove();
        }, this);
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
                this.getDuration() * this.params.minPxPerSec
            );
        }

        var peaks = this.backend.getPeaks(length);

        this.drawer.drawPeaks(peaks, length);
        this.drawer.progress(this.backend.getPlayedPercents());
        this.redrawMarks();
    },

    loadBuffer: function (data) {
        var my = this;
        this.backend.loadBuffer(data, function () {
            my.clearMarks();
            my.drawBuffer();
            my.fireEvent('ready');
        }, function () {
            my.fireEvent('error', 'Error decoding audio');
        });
    },

    /**
     * Loads an AudioBuffer.
     */
    loadDecodedBuffer: function (buffer) {
      this.backend.setBuffer(buffer);
      this.clearMarks();
      this.drawBuffer();
      this.fireEvent('ready');
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

    /**
     * Loads audio data from a Blob or File object.
     *
     * @param {Blob|File} blob Audio data.
     */
    loadArrayBuffer: function(blob) {
        var my = this;
        // Create file reader
        var reader = new FileReader();
        reader.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        reader.addEventListener('load', function (e) {
            my.fireEvent('loaded', e.target.result);
        });
        reader.addEventListener('error', function () {
            my.fireEvent('error', 'Error reading file');
        });
        reader.readAsArrayBuffer(blob);
    },

    /**
     * Loads an audio file via XHR.
     */
    load: function (url) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.send();
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener('progress', function (e) {
            my.onProgress(e);
        });
        xhr.addEventListener('load', function () {
            if (200 == xhr.status) {
                my.fireEvent('loaded', xhr.response);
            } else {
                my.fireEvent('error', 'Server response: ' + xhr.statusText);
            }
        });
        xhr.addEventListener('error', function () {
            my.fireEvent('error', 'Error loading audio');
        });
        this.empty();
    },

    /**
     * Listens to drag'n'drop.
     * @param {HTMLElement|String} dropTarget Element or selector.
     */
    bindDragNDrop: function (dropTarget) {
        var my = this;

        // Bind drop event
        if (typeof dropTarget == 'string') {
            dropTarget = document.querySelector(dropTarget);
        }

        var dropActiveCl = 'wavesurfer-dragover';
        var handlers = {};

        // Drop event
        handlers.drop = function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropTarget.classList.remove(dropActiveCl);
            var file = e.dataTransfer.files[0];
            if (file) {
                my.empty();
                my.loadArrayBuffer(file);
            } else {
                my.fireEvent('error', 'Not a file');
            }
        };
        // Dragover & dragleave events
        handlers.dragover = function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropTarget.classList.add(dropActiveCl);
        };
        handlers.dragleave = function (e) {
            e.stopPropagation();
            e.preventDefault();
            dropTarget.classList.remove(dropActiveCl);
        };

        Object.keys(handlers).forEach(function (event) {
            dropTarget.addEventListener(event, handlers[event]);
        });

        this.on('destroy', function () {
            Object.keys(handlers).forEach(function (event) {
                dropTarget.removeEventListener(event, handlers[event]);
            });
        });
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
                if (!marker.played || (my.loopSelection && marker.loopEnd)) {
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
        this.clearMarks();
        this.backend.loadEmpty();
        this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
    },

    /**
     * Remove events, elements and disconnect WebAudio nodes.
     */
    destroy: function () {
        this.fireEvent('destroy');
        this.clearMarks();
        this.unAll();
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
                id: 'selMark0',
                percentage: percent0,
                color: color
            });
        }
        this.drawer.addMark(this.selMark0);

        if (this.selMark1) {
            this.selMark1.update({ percentage: percent1 });
        } else {
            this.selMark1 = this.mark({
                id: 'selMark1',
                percentage: percent1,
                color: color
            });
            this.selMark1.loopEnd = true;
            this.selMark1.on('reached', function(){
                my.backend.logLoop(my.selMark0.position, my.selMark1.position);
            });
        }
        this.drawer.addMark(this.selMark1);

        this.drawer.updateSelection(percent0, percent1);
        this.backend.updateSelection(percent0, percent1);
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
        this.backend.clearSelection();
    },

    toggleLoopSelection: function () {
        this.loopSelection = !this.loopSelection;
        this.drawer.loopSelection = this.loopSelection;
        this.backend.loopSelection = this.loopSelection;

        if (this.selMark0) this.selectionPercent0 = this.selMark0.percentage;
        if (this.selMark1) this.selectionPercent1 = this.selMark1.percentage;
        this.updateSelection();
        this.selectionPercent0 = null;
        this.selectionPercent1 = null;
    },

    getSelection: function () {
      if (!this.selMark0 || !this.selMark1) return null;

      var duration = this.getDuration();
      var startPercentage = this.selMark0.percentage;
      var endPercentage = this.selMark1.percentage;

      return {
          startPercentage: startPercentage,
          startPosition: startPercentage * duration,
          endPercentage: endPercentage,
          endPosition: endPercentage * duration
      };
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
        return this.update(
            WaveSurfer.util.extend({}, this.defaultParams, options)
        );
    },

    getTitle: function () {
        var d = new Date(this.position * 1000);
        return d.getMinutes() + ':' + d.getSeconds();
    },

    update: function (options) {
        Object.keys(options).forEach(function (key) {
            if (key in this.defaultParams) {
                this[key] = options[key];
            }
        }, this);

        // If percentage is specified, but position is undefined,
        // let the subscribers to recalculate the position
        if (null == options.position && null != options.percentage) {
            this.position = null;
        }

        this.fireEvent('update');
        return this;
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

    max: function (values) {
        var max = -Infinity;
        for (var i = 0, len = values.length; i < len; i++) {
            var val = values[i];
            if (val > max) { max = val; }
        }
        return max;
    }
};

WaveSurfer.util.extend(WaveSurfer, WaveSurfer.Observer);
WaveSurfer.util.extend(WaveSurfer.Mark, WaveSurfer.Observer);
