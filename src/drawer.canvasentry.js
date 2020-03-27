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
         * The channel1 node
         *
         * @type {HTMLCanvasElement}
         */
        this.channel1 = null;
        /**
         * The channel1 canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         */
        this.channel1Ctx = null;
        /**
         * The channel2 node
         *
         * @type {HTMLCanvasElement}
         */
        this.channel2 = null;
        /**
         * The channel2 canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         */
        this.channel2Ctx = null;
        /**
         * The (optional) progress1 wave node
         *
         * @type {HTMLCanvasElement}
         */
        this.progress1 = null;
        /**
         * The (optional) progress1 wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         */
        this.progress1Ctx = null;
        /**
         * The (optional) progress2 wave node
         *
         * @type {HTMLCanvasElement}
         */
        this.progress2 = null;
        /**
         * The (optional) progress2 wave canvas rendering context
         *
         * @type {CanvasRenderingContext2D}
         */
        this.progress2Ctx = null;
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
         * Parent params (passed in init)
         *
         * @type {object}
         */
        this.params = {};
    }

    /**
     * Store the wave canvas element and create the 2D rendering context
     *
     * @param {HTMLCanvasElement} element The wave `canvas` element.
     * @param {object} params Parent parameters
     */
    initWave(element, params) {
        this.channel1 = element;
        this.channel1Ctx = this.channel1.getContext(
            '2d',
            this.canvasContextAttributes
        );
        this.params = params;
    }

    initWave2(element) {
        this.channel2 = element;
        this.channel2Ctx = this.channel2.getContext(
            '2d',
            this.canvasContextAttributes
        );
    }

    /**
     * Store the progress wave canvas element and create the 2D rendering
     * context
     *
     * @param {HTMLCanvasElement} element The progress wave `canvas` element.
     */
    initProgress(element) {
        this.progress1 = element;
        this.progress1Ctx = this.progress1.getContext(
            '2d',
            this.canvasContextAttributes
        );
    }

    initProgress2(element) {
        this.progress2 = element;
        this.progress2Ctx = this.progress2.getContext(
            '2d',
            this.canvasContextAttributes
        );
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
        this.start = this.channel1.offsetLeft / totalWidth || 0;
        this.end = this.start + elementWidth / totalWidth;

        // set wave canvas dimensions
        this.channel1.width = width;
        this.channel1.height = this.params.splitChannels ? height / 2 : height;
        let elementSize = { width: `${elementWidth}px` };
        style(this.channel1, elementSize);

        if (this.hasProgressCanvas) {
            // set progress canvas dimensions
            this.progress1.width = width;
            this.progress1.height = this.params.splitChannels
                ? height / 2
                : height;
            style(this.progress1, elementSize);
        }

        if (this.params.splitChannels) {
            this.channel2.width = width;
            this.channel2.height = height / 2;
            const elementSize = { width: `${elementWidth}px` };
            style(this.channel2, elementSize);

            if (this.hasProgressCanvas) {
                this.progress2.width = width;
                this.progress2.height = height / 2;
                style(this.progress2, elementSize);
            }
        }
    }

    /**
     * Clear the wave and progress rendering contexts
     */
    clearWave() {
        // wave
        this.channel1Ctx.clearRect(
            0,
            0,
            this.channel1Ctx.canvas.width,
            this.channel1Ctx.canvas.height
        );

        // progress
        if (this.hasProgressCanvas) {
            this.progress1Ctx.clearRect(
                0,
                0,
                this.progress1Ctx.canvas.width,
                this.progress1Ctx.canvas.height
            );
        }

        if (this.params.splitChannels) {
            this.channel2Ctx.clearRect(
                0,
                0,
                this.channel2Ctx.canvas.width,
                this.channel2Ctx.canvas.height
            );

            if (this.hasProgressCanvas) {
                this.progress2Ctx.clearRect(
                    0,
                    0,
                    this.progress2Ctx.canvas.width,
                    this.progress2Ctx.canvas.height
                );
            }
        }
    }

    /**
     * Set the fill styles for wave and progress
     *
     * @param {string} waveColor Fill color for the wave canvas
     * @param {?string} progressColor Fill color for the progress canvas
     * @param {?object} channelColors All fill colors in an object
     */
    setFillStyles(waveColor, progressColor, channelColors) {
        this.channel1Ctx.fillStyle = waveColor;

        if (this.hasProgressCanvas) {
            this.progress1Ctx.fillStyle = progressColor;
        }

        if (this.params.splitChannels && channelColors) {
            this.channel1Ctx.fillStyle = channelColors.waveColors[0];
            this.channel2Ctx.fillStyle = channelColors.waveColors[1];
            this.progress1Ctx.fillStyle = channelColors.progressColors[0];
            this.progress2Ctx.fillStyle = channelColors.progressColors[1];
        }
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
        this.fillRectToContext(this.channel1Ctx, x, y, width, height, radius);
        if (this.params.splitChannels) {
            this.fillRectToContext(
                this.channel2Ctx,
                x,
                y,
                width,
                height,
                radius
            );
        }

        if (this.hasProgressCanvas) {
            this.fillRectToContext(
                this.progress1Ctx,
                x,
                y,
                width,
                height,
                radius
            );
            if (this.params.splitChannels) {
                this.fillRectToContext(
                    this.progress2Ctx,
                    x,
                    y,
                    width,
                    height,
                    radius
                );
            }
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
        if (this.params.splitChannels) {
            if (channelIndex === 0) {
                this.drawLineToContext(
                    this.channel1Ctx,
                    peaks,
                    absmax,
                    halfH,
                    offsetY,
                    start,
                    end
                );
                if (this.hasProgressCanvas) {
                    this.drawLineToContext(
                        this.progress1Ctx,
                        peaks,
                        absmax,
                        halfH,
                        offsetY,
                        start,
                        end
                    );
                }
            }
            if (channelIndex === 1) {
                this.drawLineToContext(
                    this.channel2Ctx,
                    peaks,
                    absmax,
                    halfH,
                    0,
                    start,
                    end
                );

                if (this.hasProgressCanvas) {
                    this.drawLineToContext(
                        this.progress2Ctx,
                        peaks,
                        absmax,
                        halfH,
                        0,
                        start,
                        end
                    );
                }
            }
        } else {
            this.drawLineToContext(
                this.channel1Ctx,
                peaks,
                absmax,
                halfH,
                offsetY,
                start,
                end
            );
            if (this.hasProgressCanvas) {
                this.drawLineToContext(
                    this.progress1Ctx,
                    peaks,
                    absmax,
                    halfH,
                    offsetY,
                    start,
                    end
                );
            }
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
        const scale = this.channel1.width / (canvasEnd - canvasStart - 1);

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
        this.channel1Ctx = null;
        this.channel1 = null;

        this.channel2 = null;
        this.channel2Ctx = null;

        this.progress1Ctx = null;
        this.progress1 = null;

        this.progress2 = null;
        this.progress2Ctx = null;
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
                this.channel1.toBlob(resolve, format, quality);
            });
        } else if (type === 'dataURL') {
            return this.channel1.toDataURL(format, quality);
        }
    }
}
