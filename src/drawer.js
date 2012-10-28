'use strict';

WaveSurfer.Drawer = {
    init: function (params) {
        this.canvas = params.canvas;
        this.cursor = params.cursor;

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.cc = this.canvas.getContext('2d');

        if (params.color) {
            this.cc.fillStyle = params.color;
        }
    },

    drawBuffer: function (buffer) {
        // Frames per pixel
        var k = buffer.getChannelData(0).length / this.width;
        var slice = Array.prototype.slice;

        for (var i = 0; i < this.width; i++) {
            var sum = 0;
            for (var c = 0; c < buffer.numberOfChannels; c++) {
                var chan = buffer.getChannelData(c);
                var max = Math.max.apply(
                    Math, slice.call(chan, i * k, (i + 1) * k)
                );
                sum += max;
            }
            this.drawFrame(sum, i);
        }

        this.framesPerPx = k;
    },

    drawFrame: function (value, index) {
        var w = 1;
        var h = Math.round(value * this.height);

        var x = index;
        var y = Math.round((this.height - h) / 2);

        this.cc.fillRect(x, y, w, h);
    },

    drawCursor: function () {
        if (this.cursor) {
            this.cursor.style.left = this.cursorPos + 'px';
        }
    },

    setCursorPercent: function (percents) {
        var pos = Math.round(this.width * percents);
        if (this.cursorPos !== pos) {
            this.updateCursor(pos);
        }
    },

    updateCursor: function (pos) {
        this.cursorPos = pos;
        this.framePos = pos * this.framesPerPx;

        this.drawCursor();
    }
};
