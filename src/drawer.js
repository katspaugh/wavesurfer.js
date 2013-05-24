'use strict';

WaveSurfer.Drawer = {
    defaultParams: {
        waveColor     : '#999',
        progressColor : '#333',
        cursorColor   : '#ddd',
        markerColor   : '#eee',
        loadingColor  : '#999',
        cursorWidth   : 1,
        loadPercent   : false,
        loadingBars   : 20,
        barHeight     : 1,
        barMargin     : 10,
        markerWidth   : 1,
        frameMargin   : 0,
        fillParent    : false,
        maxSecPerPx   : false,
        scrollParent  : false
    },

    scale: window.devicePixelRatio,

    init: function (params) {
        var my = this;

        // extend params with defaults
        this.params = {};
        Object.keys(this.defaultParams).forEach(function (key) {
            my.params[key] = key in params ? params[key] :
                my.defaultParams[key];
        });

        this.peaks = [];
        this.markers = {};
        this.maxPeak = 128;

        this.canvas = params.canvas;
        this.parent = this.canvas.parentNode;

        if (params.fillParent && !params.scrollParent) {
            var style = this.canvas.style;
            style.width = this.parent.clientWidth + 'px';
            style.height = this.parent.clientHeight + 'px';
        }

        this.prepareContext();

        if (params.image) {
            this.loadImage(params.image, this.drawImage.bind(this));
        }
    },

    setMinWidth: function (width) {
        if (width <= this.width) { return; }

        if (width > this.parent.clientWidth) {
            this.params.scrollParent = true;
        }

        this.canvas.style.width = width + 'px';
        this.prepareContext();
    },

    prepareContext: function() {
        var canvas = this.canvas;

        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        this.width = canvas.width = w * this.scale;
        this.height = canvas.height = h * this.scale;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        this.cc = canvas.getContext('2d');

        if (!this.width || !this.height) {
            console.error('Canvas size is zero.');
        }
    },

    getPeaks: function (buffer) {
        var frames = buffer.getChannelData(0).length;
        // Frames per pixel
        var k = frames / this.width;

        var maxSecPerPx = this.params.maxSecPerPx;
        if (maxSecPerPx) {
            var secPerPx = k / buffer.sampleRate;
            if (secPerPx > maxSecPerPx) {
                var targetWidth = Math.ceil(
                    frames / maxSecPerPx / buffer.sampleRate / this.scale
                );
                this.canvas.style.width = targetWidth + 'px';
                this.prepareContext();
                k = frames / this.width;
            }
        }

        this.maxPeak = -Infinity;

        for (var i = 0; i < this.width; i++) {
            var sum = 0;
            for (var c = 0; c < buffer.numberOfChannels; c++) {
                var chan = buffer.getChannelData(c);
                var vals = chan.subarray(i * k, (i + 1) * k);
                var peak = -Infinity;
                for (var p = 0, l = vals.length; p < l; p++) {
                    var val = Math.abs(vals[p]);
                    if (val > peak){
                        peak = val;
                    }
                }
                sum += peak;
            }
            this.peaks[i] = sum;

            if (sum > this.maxPeak) {
                this.maxPeak = sum;
            }
        }

        this.maxPeak *= 1 + this.params.frameMargin;
    },

    setCursor: function (percents) {
        this.cursorPos = ~~(this.width * percents);
    },

    progress: function (percents) {
        this.setCursor(percents);
        this.redraw();

        if (this.params.scrollParent) {
            this.recenterOnPosition(this.cursorPos);
        }
    },

    recenter: function(percent) {
        var position = ~~(this.width * percent);
        this.recenterOnPosition(position, true);
    },

    recenterOnPosition: function(position, immediate) {
        var half = this.parent.clientWidth / 2;
        var target = position - half;
        var offset = target - this.parent.scrollLeft;

        // if the cursor is currently visible...
        if (!immediate && offset >= -half && offset < half) {
            // we'll limit the "re-center" rate.
            var rate = 5;
            offset = Math.max(-rate, Math.min(rate, offset));
            target = this.parent.scrollLeft + offset;
        }

        this.canvas.parentNode.scrollLeft = ~~target;
    },

    drawBuffer: function (buffer) {
        this.getPeaks(buffer);
        this.progress(0);
    },

    /**
     * Redraws the entire canvas on each audio frame.
     */
    redraw: function () {
        var my = this;

        this.clear();

        // Draw WebAudio buffer peaks.
        if (this.peaks.length) {
            this.peaks.forEach(function (peak, index) {
                my.drawFrame(index, peak, my.maxPeak);
            });
        // Or draw an image.
        } else if (this.image) {
            this.drawImage();
        }

        // Draw markers.
        Object.keys(this.markers).forEach(function (key) {
            var marker = my.markers[key];
            var percentage = ~~(my.width * marker.percentage);
            my.drawMarker(percentage, marker.width, marker.color);
        });

        this.drawCursor();
    },

    clear: function () {
        this.cc.clearRect(0, 0, this.width, this.height);
    },

    drawFrame: function (index, value, max) {
        var w = 1;
        var h = Math.round(value * (this.height / max));

        var x = index * w;
        var y = Math.round((this.height - h) / 2);

        if (this.cursorPos >= x) {
            this.cc.fillStyle = this.params.progressColor;
        } else {
            this.cc.fillStyle = this.params.waveColor;
        }

        this.cc.fillRect(x, y, w, h);
    },

    drawStreamFrame: function (data, percentage) {
        var index = ~~(this.width * percentage);

        if (null == this.peaks[index]) {
            var max = -Infinity;
            for (var i = 0, len = data.length; i < len; i++) {
                var val = data[i];
                if (val > max) { max = val; }
            }
            this.peaks[index] = max - 128 || 1;
        }
        this.redraw();
    },

    drawCursor: function () {
        this.drawMarker(
            this.cursorPos,
            this.params.cursorWidth,
            this.params.cursorColor
        );
    },

    drawMarker: function (position, width, color) {
        width = width || this.params.markerWidth;
        color = color || this.params.markerColor;

        var w = width * this.scale;
        var h = this.height;

        var x = Math.min(position, this.width - w);
        var y = 0;

        this.cc.fillStyle = color;
        this.cc.fillRect(x, y, w, h);
    },

    /**
     * Loads and caches an image.
     */
    loadImage: function (url, callback) {
        var my = this;
        var img = document.createElement('img');
        var onLoad = function () {
            img.removeEventListener('load', onLoad);
            my.image = img;
            callback(img);
        };
        img.addEventListener('load', onLoad, false);
        img.src = url;
    },

    /**
     * Draws a pre-drawn waveform image.
     */
    drawImage: function () {
        var cc = this.cc;
        cc.drawImage(this.image, 0, 0, this.width, this.height);
        cc.save();
        cc.globalCompositeOperation = 'source-atop';
        cc.fillStyle = this.params.progressColor;
        cc.fillRect(0, 0, this.cursorPos, this.height);
        cc.restore();
    },

    drawLoading: function (progress) {
        var barHeight = this.params.barHeight * this.scale;
        var y = ~~(this.height - barHeight) / 2;

        this.cc.fillStyle = this.params.loadingColor;

        if (this.params.loadPercent) {
            var width = Math.round(this.width * progress);
            this.cc.fillRect(0, y, width, barHeight);
            return;
        }

        var bars = this.params.loadingBars;
        var margin = this.params.barMargin * this.scale;
        var barWidth = ~~(this.width / bars) - margin;
        var progressBars = ~~(bars * progress);

        for (var i = 0; i < progressBars; i += 1) {
            var x = i * barWidth + i * margin;
            this.cc.fillRect(x, y, barWidth, barHeight);
        }
    }
};
