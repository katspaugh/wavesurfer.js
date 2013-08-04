'use strict';

var WaveSurfer = {
    defaultParams: {
        waveColor     : '#999',
        progressColor : '#333',
        cursorColor   : '#ddd',
        cursorWidth   : 1,
        markerWidth   : 1,
        skipLength    : 2,
        minPxPerSec   : 1,
        pixelRatio    : 1, // devicePixelRatio is slower
        fillParent    : true,
        scrollParent  : false,
        AudioContext  : null,
        container     : null
    },

    init: function (params) {
        // extract relevant parameters (or defaults)
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.drawer = Object.create(WaveSurfer.Drawer);
        this.drawer.init(this.params);

        this.markers = {};

        this.createBackend();
        this.bindClick();
    },

    createBackend: function () {
        var my = this;

        this.backend = Object.create(WaveSurfer.WebAudio);

        this.backend.on('audioprocess', function (progress) {
            // pause when finished
            if (progress >= 1.0) {
                my.pause();
            }
            my.drawer.progress(progress);
            my.fireEvent('progress', progress);
        });

        this.backend.init(this.params);
    },

    playAt: function (percents) {
        this.backend.play(this.backend.getDuration() * percents);
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
            this.drawer.progress(progress);
        }
        this.fireEvent('seek', progress);
    },

    stop: function () {
        this.playAt(0);
        this.pause();
        this.drawer.progress(0);
    },

    mark: function (options) {
        var my = this;
        var timings = this.timings(0);
        var opts = WaveSurfer.util.extend({
            id: WaveSurfer.util.getId(),
            position: timings[0]
        }, options);

        opts.percentage = opts.position / timings[1];

        var marker = Object.create(WaveSurfer.Mark);

        marker.on('update', function () {
            my.drawer.addMark(marker);
            my.markers[marker.id] = marker;
        });

        marker.on('remove', function () {
            my.drawer.removeMark(marker);
            delete my.markers[marker.id];
        });

        return marker.update(opts);
    },

    clearMarks: function () {
        Object.keys(this.markers).forEach(function (id) {
            this.markers[id].remove();
        }, this);
    },

    timings: function (offset) {
        var position = this.backend.getCurrentTime() || 0;
        var duration = this.backend.getDuration() || 1;
        position = Math.max(0, Math.min(duration, position + offset));
        return [ position, duration ];
    },

    drawBuffer: function () {
        // Update percentage on any markers added before the audio loaded.
        var duration = this.backend.getDuration() || 1;
        Object.keys(this.markers).forEach(function (id) {
            var marker = this.markers[id];
            marker.update({ percentage: marker.position / duration });
        }, this);

        var pixels = this.drawer.getPixels(duration);
        var peaks = this.backend.getPeaks(pixels);
        var max = this.backend.getMaxPeak();

        this.drawer.drawPeaks(peaks, max);

        this.fireEvent('ready');
    },

    /**
     * Loads an audio file via XHR.
     */
    load: function (url) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';

        xhr.addEventListener('progress', function (e) {
            var percentComplete;
            if (e.lengthComputable) {
                percentComplete = e.loaded / e.total;
            } else {
                // TODO
                // for now, approximate progress with an asymptotic
                // function, and assume downloads in the 1-3 MB range.
                percentComplete = e.loaded / (e.loaded + 1000000);
            }
            my.fireEvent('loading', percentComplete);
        }, false);

        xhr.addEventListener('load', function (e) {
            my.fireEvent('loading', 0);
            my.backend.loadBuffer(
                e.target.response,
                my.drawBuffer.bind(my)
            );
        }, false);

        xhr.open('GET', url, true);
        xhr.send();
    },

    /**
     *  Listens to drag'n'drop.
     */
    bindDragNDrop: function (dropTarget) {
        var my = this;
        var reader = new FileReader();
        reader.addEventListener('load', function (e) {
            my.backend.loadBuffer(
                e.target.result,
                my.drawBuffer.bind(my)
            );
        }, false);

        (dropTarget || document).addEventListener('drop', function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files[0];
            file && reader.readAsArrayBuffer(file);
        }, false);
    },

    /**
     * Click to seek.
     */
    bindClick: function () {
        var my = this;
        this.drawer.on('click', function (progress) {
            my.seekTo(progress);
            my.fireEvent('click', progress);
        });
    },

    bindMarks: function () {
        var my = this;
        var markers = this.markers;

        this.on('progress', function () {
            Object.keys(markers).forEach(function (id) {
                var marker = markers[id];
                var position = marker.position.toPrecision(3);
                var time = my.backend.getCurrentTime().toPrecision(3);
                if (position == time) {
                    my.fireEvent('mark', marker);
                    marker.fireEvent('reached');
                }
            });
        });
    }
};


/* Mark */
WaveSurfer.Mark = {
    id: null,
    percentage: 0,
    position: 0,

    getTitle: function () {
        var d = new Date(this.position * 1000);
        return d.getMinutes() + ':' + d.getSeconds();
    },

    update: function (options) {
        WaveSurfer.util.extend(this, options);
        this.fireEvent('update');
        return this;
    },

    remove: function () {
        this.fireEvent('remove');
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
    }
};

WaveSurfer.util.extend(WaveSurfer, Observer);
WaveSurfer.util.extend(WaveSurfer.Mark, Observer);
