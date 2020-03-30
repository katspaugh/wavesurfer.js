/**
 * @since 3.0.0
 */

import style from './util/style';
import getId from './util/get-id';

/**
 * The `SplitEntry` class represents an element consisting of an array of wave `canvas`
 * and an (optional) array of  progress wave `canvas`.
 *
 * The `MultiCanvas` renderer uses one or more `CanvasEntry` instances to
 * render a waveform, depending on the zoom level.
 */
export default class SplitEntry {
    constructor() {
        /**
         * The wave nodes
         *
         * @type {HTMLCanvasElement[]}
         */
        this.waves = [];
        /**
         * The wave canvas rendering contexts
         *
         * @type {CanvasRenderingContext2D[]}
         */
        this.waveCtxs = [];
        /**
         * The (optional) progress wave nodes
         *
         * @type {HTMLCanvasElement[]}
         */
        this.progresses = [];
        /**
         * The (optional) progress wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D[]}
         */
        this.progressCtxs = [];
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
        /**
         * Canvas 2d context attributes
         *
         * @type {object}
         */
        this.canvasContextAttributes = {};
        /**
         * Basic channel array
         *
         * @type {number[]}
         */
        this.channels = [0, 1];
    }

    /**
     * Store the wave canvas element and create the 2D rendering context
     *
     * @param {HTMLCanvasElement} wrapper The wave `canvas` element.
     * @param {number} leftOffset calculated offset
     */
    initWaves(wrapper, leftOffset) {
        this.channels.forEach(idx => {
            const newElement = wrapper.appendChild(
                style(document.createElement('canvas'), {
                    position: 'absolute',
                    zIndex: 2,
                    left: leftOffset + 'px',
                    top: idx === 0 ? 0 : '50%',
                    bottom: 0,
                    height: '50%',
                    pointerEvents: 'none'
                })
            );
            newElement.id = `wave-${idx}`;
            this.waves[idx] = newElement;
            this.waveCtxs[idx] = this.waves[idx].getContext(
                '2d',
                this.canvasContextAttributes
            );
        });
    }

    /**
     * Store the progress wave canvas element and create the 2D rendering
     * context
     *
     * @param {HTMLCanvasElement} wrapper The wave `canvas` element.
     * @param {number} leftOffset calculated offset
     */
    initProgresses(wrapper, leftOffset) {
        this.channels.forEach(idx => {
            const newElement = wrapper.appendChild(
                style(document.createElement('canvas'), {
                    position: 'absolute',
                    zIndex: 2,
                    left: leftOffset + 'px',
                    top: idx === 0 ? 0 : '50%',
                    bottom: 0,
                    height: '50%',
                    pointerEvents: 'none'
                })
            );
            newElement.id = `progress-${idx}`;
            this.progresses[idx] = newElement;
            this.progressCtxs[idx] = this.progresses[idx].getContext(
                '2d',
                this.canvasContextAttributes
            );
        });
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

        const elementSize = { width: `${elementWidth}px` };

        // set wave canvas dimensions
        this.waves.forEach(wave => {
            this.start = wave.offsetLeft / totalWidth || 0;
            this.end = this.start + elementWidth / totalWidth;
            wave.width = width;
            wave.height = height / this.waves.length;
            style(wave, elementSize);
        });

        if (this.hasProgressCanvas) {
            // set progress canvas dimensions
            this.progresses.forEach(progress => {
                progress.width = width;
                progress.height = height / this.progresses.length;
                style(progress, elementSize);
            });
        }
    }

    /**
     * Clear the wave and progress rendering contexts
     */
    clearWave() {
        // wave
        this.waveCtxs.forEach(waveCtx => {
            waveCtx.clearRect(
                0,
                0,
                waveCtx.canvas.width,
                waveCtx.canvas.height
            );
        });

        // progress
        if (this.hasProgressCanvas) {
            this.progressCtxs.forEach(progressCtx => {
                progressCtx.clearRect(
                    0,
                    0,
                    progressCtx.canvas.width,
                    progressCtx.canvas.height
                );
            });
        }
    }

    /**
     * Set the fill styles for wave and progress
     *
     * @param {?object} channelColors All fill colors in an object
     */
    setFillStyles(channelColors) {
        this.waveCtxs.forEach((waveCtx, idx) => {
            waveCtx.fillStyle = channelColors.waveColors[idx];
        });
        this.progressCtxs.forEach((progressCtx, idx) => {
            progressCtx.fillStyle = channelColors.progressColors[idx];
        });
    }

    /**
     * Draw a rectangle for wave and progress
     *
     * @param {number} x X start position
     * @param {number} y Y start position
     * @param {number} width Width of the rectangle
     * @param {number} height Height of the rectangle
     * @param {number} radius Radius of the rectangle
     */
    fillRects(x, y, width, height, radius) {
        this.waveCtxs.forEach(waveCtx => {
            this.fillRectToContext(waveCtx, x, y, width, height, radius);
        });

        if (this.hasProgressCanvas) {
            this.progressCtxs.forEach(progressCtx => {
                this.fillRectToContext(
                    progressCtx,
                    x,
                    y,
                    width,
                    height,
                    radius
                );
            });
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
     * @param {number} radius Radius of the rectangle
     */
    fillRectToContext(ctx, x, y, width, height, radius) {
        if (!ctx) {
            return;
        }

        if (radius) {
            this.drawRoundedRect(ctx, x, y, width, height, radius);
        } else {
            ctx.fillRect(x, y, width, height);
        }
    }

    /**
     * Draw a rounded rectangle on Canvas
     *
     * @private
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {number} x X-position of the rectangle
     * @param {number} y Y-position of the rectangle
     * @param {number} width Width of the rectangle
     * @param {number} height Height of the rectangle
     * @param {number} radius Radius of the rectangle
     *
     * @return {void}
     * @example drawRoundedRect(ctx, 50, 50, 5, 10, 3)
     */
    drawRoundedRect(ctx, x, y, width, height, radius) {
        if (height === 0) {
            return;
        }
        // peaks are float values from -1 to 1. Use absolute height values in
        // order to correctly calculate rounded rectangle coordinates
        if (height < 0) {
            height *= -1;
            y -= height;
        }
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
        );
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
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
     * @param {number} channelIndex The index of the channel being drawn
     */
    drawLines(peaks, absmax, halfH, offsetY, start, end, channelIndex) {
        this.waves.forEach((wave, idx) => {
            if (channelIndex === idx) {
                this.drawLineToContext(
                    this.waveCtxs[idx],
                    peaks,
                    absmax,
                    halfH,
                    0,
                    start,
                    end,
                    wave
                );
            }
        });

        if (this.hasProgressCanvas) {
            this.progresses.forEach((progress, idx) => {
                if (channelIndex === idx) {
                    this.drawLineToContext(
                        this.progressCtxs[idx],
                        peaks,
                        absmax,
                        halfH,
                        0,
                        start,
                        end,
                        progress
                    );
                }
            });
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
     * @param {HTMLCanvasElement} wave The wave element that is being measured
     * should be rendered
     */
    drawLineToContext(ctx, peaks, absmax, halfH, offsetY, start, end, wave) {
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
        const scale = wave.width / (canvasEnd - canvasStart - 1);

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
        this.waves.forEach(wave => {
            wave = null;
        });
        this.waveCtxs.forEach(waveCtx => {
            waveCtx = null;
        });
        this.progresses.forEach(progress => {
            progress = null;
        });
        this.progressCtxs.forEach(progressCtx => {
            progressCtx = null;
        });
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
                this.waves.map(wave => {
                    return wave.toBlob(resolve, format, quality);
                });
            });
        } else if (type === 'dataURL') {
            return this.waves.map(wave => {
                return wave.toDataURL(format, quality);
            });
        }
    }
}
