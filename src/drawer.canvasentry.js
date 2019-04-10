/**
 * @since 2.3.0
 */

import style from './util/style';
import getId from './util/get-id';

export default class CanvasEntry {
    constructor() {
        /**
         * The wave node
         *
         * @type {HTMLElement}
         * @private
         */
        this.wave = null;
        /**
         * The wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         * @private
         */
        this.waveCtx = null;
        /**
         * The (optional) progress wave node
         *
         * @type {HTMLElement}
         * @private
         */
        this.progress = null;
        /**
         * The progress wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         * @private
         */
        this.progressCtx = null;
        /**
         * Start of the area the canvas should render, between 0 and 1
         *
         * @type {number}
         * @private
         */
        this.start = 0;
        /**
         * End of the area the canvas should render, between 0 and 1
         *
         * @type {number}
         * @private
         */
        this.end = 1;
        /**
         * Unique identifier for this entry.
         *
         * @type {string}
         * @private
         */
        this.id = getId();
    }

    /**
     * Create the wave canvas and 2D rendering context
     */
    createWave(element) {
        this.wave = element;
        this.waveCtx = this.wave.getContext('2d');
    }

    /**
     * Create the progress canvas and 2D rendering context
     */
    createProgress(element) {
        this.progress = element;
        this.progressCtx = this.progress.getContext('2d');
    }

    /**
     * Update the dimensions
     *
     * @param {number} elementWidth
     * @param {number} totalWidth
     * @param {number} width The new width of the element
     * @param {number} height The new height of the element
     */
    updateDimensions(elementWidth, totalWidth, width, height) {
        // Where the canvas starts and ends in the waveform, represented as a
        // decimal between 0 and 1.
        this.start = this.wave.offsetLeft / totalWidth || 0;
        this.end = this.start + elementWidth / totalWidth;

        // set wave canvas dimensions
        this.wave.width = width;
        this.wave.height = height;
        style(this.wave, { width: elementWidth + 'px' });

        if (this.hasProgressCanvas) {
            // set progress canvas dimensions
            this.progress.width = width;
            this.progress.height = height;
            style(this.progress, {
                width: elementWidth + 'px'
            });
        }
    }

    /**
     * Clear the wave and progress rendering contexts
     */
    clearWave() {
        // wave
        this.waveCtx.clearRect(
            0,
            0,
            this.waveCtx.canvas.width,
            this.waveCtx.canvas.height
        );

        // progress
        if (this.hasProgressCanvas) {
            this.progressCtx.clearRect(
                0,
                0,
                this.progressCtx.canvas.width,
                this.progressCtx.canvas.height
            );
        }
    }

    /**
     * Set the fill styles for wave and progress
     *
     * @param {string} waveColor Fill color for the wave canvas
     * @param {?string} progressColor Fill color for the progress canvas
     */
    setFillStyles(waveColor, progressColor) {
        this.waveCtx.fillStyle = waveColor;

        if (this.hasProgressCanvas) {
            this.progressCtx.fillStyle = progressColor;
        }
    }

    /**
     * Draw a rectangle for wave and progress
     *
     * @param {number} x X start position
     * @param {number} y Y start position
     * @param {number} width Width of the rectangle
     * @param {number} height Height of the rectangle
     */
    fillRects(x, y, width, height) {
        this.fillRectToContext(this.waveCtx);
        this.fillRectToContext(this.progressCtx);
    }

    /**
     * Draw the actual rectangle on a canvas
     *
     * @private
     * @param {CanvasRenderingContext2D} ctx Rendering context of target canvas
     * @param {number} x X start position
     * @param {number} y Y start position
     * @param {number} width Width of the rectangle
     * @param {number} height Height of the rectangle
     */
    fillRectToContext(ctx, x, y, width, height) {
        if (!ctx) {
            return;
        }
        ctx.fillRect(x, y, width, height);
    }

    /**
     * Render the actual wave and progress lines
     *
     * @param {number[]} peaks Array with peaks data
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     */
    drawLines(peaks, absmax, halfH, offsetY, start, end) {
        this.drawLineToContext(
            this.waveCtx,
            peaks,
            absmax,
            halfH,
            offsetY,
            start,
            end
        );
        this.drawLineToContext(
            this.progressCtx,
            peaks,
            absmax,
            halfH,
            offsetY,
            start,
            end
        );
    }

    /**
     * Render the actual waveform line on a canvas
     *
     * @private
     * @param {CanvasRenderingContext2D} ctx Rendering context of target canvas
     * @param {number[]} peaks Array with peaks data
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     */
    drawLineToContext(ctx, peaks, absmax, halfH, offsetY, start, end) {
        if (!ctx) {
            return;
        }

        let length = peaks.length / 2;
        let first = Math.round(length * this.start);

        // Use one more peak value to make sure we join peaks at ends -- unless,
        // of course, this is the last canvas.
        let last = Math.round(length * this.end) + 1;

        let canvasStart = first;
        let canvasEnd = last;

        let scale = this.progress.width / (canvasEnd - canvasStart - 1);
        // optimization
        let halfOffset = halfH + offsetY;
        let absmaxHalf = absmax / halfH;

        ctx.beginPath();
        ctx.moveTo((canvasStart - first) * scale, halfOffset);

        ctx.lineTo(
            (canvasStart - first) * scale,
            halfOffset - Math.round((peaks[2 * canvasStart] || 0) / absmaxHalf)
        );

        let i, peak, h;
        for (i = canvasStart; i < canvasEnd; i++) {
            peak = peaks[2 * i] || 0;
            h = Math.round(peak / absmaxHalf);
            ctx.lineTo((i - first) * scale + this.halfPixel, halfOffset - h);
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        let j;
        for (j = canvasEnd - 1; j >= canvasStart; j--) {
            peak = peaks[2 * j + 1] || 0;
            h = Math.round(peak / absmaxHalf);
            ctx.lineTo((j - first) * scale + this.halfPixel, halfOffset - h);
        }

        ctx.lineTo(
            (canvasStart - first) * scale,
            halfOffset -
                Math.round((peaks[2 * canvasStart + 1] || 0) / absmaxHalf)
        );

        ctx.closePath();
        ctx.fill();
    }

    /**
     * Destroys this entry
     */
    destroy() {
        this.waveCtx = null;
        this.wave = null;

        this.progressCtx = null;
        this.progress = null;
    }

    /**
     * Return image data of the wave canvas
     *
     * When using a `type` of `'blob'`, this will return a `Promise`.
     *
     * @param {string} format='image/png' An optional value of a format type.
     * @param {number} quality=0.92 An optional value between 0 and 1.
     * @param {string} type='dataURL' Either 'dataURL' or 'blob'.
     * @return {string|string[]|Promise} When using the default `'dataURL'`
     * `type` this returns a single data URL or an array of data URLs,
     * one for each canvas. When using the `'blob'` `type` this returns a
     * `Promise` that resolves with an array of `Blob` instances, one for each
     * canvas.
     */
    getImage(format, quality, type) {
        if (type === 'blob') {
            return new Promise(resolve => {
                this.wave.toBlob(resolve, format, quality);
            });
        } else if (type === 'dataURL') {
            return this.wave.toDataURL(format, quality);
        }
    }
}
