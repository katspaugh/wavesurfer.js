import drawer from './drawer';
import * as util from './util';

export default util.extend({}, drawer, {
    initDrawer(params) {
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

    createElements() {
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

    updateSize() {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);
        let i;

        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        for (i in this.canvases) {
            // Add some overlap to prevent vertical white stripes, keep the width even for simplicity.
            let canvasWidth = this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);

            if (i == this.canvases.length - 1) {
                canvasWidth = this.width - (this.maxCanvasWidth * (this.canvases.length - 1));
            }

            this.updateDimensions(this.canvases[i], canvasWidth, this.height);
            this.clearWaveForEntry(this.canvases[i]);
        }
    },

    addCanvas() {
        const entry = {};
        const leftOffset = this.maxCanvasElementWidth * this.canvases.length;

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

    removeCanvas() {
        const lastEntry = this.canvases.pop();
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);
        if (this.hasProgressCanvas) {
            lastEntry.progress.parentElement.removeChild(lastEntry.progress);
        }
    },

    updateDimensions(entry, width, height) {
        const elementWidth = Math.round(width / this.params.pixelRatio);
        const totalWidth = Math.round(this.width / this.params.pixelRatio);

        // Where the canvas starts and ends in the waveform, represented as a decimal between 0 and 1.
        entry.start = (entry.waveCtx.canvas.offsetLeft / totalWidth) || 0;
        entry.end = entry.start + elementWidth / totalWidth;

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

    clearWave() {
        let i;
        for (i in this.canvases) {
            this.clearWaveForEntry(this.canvases[i]);
        }
    },

    clearWaveForEntry(entry) {
        entry.waveCtx.clearRect(0, 0, entry.waveCtx.canvas.width, entry.waveCtx.canvas.height);
        if (this.hasProgressCanvas) {
            entry.progressCtx.clearRect(0, 0, entry.progressCtx.canvas.width, entry.progressCtx.canvas.height);
        }
    },

    drawBars(peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawBars, this);
                return;
            }
            peaks = channels[0];
        }

        // Bar wave draws the bottom only as a reflection of the top,
        // so we don't need negative values
        const hasMinVals = [].some.call(peaks, val => val < 0);
        if (hasMinVals) {
            peaks = [].filter.call(peaks, (_, index) => index % 2 == 0);
        }

        // A half-pixel offset makes lines crisp
        const width = this.width;
        const height = this.params.height * this.params.pixelRatio;
        const offsetY = height * channelIndex || 0;
        const halfH = height / 2;
        const length = peaks.length;
        const bar = this.params.barWidth * this.params.pixelRatio;
        const gap = Math.max(this.params.pixelRatio, ~~(bar / 2));
        const step = bar + gap;

        let absmax = 1;
        if (this.params.normalize) {
            absmax = util.max(peaks);
        }

        const scale = length / width;
        let i;

        for (i = 0; i < width; i += step) {
            const h = Math.round(peaks[Math.floor(i * scale)] / absmax * halfH);
            this.fillRect(i + this.halfPixel, halfH - h + offsetY, bar + this.halfPixel, h * 2);
        }
    },

    drawWave(peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawWave, this);
                return;
            }
            peaks = channels[0];
        }

        // Support arrays without negative peaks
        const hasMinValues = [].some.call(peaks, val => val < 0);
        if (!hasMinValues) {
            const reflectedPeaks = [];
            let i;
            let len;
            for (i = 0, len = peaks.length; i < len; i++) {
                reflectedPeaks[2 * i] = peaks[i];
                reflectedPeaks[2 * i + 1] = -peaks[i];
            }
            peaks = reflectedPeaks;
        }

        // A half-pixel offset makes lines crisp
        const height = this.params.height * this.params.pixelRatio;
        const offsetY = height * channelIndex || 0;
        const halfH = height / 2;

        let absmax = 1;
        if (this.params.normalize) {
            const max = util.max(peaks);
            const min = util.min(peaks);
            absmax = -min > max ? -min : max;
        }

        this.drawLine(peaks, absmax, halfH, offsetY);

        // Always draw a median line
        this.fillRect(0, halfH + offsetY - this.halfPixel, this.width, this.halfPixel);
    },

    drawLine(peaks, absmax, halfH, offsetY) {
        let i;
        for (i in this.canvases) {
            const entry = this.canvases[i];

            this.setFillStyles(entry);

            this.drawLineToContext(entry, entry.waveCtx, peaks, absmax, halfH, offsetY);
            this.drawLineToContext(entry, entry.progressCtx, peaks, absmax, halfH, offsetY);
        }
    },

    drawLineToContext(entry, ctx, peaks, absmax, halfH, offsetY) {
        if (!ctx) { return; }

        const length = peaks.length / 2;

        let scale = 1;
        if (this.params.fillParent && this.width != length) {
            scale = this.width / length;
        }

        const first = Math.round(length * entry.start);
        const last = Math.round(length * entry.end);
        let i;
        let j;

        ctx.beginPath();
        ctx.moveTo(this.halfPixel, halfH + offsetY);

        for (i = first; i < last; i++) {
            const h = Math.round(peaks[2 * i] / absmax * halfH);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        for (j = last - 1; j >= first; j--) {
            const k = Math.round(peaks[2 * j + 1] / absmax * halfH);
            ctx.lineTo((j - first) * scale + this.halfPixel, halfH - k + offsetY);
        }

        ctx.closePath();
        ctx.fill();
    },

    fillRect(x, y, width, height) {
        let i;
        for (i in this.canvases) {
            const entry = this.canvases[i];
            const leftOffset = i * this.maxCanvasWidth;

            const intersection = {
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

    fillRectToContext(ctx, x, y, width, height) {
        if (!ctx) { return; }
        ctx.fillRect(x, y, width, height);
    },

    setFillStyles(entry) {
        entry.waveCtx.fillStyle = this.params.waveColor;
        if (this.hasProgressCanvas) {
            entry.progressCtx.fillStyle = this.params.progressColor;
        }
    },

    updateProgress(progress) {
        const pos = Math.round(
            this.width * progress
        ) / this.params.pixelRatio;
        this.style(this.progressWave, { width: pos + 'px' });
    }
});
