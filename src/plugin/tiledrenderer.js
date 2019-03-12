import Drawer from '../drawer';
import * as util from '../util';

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
 * TiledRenderer for wavesurfer. Based on the MultiCanvas renderer bundled with WaveSurfer.
 * TiledRenderer works with a pool of Canvas objects, automatically drawing and positioning them
 * as needed.
 */

export default class TiledRenderer extends Drawer {
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
        this.maxCanvasElementWidth = Math.round(
            params.maxCanvasWidth / params.pixelRatio
        );

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
        // Use tiled rendering if you need more than canvasLimit canvases
        this.canvasLimit = params.canvasLimit || 6;
        // Use the sample-drawer if the minPxPerSec is >= sampleSpeed, otherwise use peaks/bars.
        this.sampleSpeed = params.sampleSpeed || 2560;
        /**
         * @private
         * @type {Array}
         */
        this.canvases = [];
        /** @private */
        this.progressWave = null;
        this.tiledRendering = false;
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
                zIndex: 3,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden',
                width: '0',
                display: 'none',
                boxSizing: 'border-box',
                borderRightStyle: 'solid',
                pointerEvents: 'none'
            })
        );

        this.addCanvas();
        this.updateCursor();
    }

    /**
     * Update cursor style from params.
     */
    updateCursor() {
        this.style(this.progressWave, {
            borderRightWidth: this.params.cursorWidth + 'px',
            borderRightColor: this.params.cursorColor
        });
    }

    /**
     * Recenter the viewport on a position, either scroll there immediately or
     * in steps of 5 pixels
     *
     * @param {number} position X-offset in pixels
     * @param {boolean} immediate Set to true to immediately scroll somewhere
     */
    recenterOnPosition(position, immediate) {
        const scrollLeft = this.wrapper.scrollLeft;
        const half = ~~(this.wrapper.clientWidth / 2);
        const maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;
        let target = position - half;
        let offset = target - scrollLeft;

        if (maxScroll == 0) {
            // no need to continue if scrollbar is not there
            return;
        }

        // if the cursor is currently visible
        // and the scroll velocity is not too high.
        if (
            !immediate &&
            -half <= offset &&
            offset < half &&
            this.params.minPxPerSec < 400
        ) {
            // we'll limit the "re-center" rate.
            const rate = 5;
            offset = Math.max(-rate, Math.min(rate, offset));
            target = scrollLeft + offset;
        }

        // limit target to valid range (0 to maxScroll)
        target = Math.max(0, Math.min(maxScroll, target));
        // no use attempting to scroll if we're not moving
        if (target != scrollLeft) {
            this.wrapper.scrollLeft = target;
        }
    }

    /**
     * Adjust to the updated size by adding or removing canvases
     */
    updateSize() {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(
            totalWidth / this.maxCanvasElementWidth
        );
        let canvasCount =
            this.tiledRendering && this.canvasLimit < requiredCanvases
                ? this.canvasLimit
                : requiredCanvases;

        while (this.canvases.length < canvasCount) {
            this.addCanvas();
        }

        while (this.canvases.length > canvasCount) {
            this.removeCanvas();
        }

        this.canvases.forEach((entry, i) => {
            //  reflow canvases in order
            let leftOffset = this.maxCanvasElementWidth * i;
            // Add some overlap to prevent vertical white stripes, keep the width even for simplicity.
            let canvasWidth =
                this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);

            if (!this.tiledRendering && i === this.canvases.length - 1) {
                if (i === this.canvases.length - 1) {
                    canvasWidth =
                        this.width -
                        this.maxCanvasWidth * (this.canvases.length - 1);
                }
            }

            this.updateDimensions(
                entry,
                canvasWidth,
                this.height,
                leftOffset,
                this.maxCanvasWidth * i
            );
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
                zIndex: 2,
                left: leftOffset + 'px',
                top: 0,
                bottom: 0,
                height: '100%',
                pointerEvents: 'none'
            })
        );
        entry.waveCtx = entry.wave.getContext('2d');

        if (this.hasProgressCanvas) {
            entry.progress = this.progressWave.appendChild(
                this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: 0,
                    bottom: 0,
                    height: '100%'
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
     * @param {number} width The new width of the element in canvas coordinates
     * @param {number} height The new height of the element
     * @param {number} offset Offset of the element in css coordinates
     * @param {number} leftCanX Offset of the element in canvas coordinates.
     */
    updateDimensions(entry, width, height, offset, leftCanX) {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const elementWidth = Math.round(width / this.params.pixelRatio);
        // Where the canvas starts and ends in the waveform, represented as a decimal between 0 and 1.
        entry.start = offset / totalWidth || 0;
        // entry.start = entry.waveCtx.canvas.offsetLeft / totalWidth || 0;
        entry.end = entry.start + elementWidth / totalWidth;
        entry.leftX = leftCanX;
        entry.waveCtx.canvas.width = width;
        entry.waveCtx.canvas.height = height;
        this.style(entry.waveCtx.canvas, {
            width: elementWidth + 'px',
            left: offset + 'px'
        });

        this.style(this.progressWave, { display: 'block' });

        if (this.hasProgressCanvas) {
            entry.progressCtx.canvas.width = width;
            entry.progressCtx.canvas.height = height;
            this.style(entry.progressCtx.canvas, {
                width: elementWidth + 'px',
                left: offset + 'px'
            });
        }

        // Create an empty <div> to hold open
        if (this.tiledRendering && !this.spacer) {
            this.spacer = this.wrapper.appendChild(
                this.style(document.createElement('div'), {
                    id: 'spacerdiv',
                    position: 'absolute',
                    zIndex: 2,
                    top: 0,
                    bottom: '1px',
                    width: '1px',
                    left: totalWidth + 'px',
                    height: '100%',
                    pointerEvents: 'none'
                })
            );
        }
        if (this.spacer) {
            this.style(this.spacer, { left: totalWidth + 'px' });
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
        entry.waveCtx.clearRect(
            0,
            0,
            entry.waveCtx.canvas.width,
            entry.waveCtx.canvas.height
        );
        if (this.hasProgressCanvas) {
            entry.progressCtx.clearRect(
                0,
                0,
                entry.progressCtx.canvas.width,
                entry.progressCtx.canvas.height
            );
        }
    }

    /**
     * Draw peaks on the (first) canvas
     * (control comes thru here via the minimap plugin or when clearing the waveform).
     *
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} length The width of the area that should be drawn
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that should be
     * rendered
     */
    drawPeaks(peaks, length, start, end) {
        if (!this.setWidth(length)) {
            this.clearWave();
        }
        this.params.barWidth
            ? this.drawBars(peaks, 0, start, end, this.canvases[0])
            : this.drawWave(peaks, 0, start, end, this.canvases[0]);
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
     * @param (canvas) the canvas to draw the wave on,
     */
    drawBars(peaks, channelIndex, start, end, canvas) {
        this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({ absmax, hasMinVals, height, offsetY, halfH, peaks }) => {
                // if drawBars was called within ws.empty we don't pass a start and
                // don't want anything to happen
                if (start === undefined) {
                    return;
                }
                // Skip every other value if there are negatives.
                const peakIndexScale = hasMinVals ? 2 : 1;
                const length = peaks.length / peakIndexScale;
                const bar = this.params.barWidth * this.params.pixelRatio;
                const gap =
                    this.params.barGap === null
                        ? Math.max(this.params.pixelRatio, ~~(bar / 2))
                        : Math.max(
                              this.params.pixelRatio,
                              this.params.barGap * this.params.pixelRatio
                          );
                const step = bar + gap;

                const scale = length / this.width;
                const first = start;
                const last = end;
                let i;

                for (i = first; i < last; i += step) {
                    const peak =
                        peaks[Math.floor(i * scale * peakIndexScale)] || 0;
                    const h = Math.round((peak / absmax) * halfH);
                    this.fillRect(
                        i - first + this.halfPixel,
                        halfH - h + offsetY,
                        bar + this.halfPixel,
                        h * 2,
                        canvas
                    );
                }
            },
            canvas
        );
    }

    /**
     * Draw a waveform
     *
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered (If this isn't set only a flat line is rendered)
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     * @param (canvas) the canvas to draw the wave on,
     */
    drawWave(peaks, channelIndex, start, end, canvas) {
        this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({ absmax, hasMinVals, height, offsetY, halfH, peaks }) => {
                if (!hasMinVals) {
                    const reflectedPeaks = [];
                    const len = peaks.length;
                    let i;
                    for (i = 0; i < len; i++) {
                        reflectedPeaks[2 * i] = peaks[i];
                        reflectedPeaks[2 * i + 1] = -peaks[i];
                    }
                    peaks = reflectedPeaks;
                }

                // if drawWave was called within ws.empty we don't pass a start and
                // end and simply want a flat line
                if (start !== undefined) {
                    this.drawLine(
                        peaks,
                        absmax,
                        halfH,
                        offsetY,
                        start,
                        end,
                        canvas
                    );
                }

                // Always draw a median line
                this.fillRect(
                    0,
                    halfH + offsetY - this.halfPixel,
                    this.width,
                    this.halfPixel,
                    canvas
                );
            },
            canvas
        );
    }

    /**
     * Draw part of the waveform on a particular canvas
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
    drawLine(peaks, absmax, halfH, offsetY, start, end, entry) {
        // let t0 = performance.now();
        this.setFillStyles(entry);
        this.drawLineToContext(
            entry,
            entry.waveCtx,
            peaks,
            absmax,
            halfH,
            offsetY,
            start,
            end
        );
        this.drawLineToContext(
            entry,
            entry.progressCtx,
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
        if (!ctx) {
            return;
        }

        const length = peaks.length / 2;
        //  const scale = this.width != length ? this.width / length : 1;

        const scale =
            this.params.fillParent && this.width != length
                ? this.width / length
                : 1;

        const first = Math.round(length * entry.start);
        // Use one more peak value to make sure we join peaks at ends -- unless,
        // of course, this is the last canvas.
        const last = Math.round(length * entry.end) + 1;
        if (first > end || last < start) {
            return;
        }
        const canvasStart = Math.min(first, start);
        const canvasEnd = Math.max(last, end);
        let i;
        let j;

        ctx.beginPath();
        ctx.moveTo(
            (canvasStart - first) * scale + this.halfPixel,
            halfH + offsetY
        );

        for (i = canvasStart; i < canvasEnd; i++) {
            const peak = peaks[2 * i] || 0;
            const h = Math.round((peak / absmax) * halfH);
            ctx.lineTo(
                (i - first) * scale + this.halfPixel,
                halfH - h + offsetY
            );
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        for (j = canvasEnd - 1; j >= canvasStart; j--) {
            const peak = peaks[2 * j + 1] || 0;
            const h = Math.round((peak / absmax) * halfH);
            ctx.lineTo(
                (j - first) * scale + this.halfPixel,
                halfH - h + offsetY
            );
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
       @param {canvas} entry
     */
    fillRect(x, y, width, height, entry) {
        this.setFillStyles(entry);

        this.fillRectToContext(entry.waveCtx, x, y, width, height);

        this.fillRectToContext(entry.progressCtx, x, y, width, height);
    }

    /**
     * Performs preparation tasks and calculations which are shared by drawBars and drawWave
     *
     * @private
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered (If this isn't set only a flat line is rendered)
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     * @param {function} fn The render function to call
     * @param {canvas} The canvas to draw upon.
     */
    prepareDraw(peaks, channelIndex, start, end, fn, canvas) {
        //      if (!peaks) {
        //          let cat = 2;
        //      }
        // Split channels and call this function with the channelIndex set
        if (!peaks) {
            let cat = 3;
        }
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(
                    channels.length *
                        this.params.height *
                        this.params.pixelRatio
                );
                return channels.forEach((channelPeaks, i) =>
                    this.prepareDraw(channelPeaks, i, start, end, fn, canvas)
                );
            }
            peaks = channels[0];
        }
        // calculate maximum modulation value, either from the barHeight
        // parameter or if normalize=true from the largest value in the peak
        // set
        let absmax = 1 / this.params.barHeight;
        if (this.params.normalize) {
            const max = util.max(peaks);
            const min = util.min(peaks);
            absmax = -min > max ? -min : max;
        }

        // Bar wave draws the bottom only as a reflection of the top,
        // so we don't need negative values
        const hasMinVals = [].some.call(peaks, val => val < 0);
        const height = this.params.height * this.params.pixelRatio;
        const offsetY = height * channelIndex || 0;
        const halfH = height / 2;

        return fn({
            absmax: absmax,
            hasMinVals: hasMinVals,
            height: height,
            offsetY: offsetY,
            halfH: halfH,
            peaks: peaks,
            entry: canvas
        });
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
        if (!ctx) {
            return;
        }
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
        const images = this.canvases.map(entry =>
            entry.wave.toDataURL(type, quality)
        );
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

    /**
     * Calculate position and width of the canvas corresponding to the normalized
     * X position supplied.
     *
     * @param surfer {Wavesurfer} wavesurfer instance that has channel data
     * @param xNorm {number} Normalized X position to use to determine canvas info.
     * @returns: lhs (number) left hand side coordianate of canvas in css coordinates.
     * canvaWidth (number) width of canvas (in canvas coordinates), adjusted if need be for last.
     * leftOff (number) left coordinate of canvas (in canvas coordinates).
     */
    calcCanvasInfo(surfer, xNorm) {
        const durScale = surfer.getDuration() * this.params.minPxPerSec;
        let xc = (xNorm * durScale) / this.params.pixelRatio;
        let canNum = Math.floor(xc / this.maxCanvasElementWidth);

        let lhs = canNum * this.maxCanvasElementWidth; // lhs in css coordinates
        let leftOff = canNum * this.maxCanvasWidth;
        let canvasWidth =
            this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);

        // If this is the last canvas position, trim its size back so as to not overhang
        if ((canNum + 1) * this.maxCanvasWidth > this.width) {
            canvasWidth = this.width - this.maxCanvasWidth * canNum;
        }
        return {
            left: lhs,
            canvasWidth: canvasWidth,
            leftOff: leftOff
        };
    }

    /**
     * fill the given canvas entry with data from the peaks array or the channel buffers
     *
     * @private
     * @param surfer {Wavesurfer} wavesurfer instance that has channel data
     * @param entry {Canvas} canvas to draw onto.
     * @param peaks (Peaks array) peak data to draw with if not using channel data.
     */
    imageSingleCanvas(surfer, entry, peaks) {
        let buffer = surfer.backend.buffer;
        const { numberOfChannels, sampleRate } = buffer;
        const spDx = sampleRate / this.params.minPxPerSec;
        const height = Math.round(this.params.height * this.params.pixelRatio); // ?
        const halfH = Math.round(height / 2);
        const pixH = 2;
        const pixW = Math.ceil(1 / spDx) + 1;
        const ySc = -halfH;
        const duration = surfer.getDuration();
        const durScale = duration * this.params.minPxPerSec;

        let lhs = Math.round(entry.start * durScale);
        let rhs = Math.round(entry.end * durScale);
        if (!entry) {
            let cat = 3;
        }
        if (this.params.minPxPerSec < this.sampleSpeed) {
            this.params.barWidth
                ? this.drawBars(peaks, 0, lhs, rhs, entry)
                : this.drawWave(peaks, 0, lhs, rhs, entry);
            return;
        }

        for (var c = 0; c < numberOfChannels; ++c) {
            var chan = buffer.getChannelData(c);
            let yoff = halfH + c * height;
            let { progressCtx, waveCtx } = entry;
            this.setFillStyles(entry);
            let sx = entry.start * duration * sampleRate;
            let w = rhs - lhs;
            for (var x = 0; x < w; ++x) {
                let y = yoff + Math.round(chan[Math.round(sx)] * ySc);
                sx += spDx;
                waveCtx.fillRect(x, y, pixW, pixH);
                if (progressCtx) progressCtx.fillRect(x, y, pixW, pixH);
            }
        }
    }

    /**
     * periodic function called in order to maintain the tile strip.
     * returns true if a canvas to reimage was found.
     * @private
     * @param surfer {Wavesurfer} wavesurfer instance that has channel data
     * @param peaks (Peaks array) peak data to draw with if not using channel data.
     * @returns: (boolean) true if a reimage was accomplished, false if not.
     */
    scrollCheck(surfer, peaks) {
        let scrX = surfer.drawer.getScrollX(); // scrX should be in canvas coordinates.

        let duration = surfer.getDuration();
        let durScale = duration * this.params.minPxPerSec;
        let normX = scrX / durScale;

        let playState = surfer.isPlaying();

        if (normX > 1.0) {
            normX = 1.0;
        }

        let foundCan;
        let canvToFill;

        let maxDist = 0;
        // Find the canvas which is visable. Also determine the canvas that is farthest away or hidden
        // that we can recycle if need be.
        this.canvases.forEach(entry => {
            if (normX >= entry.start && normX < entry.end && !entry.hidden) {
                foundCan = entry;
            } else {
                if (entry.hidden) {
                    // hidden entries always win.
                    canvToFill = entry;
                    maxDist = -1; // use -1 as a flag to stop compares.
                } else if (maxDist >= 0) {
                    let midPt = (entry.start + entry.end) / 2;
                    let dist = Math.abs(normX - midPt);
                    if (dist >= maxDist) {
                        maxDist = dist;
                        canvToFill = entry;
                    }
                }
            }
        });

        let that = this;
        var whereX = -1;
        // If it isn't there, make that one.
        // If it is already there, find the next one

        if (!foundCan) {
            whereX = normX;
        } else {
            let ourWid = foundCan.end - foundCan.start;
            let ourMid = foundCan.start + ourWid / 2;
            let seekX = ourMid + ourWid;
            let foundUp;
            if (seekX < 1.0) {
                foundUp = that.canvases.find(function(can) {
                    return seekX >= can.start && seekX < can.end && !can.hidden;
                });
            }
            if (!foundUp && seekX < 1.0) {
                whereX = seekX;
            } else {
                seekX = ourMid - ourWid;
                if (seekX < 0) seekX == 0;
                let foundDn = that.canvases.find(function(can) {
                    return seekX >= can.start && seekX < can.end && !can.hidden;
                });
                if (!foundDn) {
                    whereX = seekX;
                }
            }
        }

        if (whereX >= 0 && canvToFill) {
            let can = this.calcCanvasInfo(surfer, whereX);
            let { canvasWidth, left, leftOff } = can;
            this.updateDimensions(
                canvToFill,
                canvasWidth,
                this.height,
                left,
                leftOff
            );
            this.clearWaveForEntry(canvToFill);
            this.imageSingleCanvas(surfer, canvToFill, peaks);
            canvToFill.hidden = false;
            return true;
        }

        return false;
    }

    /**
     * called from tiledDrawBuffer to reimage the tiles. If we are using tiled rendering,
     * arrange to repaint the visible area and set up an event listener for scrolling.
     * If we aren't using tiled rendering, then fill up all the canvases.
     *
     * @private
     * @param surfer {Wavesurfer} wavesurfer instance that has channel data
     * @param entry {Canvas} canvas to draw onto.
     * @param peaks (Peaks array) peak data to draw with if not using channel data.
     */
    drawTiles(surfer, width, peaks) {
        this.setWidth(width);
        this.clearWave();
        let that = this;

        // Csncel any existing scroll watcher.
        if (this.scrollWatcher) {
            surfer.un('scroll', this.scrollWatcher);
            this.scrollWatcher = undefined;
        }
        if (this.tiledRendering) {
            // Mark all canvases as hidden.
            this.canvases.forEach(entry => {
                entry.hidden = true;
            });
            let repaint = function() {
                let ctr = 0;
                while (that.scrollCheck(surfer, peaks)) {
                    if (ctr++ > that.canvasLimit) {
                        return;
                    }
                }
            };
            setTimeout(repaint);
        } else {
            this.canvases.forEach(entry => {
                that.imageSingleCanvas(surfer, entry, peaks);
            });
        }

        // Make a new scroll watcher if we need it.
        if (this.tiledRendering) {
            let watchFun = function(screvt) {
                if (that.tiledRendering) {
                    if (that.params.minPxPerSec < that.sampleSpeed && !peaks) {
                        return;
                    }
                    if (that.scrollCheck(surfer, peaks)) {
                        that.scrollCheck(surfer, peaks);
                    }
                }
            };
            surfer.on('scroll', watchFun);
            this.scrollWatcher = watchFun;
        }
    }
} // End of class.

/**
 * A hacked-up version of the drawBuffer routine defined in wavesurfer.js,
 * Since we don't want to use peak data at high magnification levels, we
 * avoid generating and using peak data in the situation. We also
 * turn on the tiled rendering feature if it is needed.
 */
var tiledDrawBuffer = function() {
    var nominalWidth = Math.round(this.getDuration() * this.params.minPxPerSec);
    var parentWidth = this.drawer.getWidth();
    var width = nominalWidth;

    // If we need more than a certain number of canvases, then we will render them dynamically
    const requiredCanvases = Math.ceil(width / this.params.maxCanvasWidth);
    this.drawer.tiledRendering = requiredCanvases > this.drawer.canvasLimit;
    let needPeaks = this.params.minPxPerSec < this.drawer.sampleSpeed;
    let end = Math.max(parentWidth, width);

    this.peaks = undefined;
    var peaks = void 0;
    if (needPeaks) {
        this.backend.peaks = undefined;
        this.backend.mergedPeaks = undefined;
        peaks = this.backend.getPeaks(width, 0, end);
    }
    this.drawer.drawTiles(this, width, peaks);
    this.fireEvent('redraw', peaks, width);
};

export { TiledRenderer, tiledDrawBuffer };
