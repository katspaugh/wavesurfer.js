'use strict';

WaveSurfer.Drawer = {
    init: function (params) {
        this.canvas = params.canvas;
        this.cursor = params.cursor;

        if (params.predrawn) {
            this.width = this.canvas.clientWidth;
            this.height = this.canvas.clientHeight;
        } else {
            this.width = this.canvas.width;
            this.height = this.canvas.height;

            this.cc = this.canvas.getContext('2d');

            if (params.color) {
                this.cc.fillStyle = params.color;
            }
        }

        if (!this.width || !this.height) {
            console.error('Canvas size is zero.');
        }
    },

    getPeaks: function (buffer) {
        var my = this;

        // Frames per pixel
        var k = buffer.getChannelData(0).length / this.width;
        var slice = Array.prototype.slice;
        var sums = [];

        for (var i = 0; i < this.width; i++) {
            var sum = 0;
            for (var c = 0; c < buffer.numberOfChannels; c++) {
                var chan = buffer.getChannelData(c);
                var vals = slice.call(chan, i * k, (i + 1) * k);
                var peak = Math.max.apply(Math, vals.map(Math.abs));
                sum += peak;
            }
            sums[i] = sum;
        }

        return sums;
    },

    drawBuffer: function (buffer) {
        var my = this;
        var peaks = this.getPeaks(buffer);
        var maxPeak = Math.max.apply(Math, peaks);

        this.clear();

        peaks.forEach(function (peak, index) {
            my.drawFrame(index, peak, maxPeak);
        });

        my.cursor.style.display = 'none';
        setTimeout(function () {
            my.setCursorPercent(0);
            my.cursor.style.display = '';
        }, 30);
    },

    clear: function () {
        this.cc.clearRect(0, 0, this.width, this.height);
    },

    drawFrame: function (index, value, max) {
        var w = 1;
        var h = Math.round(value * (this.height / max));

        var x = index * w;
        var y = Math.round((this.height - h) / 2);

        this.cc.fillRect(x, y, w, h);
    },

    drawCursor: function () {
        if (this.cursor) {
            this.cursor.style.left = this.cursorPos + 'px';
        }
    },

    setCursorPercent: function (percents) {
        var pos = ~~(this.width * percents);

        if (this.cursorPos !== pos) {
            this.updateCursor(pos);
        }
    },

    updateCursor: function (pos) {
        this.cursorPos = pos;
        this.drawCursor();
    }
};
