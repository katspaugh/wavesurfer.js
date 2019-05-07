/**
 * @since 3.0.0
 */

import style from './util/style';
import getId from './util/get-id';

/**
 * The `CanvasEntry` class represents an element consisting of a wave `canvas`
 * and an (optional) progress wave `canvas`.
 *
 * The `MultiCanvas` renderer uses one or more `CanvasEntry` instances to
 * render a waveform, depending on the zoom level.
 */
export default class CanvasEntry {
    constructor() {
        /**
         * The wave node
         *
         * @type {HTMLCanvasElement}
         */
        this.wave = null;
        /**
         * The wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         */
        this.waveCtx = null;
        /**
         * The (optional) progress wave node
         *
         * @type {HTMLCanvasElement}
         */
        this.progress = null;
        /**
         * The (optional) progress wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
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
         * Unique identifier for this entry
         *
         * @type {string}
         */
        this.id = getId(this.constructor.name.toLowerCase() + '_');
    }

    /**
     * Store the wave canvas element and create the 2D rendering context
     *
     * @param {HTMLCanvasElement} element The wave `canvas` element.
     */
    initWave(element) {
        this.wave = element;
        this.waveCtx = this.wave.getContext('2d');
    }

    /**
     * Store the progress wave canvas element and create the 2D rendering
     * context
     *
     * @param {HTMLCanvasElement} element The progress wave `canvas` element.
     */
    initProgress(element) {
        this.progress = element;
        this.progressCtx = this.progress.getContext('2d');
    }

    /**
     * Update the dimensions
     *
     * @param {number} elementWidth Width of the entry
     * @param {number} totalWidth Total width of the multi canvas renderer
     * @param {number} width The new width of the element
     * @param {number} height The new height of the element
     */
    updateDimensions(elementWidth, totalWidth, width, height) {
        // where the canvas starts and ends in the waveform, represented as a
        // decimal between 0 and 1
        this.start = this.wave.offsetLeft / totalWidth || 0;
        this.end = this.start + elementWidth / totalWidth;

        // set wave canvas dimensions
        this.wave.width = width;
        this.wave.height = height;
        let elementSize = { width: elementWidth + 'px' };
        style(this.wave, elementSize);

        if (this.hasProgressCanvas) {
            // set progress canvas dimensions
            this.progress.width = width;
            this.progress.height = height;
            style(this.progress, elementSize);
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
        this.fillRectToContext(this.waveCtx, x, y, width, height);

        if (this.hasProgressCanvas) {
            this.fillRectToContext(this.progressCtx, x, y, width, height);
        }
    }

    /**
     * Draw the actual rectangle on a `canvas` element
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

        if (this.hasProgressCanvas) {
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
    }

    /**
     * Render the actual waveform line on a `canvas` element
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

        const length = peaks.length / 2;
        const first = Math.round(length * this.start);

        // use one more peak value to make sure we join peaks at ends -- unless,
        // of course, this is the last canvas
        const last = Math.round(length * this.end) + 1;

        const canvasStart = first;
        const canvasEnd = last;
        const scale = this.wave.width / (canvasEnd - canvasStart - 1);

        // optimization
        const halfOffset = halfH + offsetY;
        const absmaxHalf = absmax / halfH;

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

        // draw the bottom edge going backwards, to make a single
        // closed hull to fill
        let j = canvasEnd - 1;
        for (j; j >= canvasStart; j--) {
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
     * Return image data of the wave `canvas` element
     *
     * When using a `type` of `'blob'`, this will return a `Promise` that
     * resolves with a `Blob` instance.
     *
     * @param {string} format='image/png' An optional value of a format type.
     * @param {number} quality=0.92 An optional value between 0 and 1.
     * @param {string} type='dataURL' Either 'dataURL' or 'blob'.
     * @return {string|Promise} When using the default `'dataURL'` `type` this
     * returns a data URL. When using the `'blob'` `type` this returns a
     * `Promise` that resolves with a `Blob` instance.
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
