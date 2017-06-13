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
        ['progressWave', 'wave'].forEach(function (waveType) {
            this[waveType] = this.wrapper.appendChild(
                this.style(document.createElement('wave'), Object.assign({}, this.params.styleList[waveType], {
                    position: 'absolute',
                    zIndex: 2,
                    left: 0,
                    top: 0,
                    height: '100%',
                    overflow: 'hidden',
                    width: (waveType == 'progressWave') ? '0' : '100%',
                    boxSizing: 'border-box',
                    pointerEvents: 'none'
                }))
            );
            this[waveType].classList.add(this.params.classList[waveType]);
            if (waveType == 'progressWave') { this[waveType].style.display = 'none'; }
        }, this);
        this.cursor = this.wrapper.appendChild(
            this.style(document.createElement('div'), {
                backgroundColor: this.params.cursorColor,
                position: 'absolute',
                zIndex: 2,
                width: this.params.cursorWidth + 'px',
                height: '100%',
                left: 0,
                display: 'none'
            })
        );
        this.addCanvas();
    },

    updateSize: function () {
        var totalWidth = Math.round(this.width / this.params.pixelRatio);
        var requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);

        while (this.canvases.length < requiredCanvases) { this.addCanvas(); }
        while (this.canvases.length > requiredCanvases) { this.removeCanvas(); }

        this.canvases.forEach (function (canvas, i) {
            // Add some overlap to prevent vertical white stripes; keep the width even for simplicity.
            if (i != this.canvases.length - 1) {
                var canvasWidth = this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);
            } else {
                var canvasWidth = this.width - (this.maxCanvasWidth * (this.canvases.length - 1));
            }
            this.updateDimensions(canvas, canvasWidth, this.height);
            this.clearWaveType(canvas);
        }, this);
    },

    addCanvas: function () {
        var entry = {};
        var leftOffset = this.maxCanvasElementWidth * this.canvases.length;
        ['progressWave', 'wave'].forEach (function (waveType) {
            entry[waveType] = this[waveType].appendChild(
                this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: !this.invertTransparency ? 0 : -(this.halfPixel / 2) + 'px', // Add a small buffer to prevent gaps.
                    height: !this.invertTransparency ? '100%' : 'calc(100% + ' + this.halfPixel + 'px)'
                }));
            entry[waveType + 'Ctx'] = entry[waveType].getContext('2d');
        }, this);
        this.canvases.push(entry);
    },

    removeCanvas: function () {
        var lastEntry = this.canvases.pop();
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);
        if (lastEntry.progressWave) { lastEntry.progressWave.parentElement.removeChild(lastEntry.progressWave); }
    },

    updateDimensions: function (canvas, width, height) {
        var elementWidth = Math.round(width / this.params.pixelRatio);
        var totalWidth   = Math.round(this.width / this.params.pixelRatio);

        // Specify where the canvas starts and ends in the waveform, represented as a decimal between 0 and 1.
        canvas.start = (canvas.waveCtx.canvas.offsetLeft / totalWidth) || 0;
        canvas.end = canvas.start + elementWidth / totalWidth;

        canvas.waveCtx.canvas.width = width;
        canvas.waveCtx.canvas.height = height;

        this.style(this.wave, {height: height / this.params.pixelRatio + 'px'});
        this.style(canvas.waveCtx.canvas, {width: elementWidth + 'px'});
        this.style(this.cursor, {display: 'block'});

        if (!canvas.progressWaveCtx) { return; }
        this.style(this.progressWave, {height: height / this.params.pixelRatio + 'px'});
        canvas.progressWaveCtx.canvas.width  = width;
        canvas.progressWaveCtx.canvas.height = height;
        this.style(canvas.progressWaveCtx.canvas, {width: elementWidth + 'px'});
        this.style(this.progressWave, {display: 'block'});
    },

    clearCanvas: function () {
        this.canvases.forEach (function (canvas) { this.clearWaveType(canvas); }, this);
    },

    clearWaveType: function (canvas) {
        canvas.waveCtx.clearRect(0, 0, canvas.waveCtx.canvas.width, canvas.waveCtx.canvas.height);
        if (!canvas.progressWaveCtx) { return; }
        canvas.progressWaveCtx.clearRect(0, 0, canvas.progressWaveCtx.canvas.width, canvas.progressWaveCtx.canvas.height);
    },

    routeAndClear: function (functionName, peaks, start, end) {
        // Split channels if they exist.
        if (this.params.splitChannels) {
            var channels = peaks;
            this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
            channels.forEach(function(channelPeaks, i) { this[functionName](channelPeaks, i, start, end); }, this);
            return;
        }
        // Extract peaks if they are in an array.
        if (peaks[0] instanceof Array) {peaks = peaks[0]; }

        this.clearCanvas();
    },

    drawBars: WaveSurfer.util.frame(function (peaks, channelIndex, start, end) {
        // Split channels if they exist, extract peaks if they are in an array, and clear the canvas.
        this.routeAndClear ('drawBars', peaks, start, end);

        // Bar wave draws the bottom only as a reflection of the top,
        // so we don't need negative values.
        var hasMinVals = [].some.call(peaks, function (val) {return val < 0;});

        // Skip every other value if there are negatives.
        var peakIndexScale = (hasMinVals) ? 2 : 1;

        // A half-pixel offset makes lines crisp.
        var height = this.params.height * this.params.pixelRatio;
        var offsetY = height * channelIndex || 0;
        var halfH = height / 2;

        var length = peaks.length / peakIndexScale;
        var bar = this.params.barWidth * this.params.pixelRatio;
        var gap = Math.max(this.params.pixelRatio, ~~(bar / 2));
        var step = bar + gap;

        if (!this.params.normalize) {
            var absmax = 1 / this.params.barHeight;
        } else {
            var max = WaveSurfer.util.max(peaks);
            var min = WaveSurfer.util.min(peaks);
            var absmax = -min > max ? -min : max;
        }

        var scale = length / this.width;

        for (var i = (start / scale); i < (end / scale); i += step) {
            var peak = peaks[Math.floor(i * scale * peakIndexScale)] || 0;
            var h = Math.round(peak / absmax * halfH);
            this.fillRect(i + this.halfPixel, halfH - h + offsetY, bar + this.halfPixel, h * 2);
        }

        if (this.params.invertTransparency) { this.invertTransparency(); }
    }),

    drawWave: WaveSurfer.util.frame(function (peaks, channelIndex, start, end) {
        // Split channels if they exist, extract peaks if they are in an array, and clear the canvas.
        this.routeAndClear ('drawWave', peaks, start, end);

        // Support arrays without negative peaks.
        var hasMinValues = [].some.call(peaks, function (val) { return val < 0; });
        if (!hasMinValues) {
            var reflectedPeaks = [];
            for (var i = 0, len = peaks.length; i < len; i++) {
                reflectedPeaks[2 * i] = peaks[i];
                reflectedPeaks[2 * i + 1] = -peaks[i];
            }
            peaks = reflectedPeaks;
        }

        // A half-pixel offset makes lines crisp.
        var height = this.params.height * this.params.pixelRatio;
        var offsetY = height * channelIndex || 0;
        var halfH = height / 2;

        if (!this.params.normalize) {
            var absmax = 1 / this.params.barHeight;
        } else {
            var max = WaveSurfer.util.max(peaks);
            var min = WaveSurfer.util.min(peaks);
            var absmax = -min > max ? -min : max;
        }

        this.drawLine(peaks, absmax, halfH, offsetY, start, end);

        // Always draw a median line.
        this.fillRect(0, halfH + offsetY - this.halfPixel, this.width, this.halfPixel);

        if (this.params.invertTransparency) { this.invertTransparency(); }
    }),

    invertTransparency: function () {
        this.canvases.forEach (function (canvasGroup) {
            ['wave'].concat(canvasGroup.progressWaveCtx ? ['progressWave'] : []).forEach (function (waveType) {
                // Draw the wave canvas onto a new empty canvas.
                var canvas = canvasGroup[waveType];
                var temp = document.createElement('canvas');
                temp.width = canvas.width; temp.height = canvas.height;
                temp.getContext('2d').drawImage (canvas, 0, 0);
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = (waveType == 'wave' || this.params.progressColor === undefined) ? this.params.waveColor : this.params.progressColor;
                // Draw a rectangle onto the wave canvas to fill it with a certain color.
                ctx.globalCompositeOperation = 'copy';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Cut out the wave shape from the rectangle and reset globalCompositeOperation.
                ctx.globalCompositeOperation = 'destination-out';
                ctx.drawImage (temp, 0, 0);
                ctx.globalCompositeOperation = 'source-over';
            }, this);
        }, this);
    },

    drawLine: function (peaks, absmax, halfH, offsetY, start, end) {
        this.canvases.forEach (function (canvas) {
            this.setFillStyles(canvas);
            this.drawLineToContext(canvas, canvas.waveCtx, peaks, absmax, halfH, offsetY, start, end);
            this.drawLineToContext(canvas, canvas.progressWaveCtx, peaks, absmax, halfH, offsetY, start, end);
        }, this);
    },

    drawLineToContext: function (canvas, ctx, peaks, absmax, halfH, offsetY, start, end) {
        if (!ctx) { return; }

        var length = peaks.length / 2;

        var scale = 1;
        if (this.params.fillParent && this.width != length) { scale = this.width / length; }

        var first = Math.round(length * canvas.start);
        var last = Math.round(length * canvas.end);
        if (first > end || last < start) { return; }

        var canvasStart = Math.max(first, start);
        var canvasEnd = Math.min(last, end);

        ctx.beginPath();
        ctx.moveTo((canvasStart - first) * scale + this.halfPixel, halfH + offsetY);

        for (var i = canvasStart; i < canvasEnd; i++) {
            var peak = peaks[2 * i] || 0;
            var h = Math.round(peak / absmax * halfH);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        for (var i = canvasEnd - 1; i >= canvasStart; i--) {
            var peak = peaks[2 * i + 1] || 0;
            var h = Math.round(peak / absmax * halfH);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        ctx.closePath();
        ctx.fill();
    },

    fillRect: function (x, y, width, height) {
        var startCanvas = Math.floor(x / this.maxCanvasWidth);
        var endCanvas   = Math.min(Math.ceil((x + width) / this.maxCanvasWidth) + 1, this.canvases.length);

        for (var i = startCanvas; i < endCanvas; i++) {
            var canvas = this.canvases[i];
            var leftOffset = i * this.maxCanvasWidth;

            var intersection = {
                x1: Math.max(x, i * this.maxCanvasWidth),
                y1: y,
                x2: Math.min(x + width, i * this.maxCanvasWidth + canvas.waveCtx.canvas.width),
                y2: y + height
            };

            if (intersection.x1 < intersection.x2) {
                this.setFillStyles(canvas);
                ['wave'].concat(canvas.progressWaveCtx ? ['progressWave'] : []).forEach (function (waveType) {
                    this.fillRectToContext(canvas[waveType + 'Ctx'],
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1);
               }, this);
            }
        }
    },

    fillRectToContext: function (ctx, x, y, width, height) {
        if (ctx) { ctx.fillRect(x, y, width, height); }
    },

    setFillStyles: function (canvas) {
        if (this.invertTransparency) { var cutColor = ('cutColor' in this.invertTransparency) ? this.invertTransparency.cutColor : '#fefefe'; }
        canvas.waveCtx.fillStyle = this.invertTransparency ? cutColor : this.params.waveColor;
        if (canvas.progressWaveCtx) { canvas.progressWaveCtx.fillStyle = this.invertTransparency ? cutColor : this.params.progressColor; }
    },

    updateProgress: function (pos) {
        this.style(this.wave, { left: pos + 'px', width: 'calc(100% - ' + pos + 'px)' });
        this.canvases.forEach (function (canvas, i) {
            this.style(canvas.wave, { left: -pos + 'px' });
        }, this);
        var cursorPos = pos - ((this.params.cursorAlignment == 'right') ? 0
            : (this.params.cursorAlignment == 'middle') ? (this.params.cursorWidth / 2)
            : this.params.cursorWidth);
        this.style(this.cursor, { left: cursorPos + 'px' });
        if (this.progressWave) { this.style(this.progressWave, { width: pos + 'px' }); }
    },

    /**
     * Combine all available canvases together.
     *
     * @param {String} type - an optional value of a format type. Default is image/png.
     * @param {Number} quality - an optional value between 0 and 1. Default is 0.92.
     *
     */
    getImage: function (type, quality) {
        var availableCanvas = [];
        this.canvases.forEach(function (canvas) {
            availableCanvas.push(canvas.wave.toDataURL(type, quality));
        });
        return availableCanvas.length > 1 ? availableCanvas : availableCanvas[0];
    }
});
