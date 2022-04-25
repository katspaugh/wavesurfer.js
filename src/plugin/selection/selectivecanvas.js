import * as util from '../../util';
import CanvasEntry from '../../drawer.canvasentry';
import MultiCanvas from '../../drawer.multicanvas';

/**
 * SelectiveCanvas renderer for wavesurfer. Is currently the default and sole
 * builtin renderer.
 *
 * A `SelectiveCanvas` consists of one or more `CanvasEntry` instances, depending
 * on the zoom level.
 */
export default class SelectiveCanvas extends MultiCanvas {
    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    constructor(container, params) {
        super(container, params);

        /**
         * @type {number}
         */
        this.maxCanvasWidth = params.maxCanvasWidth;

        /**
         * @type {number}
         */
        this.maxCanvasElementWidth = Math.round(
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

        // selection reference
        this.selection = null;

        this.displayStart = 0;
        this.displayDuration = 0;

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

        /**
         * Whether to render the waveform vertically. Defaults to false.
         *
         * @type {boolean}
         */
        this.vertical = params.vertical;
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
        this.progressWave = util.withOrientation(
            this.wrapper.appendChild(document.createElement('wave')),
            this.params.vertical
        );
        this.style(this.progressWave, {
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
        });

        this.addCanvas();
        this.updateCursor();
    }

    updateSelection(selection) {
        this.selection = selection;
    }

    updateDisplayState({
        displayStart,
        displayDuration
    }) {
        this.displayDuration = displayDuration || this.displayDuration,
        this.displayStart = displayStart !== undefined ? displayStart : this.displayStart;
    }

    /**
     * Update cursor style
     */
    updateCursor() {
        this.style(this.progressWave, {
            borderRightWidth: this.params.cursorWidth + 'px',
            borderRightColor: this.params.cursorColor
        });
    }

    /**
     * Adjust to the updated size by adding or removing canvases
     */
    updateSize() {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(
            totalWidth / (this.maxCanvasElementWidth + this.overlap)
        );
        const displayPixelWidth = (
            (this.selection?.wavesurfer.getDisplayRange().duration || 0)
            * this.params.minPxPerSec
            * this.params.pixelRatio
        );

        // add required canvases
        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        // remove older existing canvases, if any
        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        let canvasWidth = this.maxCanvasWidth + this.overlap;
        const lastCanvas = this.canvases.length - 1;
        this.canvases.forEach((entry, i) => {
            if (i == lastCanvas) {
                canvasWidth = Math.max(
                    this.width - this.maxCanvasWidth * lastCanvas,
                    displayPixelWidth
                );
            }
            this.updateDimensions(entry, canvasWidth, this.height);

            entry.clearWave();
        });
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
            ({ absmax, hasMinVals, height, offsetY, halfH, peaks, channelIndex: ch }) => {
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

                let last = end;
                let peakIndex = first;
                if (this.selection) {
                    last = Math.floor(this.selection.end * this.params.minPxPerSec * this.params.pixelRatio);
                    peakIndex = Math.floor(this.selection.start * this.params.minPxPerSec * this.params.pixelRatio);
                }
                const displayOffset = this.displayStart * this.params.minPxPerSec * this.params.pixelRatio;

                const hideBarEnds = 1;
                const adjustedDrawStart = peakIndex + step * hideBarEnds;
                const adjustedDrawEnd = last - step * hideBarEnds;

                for (peakIndex; peakIndex < last; peakIndex += step) {

                    // search for the highest peak in the range this bar falls into
                    let peak = 0;
                    // normedIndex forces bars to be started at multiples of the step
                    // so that moving the start doesn't cause a recalculation of the bars
                    const normedIndex = peakIndex - (peakIndex % step);
                    let peakIndexRange = Math.floor(normedIndex * scale) * peakIndexScale; // start index
                    const peakIndexEnd = Math.floor((normedIndex + step) * scale) * peakIndexScale;
                    do { // do..while makes sure at least one peak is always evaluated
                        const newPeak = peaks[peakIndexRange];
                        if (newPeak > peak) {
                            peak = newPeak; // higher
                        }
                        peakIndexRange += peakIndexScale; // skip every other value for negatives
                    } while (peakIndexRange < peakIndexEnd);

                    // calculate the height of this bar according to the highest peak found
                    let h = Math.round((peak / absmax) * halfH);

                    // in case of silences, allow the user to specify that we
                    // always draw *something* (normally a 1px high bar)
                    if (h == 0 && this.params.barMinHeight) {
                        h = this.params.barMinHeight;
                    }

                    if (peakIndex > adjustedDrawStart && peakIndex < adjustedDrawEnd) {
                        this.fillRect(
                            normedIndex - displayOffset + this.halfPixel,
                            halfH - h + offsetY,
                            bar + this.halfPixel,
                            h * 2,
                            this.barRadius,
                            ch
                        );
                    }
                }
            }
        );
    }

    /**
     * Draw a rectangle on the multi-canvas
     *
     * @param {number} x X-position of the rectangle
     * @param {number} y Y-position of the rectangle
     * @param {number} width Width of the rectangle
     * @param {number} height Height of the rectangle
     * @param {number} radius Radius of the rectangle
     * @param {channelIndex} channelIndex The channel index of the bar drawn
     */
    fillRect(x, y, width, height, radius, channelIndex) {
        const startCanvas = Math.floor(x / this.maxCanvasWidth);
        const endCanvas = Math.min(
            Math.ceil((x + width) / this.maxCanvasWidth) + 1,
            this.canvases.length
        );
        let i = startCanvas;
        // catch < 0 case that can happen temporarily during resizing
        if (i < 0) {return;}

        for (i; i < endCanvas; i++) {
            const entry = this.canvases[i];
            const leftOffset = i * this.maxCanvasWidth;

            const intersection = {
                x1: Math.max(x, i * this.maxCanvasWidth),
                y1: y,
                x2: Math.min(
                    x + width,
                    i * this.maxCanvasWidth + entry.wave.width
                ),
                y2: y + height
            };

            if (intersection.x1 < intersection.x2) {
                const { waveColor, progressColor } = this.params.splitChannelsOptions.channelColors[channelIndex] || {};
                this.setFillStyles(entry, waveColor, progressColor);
                this.applyCanvasTransforms(entry, this.params.vertical);

                entry.fillRects(
                    intersection.x1 - leftOffset,
                    intersection.y1,
                    intersection.x2 - intersection.x1,
                    intersection.y2 - intersection.y1,
                    radius
                );
            }
        }
    }

    /**
     * Performs preparation tasks and calculations which are shared by `drawBars`
     * and `drawWave`
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays for
     * split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered. If this isn't set only a flat line is rendered
     * @param {number?} end The x-offset of the end of the area that should be
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
                        this.setHeight(
                            Math.max(filteredChannels.length, 1) *
                                this.params.height *
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
            const height = this.params.height * this.params.pixelRatio;
            const halfH = height / 2;

            let offsetY = height * drawIndex || 0;

            // Selective canvas widths can be longer than the duration of the audio sample.
            // As a result the peaks array becomes padded with undefined data.
            // This strips this data if present

            // The array should have 2 trailing elements, which we retain
            const endPeaksToPreserve = 2;

            if ( peaks instanceof Array) {
                peaks = peaks.slice(0, -endPeaksToPreserve).filter((e)=> e !== undefined).concat(peaks.slice(-endPeaksToPreserve));
            }

            // Override offsetY if overlay is true
            if (this.params.splitChannelsOptions && this.params.splitChannelsOptions.overlay) {
                offsetY = 0;
            }

            return fn({
                absmax: absmax,
                hasMinVals: hasMinVals,
                height: height,
                offsetY: offsetY,
                halfH: halfH,
                peaks: peaks,
                channelIndex: channelIndex
            });
        })();
    }

    /**
     * Handle click event
     *
     * @param {Event} e Click event
     * @param {?boolean} noPrevent Set to true to not call `e.preventDefault()`
     * @return {number} Playback position from 0 to 1
     */
    handleEvent(e, noPrevent) {
        !noPrevent && e.preventDefault();

        const clientX = util.withOrientation(
            e.targetTouches ? e.targetTouches[0] : e,
            this.params.vertical
        ).clientX;
        const bbox = this.wrapper.getBoundingClientRect();

        const nominalWidth = this.width;
        const parentWidth = this.getWidth();
        const progressPixels = this.getProgressPixels(bbox, clientX);

        const progress = progressPixels *
                    (this.params.pixelRatio / parentWidth) || 0;


        return util.clamp(progress, 0, 1);
    }

    /**
     * Render the new progress
     *
     * @param {number} position X-offset of progress position in pixels
     */
    updateProgress(position) {
        const displayOffset = this.displayStart * this.params.minPxPerSec;
        const offsetPosition = position - displayOffset;
        this.style(this.progressWave, { width: offsetPosition + 'px' });
    }
}

export { SelectiveCanvas };