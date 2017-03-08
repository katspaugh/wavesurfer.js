import Drawer from './drawer';
import * as util from './util';

/**
 * @typedef {Object} CanvasEntry
 * @private
 * @property {HTMLElement} wave The wave node
 * @property {CanvasRenderingContext2D} waveCtx The canvas rendering context
 * @property {?HTMLElement} progress The progress wave node
 * @property {?CanvasRenderingContext2D} progressCtx The progress wave canvas
 * rendering context
 * @property {?number} start Start of the area the canvas should render, between 0 and 1
 * @property {?number} end End of the area the canvas should render, between 0 and 1
 */

/**
 * MultiCanvas renderer for wavesurfer. Is currently the default and sole built
 * in renderer.
 */
export default class MultiCanvas extends Drawer {
    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    constructor(container, params) {
        super(container, params);
        /**
         * @type {number}
         * @private
         */
        this.maxCanvasWidth = params.maxCanvasWidth;
        /**
         * @private
         * @type {number}
         */
        this.maxCanvasElementWidth = Math.round(params.maxCanvasWidth / params.pixelRatio);

        /**
         * Whether or not the progress wave is renderered. If the `waveColor`
         * and `progressColor` are the same colour it is not.
         * @type {boolean}
         */
        this.hasProgressCanvas = params.waveColor != params.progressColor;
        /**
         * @private
         * @type {number}
         */
        this.halfPixel = 0.5 / params.pixelRatio;
        /**
         * @private
         * @type {Array}
         */
        this.canvases = [];
        /** @private */
        this.progressWave = null;
    }

    /**
     * Initialise the drawer
     */
    init() {
        this.createWrapper();
        this.createElements();
    }

    /**
     * Create the canvas elements and style them
     *
     * @private
     */
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
    }

    /**
     * Adjust to the updated size by adding or removing canvases
     */
    updateSize() {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);

        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        this.canvases.forEach((entry, i) => {
            // Add some overlap to prevent vertical white stripes, keep the width even for simplicity.
            let canvasWidth = this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);

            if (i == this.canvases.length - 1) {
                canvasWidth = this.width - (this.maxCanvasWidth * (this.canvases.length - 1));
            }

            this.updateDimensions(entry, canvasWidth, this.height);
            this.clearWaveForEntry(entry);
        });
    }

    /**
     * Add a canvas to the canvas list
     *
     * @private
     */
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
    }

    /**
     * Pop one canvas from the list
     *
     * @private
     */
    removeCanvas() {
        const lastEntry = this.canvases.pop();
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);
        if (this.hasProgressCanvas) {
            lastEntry.progress.parentElement.removeChild(lastEntry.progress);
        }
    }

    /**
     * Update the dimensions of a canvas element
     *
     * @private
     * @param {CanvasEntry} entry
     * @param {number} width The new width of the element
     * @param {number} height The new height of the element
     */
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
    }

    /**
     * Clear the whole waveform
     */
    clearWave() {
        this.canvases.forEach(entry => this.clearWaveForEntry(entry));
    }

    /**
     * Clear one canvas
     *
     * @private
     * @param {CanvasEntry} entry
     */
    clearWaveForEntry(entry) {
        entry.waveCtx.clearRect(0, 0, entry.waveCtx.canvas.width, entry.waveCtx.canvas.height);
        if (this.hasProgressCanvas) {
            entry.progressCtx.clearRect(0, 0, entry.progressCtx.canvas.width, entry.progressCtx.canvas.height);
        }
    }

    /**
     * Draw a waveform with bars
     *
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0. Must be an integer.
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that should be
     * rendered
     */
    drawBars(peaks, channelIndex, start, end) {
        // Split channels
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach((channelPeaks, i) => this.drawBars(channelPeaks, i, start, end));
                return;
            }
            peaks = channels[0];
        }

        // Bar wave draws the bottom only as a reflection of the top,
        // so we don't need negative values
        const hasMinVals = [].some.call(peaks, val => val < 0);
        // Skip every other value if there are negatives.
        const peakIndexScale = hasMinVals ? 2 : 1;

        // A half-pixel offset makes lines crisp
        const width = this.width;
        const height = this.params.height * this.params.pixelRatio;
        const offsetY = height * channelIndex || 0;
        const halfH = height / 2;
        const length = peaks.length / peakIndexScale;
        const bar = this.params.barWidth * this.params.pixelRatio;
        const gap = Math.max(this.params.pixelRatio, ~~(bar / 2));
        const step = bar + gap;

        let absmax = 1;
        if (this.params.normalize) {
            const max = util.max(peaks);
            const min = util.min(peaks);
            absmax = -min > max ? -min : max;
        }

        const scale = length / width;
        let i;

        for (i = (start / scale); i < (end / scale); i += step) {
            const peak = peaks[Math.floor(i * scale * peakIndexScale)] || 0;
            const h = Math.round(peak / absmax * halfH);
            this.fillRect(i + this.halfPixel, halfH - h + offsetY, bar + this.halfPixel, h * 2);
        }
    }

    /**
     * Draw a waveform
     *
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that should be
     * rendered
     */
    drawWave(peaks, channelIndex, start, end) {
        // Split channels
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach((channelPeaks, i) => this.drawWave(channelPeaks, i, start, end));
                return;
            }
            peaks = channels[0];
        }

        // Support arrays without negative peaks
        const hasMinValues = [].some.call(peaks, val => val < 0);
        if (!hasMinValues) {
            const reflectedPeaks = [];
            const len = peaks.length;
            let i;
            for (i = 0; i < len; i++) {
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

        this.drawLine(peaks, absmax, halfH, offsetY, start, end);

        // Always draw a median line
        this.fillRect(0, halfH + offsetY - this.halfPixel, this.width, this.halfPixel);
    }

    /**
     * Tell the canvas entries to render their portion of the waveform
     *
     * @private
     * @param {number[]} peaks Peak data
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     */
    drawLine(peaks, absmax, halfH, offsetY, start, end) {
        this.canvases.forEach(entry => {
            this.setFillStyles(entry);
            this.drawLineToContext(entry, entry.waveCtx, peaks, absmax, halfH, offsetY, start, end);
            this.drawLineToContext(entry, entry.progressCtx, peaks, absmax, halfH, offsetY, start, end);
        });
    }

    /**
     * Render the actual waveform line on a canvas
     *
     * @private
     * @param {CanvasEntry} entry
     * @param {Canvas2DContextAttributes} ctx Essentially `entry.[wave|progress]Ctx`
     * @param {number[]} peaks
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     */
    drawLineToContext(entry, ctx, peaks, absmax, halfH, offsetY, start, end) {
        if (!ctx) { return; }

        const length = peaks.length / 2;

        let scale = 1;
        if (this.params.fillParent && this.width != length) {
            scale = this.width / length;
        }

        const first = Math.round(length * entry.start);
        const last = Math.round(length * entry.end);
        if (first > end || last < start) { return; }
        const canvasStart = Math.max(first, start);
        const canvasEnd = Math.min(last, end);
        let i;
        let j;

        ctx.beginPath();
        ctx.moveTo((canvasStart - first) * scale + this.halfPixel, halfH + offsetY);

        for (i = canvasStart; i < canvasEnd; i++) {
            const peak = peaks[2 * i] || 0;
            const h = Math.round(peak / absmax * halfH);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        for (j = canvasEnd - 1; j >= canvasStart; j--) {
            const peak = peaks[2 * j + 1] || 0;
            const h = Math.round(peak / absmax * halfH);
            ctx.lineTo((j - first) * scale + this.halfPixel, halfH - h + offsetY);
        }

        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draw a rectangle on the waveform
     *
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x, y, width, height) {
        const startCanvas = Math.floor(x / this.maxCanvasWidth);
        const endCanvas = Math.min(
          Math.ceil((x + width) / this.maxCanvasWidth) + 1,
          this.canvases.length
        );
        let i;
        for (i = startCanvas; i < endCanvas; i++) {
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
    }

    /**
     * Draw the actual rectangle on a canvas
     *
     * @private
     * @param {Canvas2DContextAttributes} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRectToContext(ctx, x, y, width, height) {
        if (!ctx) { return; }
        ctx.fillRect(x, y, width, height);
    }

    /**
     * Set the fill styles for a certain entry (wave and progress)
     *
     * @private
     * @param {CanvasEntry} entry
     */
    setFillStyles(entry) {
        entry.waveCtx.fillStyle = this.params.waveColor;
        if (this.hasProgressCanvas) {
            entry.progressCtx.fillStyle = this.params.progressColor;
        }
    }

    /**
     * Return image data of the waveform
     *
     * @param {string} type='image/png' An optional value of a format type.
     * @param {number} quality=0.92 An optional value between 0 and 1.
     * @return {string|string[]} images A data URL or an array of data URLs
     */
    getImage(type, quality) {
        const images = this.canvases.map(entry => entry.wave.toDataURL(type, quality));
        return images.length > 1 ? images : images[0];
    }

    /**
     * Render the new progress
     *
     * @param {number} position X-Offset of progress position in pixels
     */
    updateProgress(position) {
        this.style(this.progressWave, { width: position + 'px' });
    }
}
