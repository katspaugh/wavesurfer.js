import Drawer from './drawer';
import * as util from './util';
import CanvasEntry from './drawer.canvasentry';

/**
 * MultiCanvas renderer for wavesurfer. Is currently the default and sole
 * builtin renderer.
 *
 * A `MultiCanvas` consists of one or more `CanvasEntry` instances, depending
 * on the zoom level.
 */
export default class MultiCanvas extends Drawer {
    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    constructor(container, params) {
        super(container, params);

        /**
         * Max size of the canvas along the main axis.
         * Was "maxCanvasWidth".
         *
         * @type {number}
         */
        this.maxCanvasMainAxisSize = params.maxCanvasWidth;

        /**
         * Max size of the canvas along the main axis,
         * accounting for pixel density.
         * Was "maxCanvasElementWidth".
         *
         * @type {number}
         */
        this.maxCanvasMainAxisElementSize = Math.round(
            params.maxCanvasWidth / params.pixelRatio
        );

        /**
         * Whether or not the progress wave is rendered. If the `waveColor`
         * and `progressColor` are the same color it is not.
         *
         * @type {boolean}
         */
        this.hasProgressCanvas = params.waveColor != params.progressColor;

        /**
         * @type {number}
         */
        this.halfPixel = 0.5 / params.pixelRatio;

        /**
         * List of `CanvasEntry` instances.
         *
         * @type {Array}
         */
        this.canvases = [];

        /**
         * @type {HTMLElement}
         */
        this.progressWave = null;

        /**
         * Class used to generate entries.
         *
         * @type {function}
         */
        this.EntryClass = CanvasEntry;

        /**
         * Canvas 2d context attributes.
         *
         * @type {object}
         */
        this.canvasContextAttributes = params.drawingContextAttributes;

        /**
         * Overlap added between entries to prevent vertical white stripes
         * between `canvas` elements.
         *
         * @type {number}
         */
        this.overlap = 2 * Math.ceil(params.pixelRatio / 2);

        /**
         * The radius of the wave bars. Makes bars rounded
         *
         * @type {number}
         */
        this.barRadius = params.barRadius || 0;
    }

    /**
     * Initialize the drawer
     */
    init() {
        this.createWrapper();
        this.createElements();
    }

    /**
     * Create the canvas elements and style them
     *
     */
    createElements() {
        this.progressWave = this.wrapper.appendChild(
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 3,
                [this.orientation.mainAxisPositionStartAttr]: 0,
                [this.orientation.crossAxisPositionStartAttr]: 0,
                [this.orientation.crossAxisPositionEndAttr]: 0,
                overflow: 'hidden',
                [this.orientation.mainAxisSizeAttr]: '0',
                display: 'none',
                boxSizing: 'border-box',
                ['border' + util.capitalize(this.orientation.mainAxisPositionEndAttr) + 'Style']: 'solid',
                pointerEvents: 'none'
            })
        );

        this.addCanvas();
        this.updateCursor();
    }

    /**
     * Update cursor style
     */
    updateCursor() {
        this.style(this.progressWave, {
            ['border' + util.capitalize(this.orientation.mainAxisPositionEndAttr) + 'Width']: this.params.cursorWidth + 'px',
            ['border' + util.capitalize(this.orientation.mainAxisPositionEndAttr) + 'Color']: this.params.cursorColor
        });
    }

    /**
     * Adjust to the updated size by adding or removing canvases
     */
    updateSize() {
        const totalMainAxisSize = Math.round(this.orientation.mainAxisSize() / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(
            totalMainAxisSize / (this.maxCanvasMainAxisElementSize + this.overlap)
        );

        // add required canvases
        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        // remove older existing canvases, if any
        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        let canvasMainAxisSize = this.maxCanvasMainAxisSize + this.overlap;
        const lastCanvas = this.canvases.length - 1;
        this.canvases.forEach((entry, i) => {
            if (i == lastCanvas) {
                canvasMainAxisSize = this.orientation.mainAxisSize() - this.maxCanvasMainAxisSize * lastCanvas;
            }
            this.updateDimensions(entry, canvasMainAxisSize, this.orientation.crossAxisSize());

            entry.clearWave();
        });
    }

    /**
     * Add a canvas to the canvas list
     *
     */
    addCanvas() {
        const entry = new this.EntryClass(this.orientation);
        entry.canvasContextAttributes = this.canvasContextAttributes;
        entry.hasProgressCanvas = this.hasProgressCanvas;
        entry.halfPixel = this.halfPixel;
        const mainAxisOffset = this.maxCanvasMainAxisElementSize * this.canvases.length;

        // wave
        entry.initWave(
            this.wrapper.appendChild(
                this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    zIndex: 2,
                    [this.orientation.mainAxisPositionStartAttr]: mainAxisOffset + 'px',
                    [this.orientation.crossAxisPositionStartAttr]: 0,
                    [this.orientation.crossAxisPositionEndAttr]: 0,
                    height: '100%',
                    pointerEvents: 'none'
                })
            )
        );

        // progress
        if (this.hasProgressCanvas) {
            entry.initProgress(
                this.progressWave.appendChild(
                    this.style(document.createElement('canvas'), {
                        position: 'absolute',
                        [this.orientation.mainAxisPositionStartAttr]: mainAxisOffset + 'px',
                        [this.orientation.crossAxisPositionStartAttr]: 0,
                        [this.orientation.crossAxisPositionEndAttr]: 0,
                        height: '100%'
                    })
                )
            );
        }

        this.canvases.push(entry);
    }

    /**
     * Pop single canvas from the list
     *
     */
    removeCanvas() {
        let lastEntry = this.canvases[this.canvases.length - 1];

        // wave
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);

        // progress
        if (this.hasProgressCanvas) {
            lastEntry.progress.parentElement.removeChild(lastEntry.progress);
        }

        // cleanup
        if (lastEntry) {
            lastEntry.destroy();
            lastEntry = null;
        }

        this.canvases.pop();
    }

    /**
     * Update the dimensions of a canvas element
     *
     * @param {CanvasEntry} entry Target entry
     * @param {number} mainAxisSize The new size of the element along the main axis
     * @param {number} crossAxisSize The new size of the element along the cross axis
     */
    updateDimensions(entry, mainAxisSize, crossAxisSize) {
        const elementMainAxisSize = Math.round(mainAxisSize / this.params.pixelRatio);
        const totalMainAxisSize = Math.round(this.orientation.mainAxisSize() / this.params.pixelRatio);

        // update canvas dimensions
        entry.updateDimensions(elementMainAxisSize, totalMainAxisSize, mainAxisSize, crossAxisSize);

        // style element
        this.style(this.progressWave, { display: 'block' });
    }

    /**
     * Clear the whole multi-canvas
     */
    clearWave() {
        util.frame(() => {
            this.canvases.forEach(entry => entry.clearWave());
        })();
    }

    /**
     * Draw a waveform with bars
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays
     * for split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0. Must be an integer.
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that should be
     * rendered
     * @returns {void}
     */
    drawBars(peaks, channelIndex, start, end) {
        return this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({ absmax, hasMinVals, crossAxisSize, crossAxisOffset, halfCrossAxis, peaks, channelIndex: ch }) => {
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

                const scale = length / this.orientation.mainAxisSize();
                const first = start;
                const last = end;
                let i = first;

                for (i; i < last; i += step) {
                    const peak =
                        peaks[Math.floor(i * scale * peakIndexScale)] || 0;
                    let crossAxisSize = Math.round((peak / absmax) * halfCrossAxis);

                    /* in case of silences, allow the user to specify that we
                     * always draw *something* (normally a 1px high bar) */
                    if (crossAxisSize == 0 && this.params.barMinHeight) {
                        crossAxisSize = this.params.barMinHeight;
                    }

                    this.fillRect(
                        i + this.halfPixel,
                        halfCrossAxis - crossAxisSize + crossAxisOffset,
                        bar + this.halfPixel,
                        crossAxisSize * 2,
                        this.barRadius,
                        ch
                    );
                }
            }
        );
    }

    /**
     * Draw a waveform
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays
     * for split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered (If this isn't set only a flat line is rendered)
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     * @returns {void}
     */
    drawWave(peaks, channelIndex, start, end) {
        return this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({ absmax, hasMinVals, crossAxisSize, crossAxisOffset, halfCrossAxis, peaks, channelIndex }) => {
                if (!hasMinVals) {
                    const reflectedPeaks = [];
                    const len = peaks.length;
                    let i = 0;
                    for (i; i < len; i++) {
                        reflectedPeaks[2 * i] = peaks[i];
                        reflectedPeaks[2 * i + 1] = -peaks[i];
                    }
                    peaks = reflectedPeaks;
                }

                // if drawWave was called within ws.empty we don't pass a start and
                // end and simply want a flat line
                if (start !== undefined) {
                    this.drawLine(peaks, absmax, halfCrossAxis, crossAxisOffset, start, end, channelIndex);
                }

                // always draw a median line
                this.fillRect(
                    0,
                    halfCrossAxis + crossAxisOffset - this.halfPixel,
                    this.orientation.nominalMainAxisSize,
                    this.halfPixel,
                    this.barRadius,
                    channelIndex
                );
            }
        );
    }

    /**
     * Tell the canvas entries to render their portion of the waveform
     *
     * @param {number[]} peaks Peaks data
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfCrossAxis Half the cross-axis size of the waveform
     * @param {number} crossAxisOffset Offset to the edge of the cross axis
     * @param {number} start The main-axis offset of the beginning of the area that
     * should be rendered
     * @param {number} end The main-axis offset of the end of the area that
     * should be rendered
     * @param {channelIndex} channelIndex The channel index of the line drawn
     */
    drawLine(peaks, absmax, halfCrossAxis, crossAxisOffset, start, end, channelIndex) {
        const { waveColor, progressColor } = this.params.splitChannelsOptions.channelColors[channelIndex] || {};
        this.canvases.forEach((entry, i) => {
            this.setFillStyles(entry, waveColor, progressColor);
            entry.drawLines(peaks, absmax, halfCrossAxis, crossAxisOffset, start, end);
        });
    }

    /**
     * Draw a rectangle on the multi-canvas
     *
     * @param {number} mainAxisPos Position of the rectangle along the main axis
     * @param {number} crossAxisPos Position of the rectangle along the cross axis
     * @param {number} mainAxisSize Size of the rectangle along the main axis
     * @param {number} crossAxisSize Size of the rectangle along the cross axis
     * @param {number} radius Radius of the rectangle
     * @param {channelIndex} channelIndex The channel index of the bar drawn
     */
    fillRect(mainAxisPos, crossAxisPos, mainAxisSize, crossAxisSize, radius, channelIndex) {
        const startCanvas = Math.floor(mainAxisPos / this.maxCanvasMainAxisSize);
        const endCanvas = Math.min(
            Math.ceil((mainAxisPos + mainAxisSize) / this.maxCanvasMainAxisSize) + 1,
            this.canvases.length
        );
        let i = startCanvas;
        for (i; i < endCanvas; i++) {
            const entry = this.canvases[i];
            const mainAxisOffset = i * this.maxCanvasMainAxisSize;

            const intersection1 = {
                mainAxis: Math.max(mainAxisPos, i * this.maxCanvasMainAxisSize),
                crossAxis: crossAxisPos
            };
            const intersection2 = {
                mainAxis: Math.min(
                    mainAxisPos + mainAxisSize,
                    i * this.maxCanvasMainAxisSize + this.orientation.mainAxisSize(entry.wave)
                ),
                crossAxis: crossAxisPos + crossAxisSize
            };

            if (intersection1.mainAxis < intersection2.mainAxis) {
                const { waveColor, progressColor } = this.params.splitChannelsOptions.channelColors[channelIndex] || {};
                this.setFillStyles(entry, waveColor, progressColor);

                intersectionXY2.mainAxis -= intersectionXY1.mainAxis;
                intersectionXY2.crossAxis -= intersectionXY1.crossAxis;
                intersectionXY1.mainAxis -= mainAxisOffset;

                const intersectionXY1 = this.orientation.toAbsolute(intersection1);
                const intersectionXY2 = this.orientation.toAbsolute(intersection2);

                entry.fillRects(
                    intersectionXY1.x,
                    intersectionXY1.y,
                    intersectionXY2.x,
                    intersectionXY2.y,
                    radius
                );
            }
        }
    }

    /**
     * Returns whether to hide the channel from being drawn based on params.
     *
     * @param {number} channelIndex The index of the current channel.
     * @returns {bool} True to hide the channel, false to draw.
     */
    hideChannel(channelIndex) {
        return this.params.splitChannels && this.params.splitChannelsOptions.filterChannels.includes(channelIndex);
    }

    /**
     * Performs preparation tasks and calculations which are shared by `drawBars`
     * and `drawWave`
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays for
     * split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The offset of the beginning of the area that
     * should be rendered. If this isn't set only a flat line is rendered
     * @param {number?} end The offset of the end of the area that should be
     * rendered
     * @param {function} fn The render function to call, e.g. `drawWave`
     * @param {number} drawIndex The index of the current channel after filtering.
     * @param {number?} normalizedMax Maximum modulation value across channels for use with relativeNormalization. Ignored when undefined
     * @returns {void}
     */
    prepareDraw(peaks, channelIndex, start, end, fn, drawIndex, normalizedMax) {
        return util.frame(() => {
            // Split channels and call this function with the channelIndex set
            if (peaks[0] instanceof Array) {
                const channels = peaks;

                if (this.params.splitChannels) {
                    const filteredChannels = channels.filter((c, i) => !this.hideChannel(i));
                    if (!this.params.splitChannelsOptions.overlay) {
                        this.setCrossAxisSize(
                            Math.max(filteredChannels.length, 1) *
                                this.orientation.nominalCrossAxisSize *
                                this.params.pixelRatio
                        );
                    }

                    let overallAbsMax;
                    if (this.params.splitChannelsOptions && this.params.splitChannelsOptions.relativeNormalization) {
                        // calculate maximum peak across channels to use for normalization
                        overallAbsMax = util.max(channels.map((channelPeaks => util.absMax(channelPeaks))));
                    }


                    return channels.forEach((channelPeaks, i) =>
                        this.prepareDraw(channelPeaks, i, start, end, fn, filteredChannels.indexOf(channelPeaks), overallAbsMax)
                    );
                }
                peaks = channels[0];
            }

            // Return and do not draw channel peaks if hidden.
            if (this.hideChannel(channelIndex)) {
                return;
            }

            // calculate maximum modulation value, either from the barHeight
            // parameter or if normalize=true from the largest value in the peak
            // set
            let absmax = 1 / this.params.barHeight;
            if (this.params.normalize) {
                absmax = normalizedMax === undefined ? util.absMax(peaks) : normalizedMax;
            }

            // Bar wave draws the bottom only as a reflection of the top,
            // so we don't need negative values
            const hasMinVals = [].some.call(peaks, val => val < 0);
            const crossAxisSize = this.orientation.crossAxisSize * this.params.pixelRatio;

            let crossAxisOffset = crossAxisSize * drawIndex || 0;

            // Override offsetY if overlay is true
            if (this.params.splitChannelsOptions && this.params.splitChannelsOptions.overlay) {
                crossAxisOffset = 0;
            }

            return fn({
                absmax: absmax,
                hasMinVals: hasMinVals,
                crossAxisSize: crossAxisSize,
                crossAxisOffset: crossAxisOffset,
                halfCrossAxis: crossAxisSize / 2,
                peaks: peaks,
                channelIndex: channelIndex
            });
        })();
    }

    /**
     * Set the fill styles for a certain entry (wave and progress)
     *
     * @param {CanvasEntry} entry Target entry
     * @param {string} waveColor Wave color to draw this entry
     * @param {string} progressColor Progress color to draw this entry
     */
    setFillStyles(entry, waveColor = this.params.waveColor, progressColor = this.params.progressColor) {
        entry.setFillStyles(waveColor, progressColor);
    }

    /**
     * Return image data of the multi-canvas
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
            return Promise.all(
                this.canvases.map(entry => {
                    return entry.getImage(format, quality, type);
                })
            );
        } else if (type === 'dataURL') {
            let images = this.canvases.map(entry =>
                entry.getImage(format, quality, type)
            );
            return images.length > 1 ? images : images[0];
        }
    }

    /**
     * Render the new progress
     *
     * @param {number} position X-offset of progress position in pixels
     */
    updateProgress(position) {
        this.style(this.progressWave, { [this.orientation.mainAxisSizeAttr]: position + 'px' });
    }
}
