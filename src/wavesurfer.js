'use strict';

var WaveSurfer = {
    defaultParams: {
        skipLength: 2
    },

    init: function (params) {
        // extract relevant parameters (or defaults)
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.drawer = Object.create(WaveSurfer.Drawer);
        this.drawer.init(this.params);

        this.markers = {};

        this.createBackend();
        this.bindClick();
        this.bindMarks();
    },

    createBackend: function () {
        this.backend = Object.create(WaveSurfer.WebAudio);
        this.backend.init(this.params);
        var my = this;
        this.backend.on('audioprocess', function (progress) {
            my.onAudioProcess(progress);
        });
    },

    onAudioProcess: function (progress) {
        // pause when finished
        if (progress >= 1.0) {
            this.pause();
        }
        this.drawer.progress(progress);
        this.fireEvent('progress', progress);
    },

    playAt: function (percents) {
        this.backend.play(this.backend.getDuration() * percents);
    },

    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        if (this.backend.paused) {
            var playedPercent = this.backend.getPlayedPercents();
            if (playedPercent >= 1.0) playedPercent = 0;
            this.playAt(playedPercent);
        } else {
            this.pause();
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

    seekTo: function (progress) {
        var paused = this.backend.paused;
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

    marks: 0,
    mark: function (options) {
        options = options || {};

        var self = this;
        var timings = this.timings(0);
        var id = options.id || '_m' + this.marks++;
        var position = typeof options.position === 'undefined' ?
            timings[0] : options.position;

        var marker = {
            id: id,
            percentage: position / timings[1],
            position: position,

            update: function (options) {
                options = options || {};

                this.color = options.color;
                this.width = options.width;

                self.drawer.addMark(this);

                return this;
            },

            remove: function () {
                self.drawMark.removeMark(this);
            }
        };

        this.markers[id] = marker;

        return marker.update(options);
    },

    clearMarks: function () {
        this.drawer.markers = {};
        this.marks = 0;
    },

    timings: function (offset) {
        var position = this.backend.getCurrentTime() || 0;
        var duration = this.backend.getDuration() || 1;
        position = Math.max(0, Math.min(duration, position + offset));
        return [position, duration];
    },

    isReady: function () {
        return this.backend.currentBuffer;
    },

    getPeaks: function (buffer, n) {
        var frames = buffer.getChannelData(0).length;
        // Frames per pixel
        var k = frames / n;
        var peaks = [];

        for (var i = 0; i < n; i++) {
            var sum = 0;
            for (var c = 0; c < buffer.numberOfChannels; c++) {
                var chan = buffer.getChannelData(c);
                var vals = chan.subarray(i * k, (i + 1) * k);
                var peak = -Infinity;
                for (var p = 0; p < k; p++) {
                    var val = Math.abs(vals[p]);
                    if (val > peak){
                        peak = val;
                    }
                }
                sum += peak;
            }
            peaks[i] = sum;
        }
        return peaks;
    },

    drawBuffer: function () {
        var my = this;
        var peaks = this.getPeaks(this.backend.currentBuffer, this.drawer.width);
        var maxPeak = Math.max.apply(Math, peaks);

        this.drawer.drawPeaks(peaks, maxPeak);

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
            my.drawer.loading(percentComplete);
        }, false);

        xhr.addEventListener('load', function (e) {
            my.drawer.loading(1);
            my.backend.loadData(
                e.target.response,
                my.drawBuffer.bind(my)
            );
        }, false);

        xhr.open('GET', url, true);
        xhr.send();
    },

    /**
     * Loads an audio file via drag'n'drop.
     */
    bindDragNDrop: function (dropTarget) {
        var my = this;
        var reader = new FileReader();
        reader.addEventListener('load', function (e) {
            my.backend.loadData(
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
        this.drawer.container.addEventListener('click', function (e) {
            var relX = e.offsetX;
            if (null == relX) { relX = e.layerX; }
            var progress = relX / my.drawer.width;

            my.seekTo(progress);
            my.fireEvent('click', progress);
        }, false);
    },

    normalizeProgress: function (progress, rounding) {
        rounding = rounding || this.drawer.width;
        return Math.round(progress * rounding) / rounding;
    },

    bindMarks: function () {
        var my = this;
        var markers = this.markers;

        this.on('progress', function (progress) {
            var normProgress = my.normalizeProgress(progress);

            Object.keys(markers).forEach(function (id) {
                var marker = markers[id];
                var normMark = my.normalizeProgress(marker.percentage);
                if (normMark == normProgress) {
                    my.fireEvent('mark', marker);
                }
            });
        });
    }
};

WaveSurfer.util = {
    extend: function (dest) {
        var sources = Array.prototype.slice.call(arguments, 1);
        sources.forEach(function (source) {
            Object.keys(source).forEach(function (key) {
                dest[key] = source[key];
            });
        });
        return dest;
    }
};

WaveSurfer.util.extend(WaveSurfer, Observer);
