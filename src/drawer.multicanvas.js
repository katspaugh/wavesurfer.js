'use strict';

WaveSurfer.Drawer.MultiCanvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.MultiCanvas, {

    initDrawer: function (params) {
        this.maxCanvasWidth = params.maxCanvasWidth != null ? params.maxCanvasWidth : 4000;
        this.maxCanvasElementWidth = Math.round(this.maxCanvasWidth / this.params.pixelRatio);

        if (this.maxCanvasWidth <= 1) {
            throw 'maxCanvasWidth must be greater than 1.';
        } else if (this.maxCanvasWidth % 2 == 1) {
            throw 'maxCanvasWidth must be an even number.';
        }

        this.hasProgressCanvas = this.params.waveColor != this.params.progressColor;
        this.halfPixel = 0.5 / this.params.pixelRatio;
        this.canvases = [];
    },

    createElements: function () {
        this.progressWave = this.wrapper.appendChild(
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 2,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden',
                width: '0',
                display: 'none',
                boxSizing: 'border-box',
                borderRightStyle: 'solid',
                borderRightWidth: this.params.cursorWidth + 'px',
                borderRightColor: this.params.cursorColor
            })
        );

        this.addCanvas();
    },

    updateSize: function () {
        var totalWidth = Math.round(this.width / this.params.pixelRatio),
            requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);

        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        for (var i in this.canvases) {
            // Add some overlap to prevent vertical white stripes, keep the width even for simplicity.
            var canvasWidth = this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);

            if (i == this.canvases.length - 1) {
                canvasWidth = this.width - (this.maxCanvasWidth * (this.canvases.length - 1));
            }

            this.updateDimensions(this.canvases[i], canvasWidth, this.height);
            this.clearWaveForEntry(this.canvases[i]);
        }
    },

     addCanvas: function () {
        var entry = {};
        var leftOffset = this.maxCanvasElementWidth * this.canvases.length;

        entry.wave = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 1,
                left: leftOffset + 'px',
                top: 0,
                bottom: 0
            })
        );
        entry.waveCtx = entry.wave.getContext('2d');

        if (this.hasProgressCanvas) {
            entry.progress = this.progressWave.appendChild(
                this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: 0,
                    bottom: 0
                })
            );
            entry.progressCtx = entry.progress.getContext('2d');
        }

        this.canvases.push(entry);
    },

    removeCanvas: function () {
        var lastEntry = this.canvases.pop();
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);
        if (this.hasProgressCanvas) {
            lastEntry.progress.parentElement.removeChild(lastEntry.progress);
        }
    },

    updateDimensions: function (entry, width, height) {
        var elementWidth = Math.round(width / this.params.pixelRatio);

        entry.waveCtx.canvas.width = width;
        entry.waveCtx.canvas.height = height;
        this.style(entry.waveCtx.canvas, { width: elementWidth + 'px'});

        this.style(this.progressWave, { display: 'block'});

        if (this.hasProgressCanvas) {
            entry.progressCtx.canvas.width = width;
            entry.progressCtx.canvas.height = height;
            this.style(entry.progressCtx.canvas, { width: elementWidth + 'px'});
        }
    },

    clearWave: function () {
        for (var i in this.canvases) {
            this.clearWaveForEntry(this.canvases[i]);
        }
    },

    clearWaveForEntry: function (entry) {
        entry.waveCtx.clearRect(0, 0, entry.waveCtx.canvas.width, entry.waveCtx.canvas.height);
        if (this.hasProgressCanvas) {
            entry.progressCtx.clearRect(0, 0, entry.progressCtx.canvas.width, entry.progressCtx.canvas.height);
        }
    },

    drawBars: function (peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            var channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawBars, this);
                return;
            } else {
                peaks = channels[0];
            }
        }

        // Bar wave draws the bottom only as a reflection of the top,
        // so we don't need negative values
        var hasMinVals = [].some.call(peaks, function (val) { return val < 0; });
        if (hasMinVals) {
            peaks = [].filter.call(peaks, function (_, index) { return index % 2 == 0; });
        }

        // A half-pixel offset makes lines crisp
        var width = this.width;
        var height = this.params.height * this.params.pixelRatio;
        var offsetY = height * channelIndex || 0;
        var halfH = height / 2;
        var length = peaks.length;
        var bar = this.params.barWidth * this.params.pixelRatio;
        var gap = Math.max(this.params.pixelRatio, ~~(bar / 2));
        var step = bar + gap;

        var absmax = 1;
        if (this.params.normalize) {
            absmax = WaveSurfer.util.max(peaks);
        }

        var scale = length / width;

        this.canvases[0].waveCtx.fillStyle = this.params.waveColor;
        if (this.canvases[0].progressCtx) {
            this.canvases[0].progressCtx.fillStyle = this.params.progressColor;
        }

        for (var i = 0; i < width; i += step) {
            var h = Math.round(peaks[Math.floor(i * scale)] / absmax * halfH);
            this.fillRect(i + this.halfPixel, halfH - h + offsetY, bar + this.halfPixel, h * 2);
        }
    },

    drawWave: function (peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            var channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawWave, this);
                return;
            } else {
                peaks = channels[0];
            }
        }

        // Support arrays without negative peaks
        var hasMinValues = [].some.call(peaks, function (val) { return val < 0; });
        if (!hasMinValues) {
            var reflectedPeaks = [];
            for (var i = 0, len = peaks.length; i < len; i++) {
                reflectedPeaks[2 * i] = peaks[i];
                reflectedPeaks[2 * i + 1] = -peaks[i];
            }
            peaks = reflectedPeaks;
        }

        // A half-pixel offset makes lines crisp
        var height = this.params.height * this.params.pixelRatio;
        var offsetY = height * channelIndex || 0;
        var halfH = height / 2;
        var length = ~~(peaks.length / this.canvases.length / 2);

        var absmax = 1;
        if (this.params.normalize) {
            var max = WaveSurfer.util.max(peaks);
            var min = WaveSurfer.util.min(peaks);
            absmax = -min > max ? -min : max;
        }

        this.drawLine(length, peaks, absmax, halfH, offsetY);

        // Always draw a median line
        this.fillRect(0, halfH + offsetY - this.halfPixel, this.width, this.halfPixel);
    },

    drawLine: function (length, peaks, absmax, halfH, offsetY) {
        for (var index in this.canvases) {
            var entry = this.canvases[index];

            this.setFillStyles(entry);

            this.drawLineToContext(entry.waveCtx, length, index, peaks, absmax, halfH, offsetY);
            this.drawLineToContext(entry.progressCtx, length, index, peaks, absmax, halfH, offsetY);
        }
    },

    drawLineToContext: function (ctx, length, index, peaks, absmax, halfH, offsetY) {
        if (!ctx) { return; }

        var scale = 1;
        if (this.params.fillParent && this.width != length) {
            scale = ctx.canvas.width / length;
        }

        var first = index * length,
            last = first + length + 1;

        ctx.beginPath();
        ctx.moveTo(this.halfPixel, halfH + offsetY);

        for (var i = first; i < last; i++) {
            var h = Math.round(peaks[2 * i] / absmax * halfH);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        for (var i = last - 1; i >= first; i--) {
            var h = Math.round(peaks[2 * i + 1] / absmax * halfH);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        ctx.closePath();
        ctx.fill();
    },

    fillRect: function (x, y, width, height) {
        for (var i in this.canvases) {
            var entry = this.canvases[i],
                leftOffset = i * this.maxCanvasWidth;

            var intersection = {
                x1: Math.max(x, i * this.maxCanvasWidth),
                y1: y,
                x2: Math.min(x + width, i * this.maxCanvasWidth + entry.waveCtx.canvas.width),
                y2: y + height
            };

            if (intersection.x1 < intersection.x2) {
                this.setFillStyles(entry);

                this.fillRectToContext(entry.waveCtx,
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1);

                this.fillRectToContext(entry.progressCtx,
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1);
            }
        }
    },

    fillRectToContext: function (ctx, x, y, width, height) {
        if (!ctx) { return; }
        ctx.fillRect(x, y, width, height);
    },

    setFillStyles: function (entry) {
        entry.waveCtx.fillStyle = this.params.waveColor;
        if (this.hasProgressCanvas) {
            entry.progressCtx.fillStyle = this.params.progressColor;
        }
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.params.pixelRatio;
        this.style(this.progressWave, { width: pos + 'px' });
    }
});
