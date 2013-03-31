'use strict';

WaveSurfer.Drawer = {
    defaultParams: {
        waveColor     : '#999',
        progressColor : '#333',
        cursorColor   : '#ddd',
        loadingColor  : '#999',
        loadingHeight : 1,
        cursorWidth   : 1,
        frameMargin   : 0,
        fillParent    : false
    },

    init: function (params) {
        var my = this;

        // extend params with defaults
        this.params = {};
        Object.keys(this.defaultParams).forEach(function (key) {
            my.params[key] = key in params ? params[key] :
                my.defaultParams[key];
        });

        var canvas = this.canvas = params.canvas;

        if (params.fillParent) {
            var parent = canvas.parentNode;
            canvas.setAttribute('width', parent.clientWidth);
            canvas.setAttribute('height', parent.clientHeight);
        }

        var $ = this.scale = window.devicePixelRatio;
        var w = canvas.clientWidth;
        var h = canvas.clientHeight;
        this.width = canvas.width = w * $;
        this.height = canvas.height = h * $;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        this.cc = canvas.getContext('2d');

        if (params.image) {
            this.loadImage(params.image, this.drawImage.bind(this));
        }

        if (!this.width || !this.height) {
            console.error('Canvas size is zero.');
        }
    },

    getPeaks: function (buffer) {
        // Frames per pixel
        var k = buffer.getChannelData(0).length / this.width;

        this.peaks = [];
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

    progress: function (percents) {
        this.cursorPos = ~~(this.width * percents);
        this.redraw();
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
        if (this.peaks) {
            this.peaks.forEach(function (peak, index) {
                my.drawFrame(index, peak, my.maxPeak);
            });
        // Or draw an image.
        } else if (this.image) {
            this.drawImage();
        }

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

    drawCursor: function () {
        var w = this.params.cursorWidth * this.scale;
        var h = this.height;

        var x = Math.min(this.cursorPos, this.width - w);
        var y = 0;

        this.cc.fillStyle = this.params.cursorColor;
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
        var width = Math.round(this.width * progress);

        var barHeight = this.params.loadingHeight * this.scale;
        var y = ~~(this.height - barHeight) / 2;

        this.cc.fillStyle = this.params.loadingColor;
        this.cc.fillRect(0, y, width, barHeight);
    }
};
