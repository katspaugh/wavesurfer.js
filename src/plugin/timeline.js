/**
 * @typedef {Object} TimelinePluginParams
 * @desc Extends the `WavesurferParams` wavesurfer was initialised with
 * @property {!string|HTMLElement} container CSS selector or HTML element where
 * the timeline should be drawn. This is the only required parameter.
 * @property {number} notchPercentHeight=90 Height of notches in percent
 * @property {string} primaryColor='#000' The colour of the main notches
 * @property {string} secondaryColor='#c0c0c0' The colour of the secondary
 * notches
 * @property {string} primaryFontColor='#000' The colour of the labels next to
 * the main notches
 * @property {string} secondaryFontColor='#000' The colour of the labels next to
 * the secondary notches
 * @property {number} labelPadding=5 The padding between the label and the notch
 * @property {?number} zoomDebounce A debounce timeout to increase rendering
 * performance for large files
 * @property {string} fontFamily='Arial'
 * @property {number} fontSize=10 Font size of labels in pixels
 * @property {function} formatTimeCallback=→00:00
 * @property {?boolean} deferInit Set to true to manually call
 * `initPlugin('timeline')`
 */

/**
 * Adds a timeline to the waveform.
 *
 * @implements {PluginClass}
 * @extends {Observer}
 * @example
 * // es6
 * import TimelinePlugin from 'wavesurfer.timeline.js';
 *
 * // commonjs
 * var TimelinePlugin = require('wavesurfer.timeline.js');
 *
 * // if you are using <script> tags
 * var TimelinePlugin = window.WaveSurfer.timeline;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     TimelinePlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class TimelinePlugin {
    /**
     * Timeline plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param  {TimelinePluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'timeline',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            instance: TimelinePlugin
        };
    }

    // event handlers
    /** @private */
    _onScroll = () => {
        if (this.wrapper && this.drawer.wrapper) {
            this.wrapper.scrollLeft = this.drawer.wrapper.scrollLeft;
        }
    };
    /** @private */
    _onRedraw = () => this.render();
    /** @private */
    _onReady = () => {
        const ws = this.wavesurfer;
        this.drawer = ws.drawer;
        this.pixelRatio = ws.drawer.params.pixelRatio;
        this.maxCanvasWidth = ws.drawer.maxCanvasWidth || ws.drawer.width;
        this.maxCanvasElementWidth =
            ws.drawer.maxCanvasElementWidth ||
            Math.round(this.maxCanvasWidth / this.pixelRatio);

        ws.drawer.wrapper.addEventListener('scroll', this._onScroll);
        ws.on('redraw', this._onRedraw);
        ws.on('zoom', this._onZoom);
        this.render();
    };
    /** @private */
    _onWrapperClick = e => {
        e.preventDefault();
        const relX = 'offsetX' in e ? e.offsetX : e.layerX;
        this.fireEvent('click', relX / this.wrapper.scrollWidth || 0);
    };

    /**
     * Creates an instance of TimelinePlugin.
     *
     * You probably want to use TimelinePlugin.create()
     *
     * @param {TimelinePluginParams} params Plugin parameters
     * @param {object} ws Wavesurfer instance
     */
    constructor(params, ws) {
        /** @private */
        this.container =
            'string' == typeof params.container
                ? document.querySelector(params.container)
                : params.container;

        if (!this.container) {
            throw new Error('No container for wavesurfer timeline');
        }
        /** @private */
        this.wavesurfer = ws;
        /** @private */
        this.util = ws.util;
        /** @private */
        this.params = this.util.extend(
            {},
            {
                height: 20,
                notchPercentHeight: 90,
                labelPadding: 5,
                primaryColor: '#000',
                secondaryColor: '#c0c0c0',
                primaryFontColor: '#000',
                secondaryFontColor: '#000',
                fontFamily: 'Arial',
                fontSize: 10,
                zoomDebounce: false,
                formatTimeCallback(seconds) {
                    if (seconds / 60 > 1) {
                        // calculate minutes and seconds from seconds count
                        const minutes = parseInt(seconds / 60, 10);
                        seconds = parseInt(seconds % 60, 10);
                        // fill up seconds with zeroes
                        seconds = seconds < 10 ? '0' + seconds : seconds;
                        return `${minutes}:${seconds}`;
                    }
                    return Math.round(seconds * 1000) / 1000;
                },
                timeInterval(pxPerSec) {
                    if (pxPerSec >= 25) {
                        return 1;
                    } else if (pxPerSec * 5 >= 25) {
                        return 5;
                    } else if (pxPerSec * 15 >= 25) {
                        return 15;
                    }
                    return Math.ceil(0.5 / pxPerSec) * 60;
                },
                primaryLabelInterval(pxPerSec) {
                    if (pxPerSec >= 25) {
                        return 10;
                    } else if (pxPerSec * 5 >= 25) {
                        return 6;
                    } else if (pxPerSec * 15 >= 25) {
                        return 4;
                    }
                    return 4;
                },
                secondaryLabelInterval(pxPerSec) {
                    if (pxPerSec >= 25) {
                        return 5;
                    } else if (pxPerSec * 5 >= 25) {
                        return 2;
                    } else if (pxPerSec * 15 >= 25) {
                        return 2;
                    }
                    return 2;
                }
            },
            params
        );

        /** @private */
        this.canvases = [];
        /** @private */
        this.wrapper = null;
        /** @private */
        this.drawer = null;
        /** @private */
        this.pixelRatio = null;
        /** @private */
        this.maxCanvasWidth = null;
        /** @private */
        this.maxCanvasElementWidth = null;
        /**
         * This event handler has to be in the constructor function because it
         * relies on the debounce function which is only available after
         * instantiation
         *
         * Use a debounced function if zoomDebounce is defined
         *
         * @private
         */
        this._onZoom = this.params.zoomDebounce
            ? this.wavesurfer.util.debounce(
                  () => this.render(),
                  this.params.zoomDebounce
              )
            : () => this.render();
    }

    /**
     * Initialisation function used by the plugin API
     */
    init() {
        this.wavesurfer.on('ready', this._onReady);
        // Check if ws is ready
        if (this.wavesurfer.isReady) {
            this._onReady();
        }
    }

    /**
     * Destroy function used by the plugin API
     */
    destroy() {
        this.unAll();
        this.wavesurfer.un('redraw', this._onRedraw);
        this.wavesurfer.un('zoom', this._onZoom);
        this.wavesurfer.un('ready', this._onReady);
        this.wavesurfer.drawer.wrapper.removeEventListener(
            'scroll',
            this._onScroll
        );
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.removeEventListener('click', this._onWrapperClick);
            this.wrapper.parentNode.removeChild(this.wrapper);
            this.wrapper = null;
        }
    }

    /**
     * Create a timeline element to wrap the canvases drawn by this plugin
     *
     * @private
     */
    createWrapper() {
        const wsParams = this.wavesurfer.params;
        this.container.innerHTML = '';
        this.wrapper = this.container.appendChild(
            document.createElement('timeline')
        );
        this.util.style(this.wrapper, {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
            webkitUserSelect: 'none',
            height: `${this.params.height}px`
        });

        if (wsParams.fillParent || wsParams.scrollParent) {
            this.util.style(this.wrapper, {
                width: '100%',
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
        }

        this.wrapper.addEventListener('click', this._onWrapperClick);
    }

    /**
     * Render the timeline (also updates the already rendered timeline)
     *
     * @private
     */
    render() {
        if (!this.wrapper) {
            this.createWrapper();
        }
        this.updateCanvases();
        this.updateCanvasesPositioning();
        this.renderCanvases();
    }

    /**
     * Make sure the correct of timeline canvas elements exist and are cached in
     * this.canvases
     *
     * @private
     */
    updateCanvases() {
        const addCanvas = () => {
            const canvas = this.wrapper.appendChild(
                document.createElement('canvas')
            );
            this.canvases.push(canvas);
            this.util.style(canvas, {
                position: 'absolute',
                zIndex: 4
            });
        };
        const removeCanvas = () => {
            const canvas = this.canvases.pop();
            canvas.parentElement.removeChild(canvas);
        };

        const totalWidth = Math.round(this.drawer.wrapper.scrollWidth);
        const requiredCanvases = Math.ceil(
            totalWidth / this.maxCanvasElementWidth
        );
        while (this.canvases.length < requiredCanvases) {
            addCanvas();
        }

        while (this.canvases.length > requiredCanvases) {
            removeCanvas();
        }
    }

    /**
     * Update the dimensions and positioning style for all the timeline canvases
     *
     * @private
     */
    updateCanvasesPositioning() {
        // cache length for perf
        const canvasesLength = this.canvases.length;
        this.canvases.forEach((canvas, i) => {
            // canvas width is the max element width, or if it is the last the
            // required width
            const canvasWidth =
                i === canvasesLength - 1
                    ? this.drawer.wrapper.scrollWidth -
                      this.maxCanvasElementWidth * (canvasesLength - 1)
                    : this.maxCanvasElementWidth;
            // set dimensions and style
            canvas.width = canvasWidth * this.pixelRatio;
            // on certain pixel ratios the canvas appears cut off at the bottom,
            // therefore leave 1px extra
            canvas.height = (this.params.height + 1) * this.pixelRatio;
            this.util.style(canvas, {
                width: `${canvasWidth}px`,
                height: `${this.params.height}px`,
                left: `${i * this.maxCanvasElementWidth}px`
            });
        });
    }

    /**
     * Render the timeline labels and notches
     *
     * @private
     */
    renderCanvases() {
        const duration = this.wavesurfer.backend.getDuration();
        if (duration <= 0) {
            return;
        }
        const wsParams = this.wavesurfer.params;
        const fontSize = this.params.fontSize * wsParams.pixelRatio;
        const totalSeconds = parseInt(duration, 10) + 1;
        const width =
            wsParams.fillParent && !wsParams.scrollParent
                ? this.drawer.getWidth()
                : this.drawer.wrapper.scrollWidth * wsParams.pixelRatio;
        const height1 = this.params.height * this.pixelRatio;
        const height2 =
            this.params.height *
            (this.params.notchPercentHeight / 100) *
            this.pixelRatio;
        const pixelsPerSecond = width / duration;

        const formatTime = this.params.formatTimeCallback;
        // if parameter is function, call the function with
        // pixelsPerSecond, otherwise simply take the value as-is
        const intervalFnOrVal = option =>
            typeof option === 'function' ? option(pixelsPerSecond) : option;
        const timeInterval = intervalFnOrVal(this.params.timeInterval);
        const primaryLabelInterval = intervalFnOrVal(
            this.params.primaryLabelInterval
        );
        const secondaryLabelInterval = intervalFnOrVal(
            this.params.secondaryLabelInterval
        );

        let curPixel = 0;
        let curSeconds = 0;
        let i;
        // build an array of position data with index, second and pixel data,
        // this is then used multiple times below
        const positioning = [];
        for (i = 0; i < totalSeconds / timeInterval; i++) {
            positioning.push([i, curSeconds, curPixel]);
            curSeconds += timeInterval;
            curPixel += pixelsPerSecond * timeInterval;
        }

        // iterate over each position
        const renderPositions = cb => {
            positioning.forEach(pos => {
                cb(pos[0], pos[1], pos[2]);
            });
        };

        // render primary labels
        this.setFillStyles(this.params.primaryColor);
        this.setFonts(`${fontSize}px ${this.params.fontFamily}`);
        this.setFillStyles(this.params.primaryFontColor);
        renderPositions((i, curSeconds, curPixel) => {
            if (i % primaryLabelInterval === 0) {
                this.fillRect(curPixel, 0, 1, height1);
                this.fillText(
                    formatTime(curSeconds),
                    curPixel + this.params.labelPadding * this.pixelRatio,
                    height1
                );
            }
        });

        // render secondary labels
        this.setFillStyles(this.params.secondaryColor);
        this.setFonts(`${fontSize}px ${this.params.fontFamily}`);
        this.setFillStyles(this.params.secondaryFontColor);
        renderPositions((i, curSeconds, curPixel) => {
            if (i % secondaryLabelInterval === 0) {
                this.fillRect(curPixel, 0, 1, height1);
                this.fillText(
                    formatTime(curSeconds),
                    curPixel + this.params.labelPadding * this.pixelRatio,
                    height1
                );
            }
        });

        // render the actual notches (when no labels are used)
        this.setFillStyles(this.params.secondaryColor);
        renderPositions((i, curSeconds, curPixel) => {
            if (
                i % secondaryLabelInterval !== 0 &&
                i % primaryLabelInterval !== 0
            ) {
                this.fillRect(curPixel, 0, 1, height2);
            }
        });
    }

    /**
     * Set the canvas fill style
     *
     * @param {DOMString|CanvasGradient|CanvasPattern} fillStyle
     * @private
     */
    setFillStyles(fillStyle) {
        this.canvases.forEach(canvas => {
            canvas.getContext('2d').fillStyle = fillStyle;
        });
    }

    /**
     * Set the canvas font
     *
     * @param {DOMString} font
     * @private
     */
    setFonts(font) {
        this.canvases.forEach(canvas => {
            canvas.getContext('2d').font = font;
        });
    }

    /**
     * Draw a rectangle on the canvases
     *
     * (it figures out the offset for each canvas)
     *
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @private
     */
    fillRect(x, y, width, height) {
        this.canvases.forEach((canvas, i) => {
            const leftOffset = i * this.maxCanvasWidth;

            const intersection = {
                x1: Math.max(x, i * this.maxCanvasWidth),
                y1: y,
                x2: Math.min(x + width, i * this.maxCanvasWidth + canvas.width),
                y2: y + height
            };

            if (intersection.x1 < intersection.x2) {
                canvas
                    .getContext('2d')
                    .fillRect(
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1
                    );
            }
        });
    }

    /**
     * Fill a given text on the canvases
     *
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @private
     */
    fillText(text, x, y) {
        let textWidth;
        let xOffset = 0;

        this.canvases.forEach(canvas => {
            const context = canvas.getContext('2d');
            const canvasWidth = context.canvas.width;

            if (xOffset > x + textWidth) {
                return;
            }

            if (xOffset + canvasWidth > x) {
                textWidth = context.measureText(text).width;
                context.fillText(text, x - xOffset, y);
            }

            xOffset += canvasWidth;
        });
    }
}
