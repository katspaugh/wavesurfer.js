/**
 * @typedef {Object} CursorPluginParams
 * @property {?boolean} deferInit Set to true to stop auto init in `addPlugin()`
 * @property {boolean} hideOnBlur=true Hide the cursor when the mouse leaves the
 * waveform
 * @property {string} width='1px' The width of the cursor
 * @property {string} color='black' The color of the cursor
 * @property {string} opacity='0.25' The opacity of the cursor
 * @property {string} style='solid' The border style of the cursor
 * @property {number} zIndex=3 The z-index of the cursor element
 * @property {object} customStyle An object with custom styles which are applied
 * to the cursor element
 * @property {boolean} showTime=false Show the time on the cursor.
 * @property {object} customShowTimeStyle An object with custom styles which are
 * applied to the cursor time element.
 * @property {string} followCursorY=false Use `true` to make the time on
 * the cursor follow the x and the y-position of the mouse. Use `false` to make the
 * it only follow the x-position of the mouse.
 * @property {function} formatTimeCallback Formats the timestamp on the cursor.
 */

/**
 * Displays a thin line at the position of the cursor on the waveform.
 *
 * @implements {PluginClass}
 * @extends {Observer}
 * @example
 * // es6
 * import CursorPlugin from 'wavesurfer.cursor.js';
 *
 * // commonjs
 * var CursorPlugin = require('wavesurfer.cursor.js');
 *
 * // if you are using <script> tags
 * var CursorPlugin = window.WaveSurfer.cursor;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     CursorPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class CursorPlugin {
    /**
     * Cursor plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param  {CursorPluginParams} params parameters use to initialise the
     * plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'cursor',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {},
            instance: CursorPlugin
        };
    }

    /**
     * @type {CursorPluginParams}
     */
    defaultParams = {
        hideOnBlur: true,
        width: '1px',
        color: 'black',
        opacity: '0.25',
        style: 'solid',
        zIndex: 4,
        customStyle: {},
        customShowTimeStyle: {},
        showTime: false,
        followCursorY: false,
        formatTimeCallback: null
    };

    /**
     * @private
     * @param {object} e Mouse move event
     */
    _onMousemove = e => {
        const bbox = this.wavesurfer.container.getBoundingClientRect();
        let y = 0;
        let x = e.clientX - bbox.left;
        let flip = bbox.right < e.clientX + this.outerWidth(this.displayTime);

        if (this.params.showTime && this.params.followCursorY) {
            // follow y-position of the mouse
            y = e.clientY - (bbox.top + bbox.height / 2);
        }

        this.updateCursorPosition(x, y, flip);
    };

    /**
     * @private
     * @returns {void}
     */
    _onMouseenter = () => this.showCursor();

    /**
     * @private
     * @returns {void}
     */
    _onMouseleave = () => this.hideCursor();

    /**
     * Construct the plugin class. You probably want to use `CursorPlugin.create`
     * instead.
     *
     * @param {CursorPluginParams} params Plugin parameters
     * @param {object} ws Wavesurfer instance
     */
    constructor(params, ws) {
        /** @private */
        this.wavesurfer = ws;
        /** @private */
        this.style = ws.util.style;
        /**
         * The cursor HTML element
         *
         * @type {?HTMLElement}
         */
        this.cursor = null;
        /**
         * displays the time next to the cursor
         *
         * @type {?HTMLElement}
         */
        this.showTime = null;
        /**
         * The html container that will display the time
         *
         * @type {?HTMLElement}
         */
        this.displayTime = null;
        /** @private */
        this.params = Object.assign({}, this.defaultParams, params);
    }

    /**
     * Initialise the plugin (used by the Plugin API)
     */
    init() {
        this.wrapper = this.wavesurfer.container;
        this.cursor = this.wrapper.appendChild(
            this.style(
                document.createElement('cursor'),
                Object.assign(
                    {
                        position: 'absolute',
                        zIndex: this.params.zIndex,
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '0',
                        display: 'flex',
                        borderRightStyle: this.params.style,
                        borderRightWidth: this.params.width,
                        borderRightColor: this.params.color,
                        opacity: this.params.opacity,
                        pointerEvents: 'none'
                    },
                    this.params.customStyle
                )
            )
        );
        if (this.params.showTime) {
            this.showTime = this.wrapper.appendChild(
                this.style(
                    document.createElement('showTitle'),
                    Object.assign(
                        {
                            position: 'absolute',
                            zIndex: this.params.zIndex,
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 'auto',
                            display: 'flex',
                            opacity: this.params.opacity,
                            pointerEvents: 'none',
                            height: '100%'
                        },
                        this.params.customStyle
                    )
                )
            );
            this.displayTime = this.showTime.appendChild(
                this.style(
                    document.createElement('div'),
                    Object.assign(
                        {
                            display: 'inline',
                            pointerEvents: 'none',
                            margin: 'auto',
                            visibility: 'hidden' // initial value will be hidden just for measuring purpose
                        },
                        this.params.customShowTimeStyle
                    )
                )
            );
            // initial value to measure display width
            this.displayTime.innerHTML = this.formatTime(0);
        }

        this.wrapper.addEventListener('mousemove', this._onMousemove);
        if (this.params.hideOnBlur) {
            // ensure elements are hidden initially
            this.hideCursor();
            this.wrapper.addEventListener('mouseenter', this._onMouseenter);
            this.wrapper.addEventListener('mouseleave', this._onMouseleave);
        }
    }

    /**
     * Destroy the plugin (used by the Plugin API)
     */
    destroy() {
        if (this.params.showTime) {
            this.cursor.parentNode.removeChild(this.showTime);
        }
        this.cursor.parentNode.removeChild(this.cursor);
        this.wrapper.removeEventListener('mousemove', this._onMousemove);
        if (this.params.hideOnBlur) {
            this.wrapper.removeEventListener('mouseenter', this._onMouseenter);
            this.wrapper.removeEventListener('mouseleave', this._onMouseleave);
        }
    }

    /**
     * Update the cursor position
     *
     * @param {number} xpos The x offset of the cursor in pixels
     * @param {number} ypos The y offset of the cursor in pixels
     * @param {boolean} flip Flag to flip duration text from right to left
     */
    updateCursorPosition(xpos, ypos, flip = false) {
        this.style(this.cursor, {
            left: `${xpos}px`
        });
        if (this.params.showTime) {
            const duration = this.wavesurfer.getDuration();
            const elementWidth =
                this.wavesurfer.drawer.width /
                this.wavesurfer.params.pixelRatio;
            const scrollWidth = this.wavesurfer.drawer.getScrollX();

            const scrollTime =
                (duration / this.wavesurfer.drawer.width) * scrollWidth;

            const timeValue =
                Math.max(0, (xpos / elementWidth) * duration) + scrollTime;
            const formatValue = this.formatTime(timeValue);
            if (flip) {
                const textOffset = this.outerWidth(this.displayTime);
                xpos -= textOffset;
            }
            this.style(this.showTime, {
                left: `${xpos}px`,
                top: `${ypos}px`
            });
            this.style(this.displayTime, {
                visibility: 'visible'
            });
            this.displayTime.innerHTML = `${formatValue}`;
        }
    }

    /**
     * Show the cursor
     */
    showCursor() {
        this.style(this.cursor, {
            display: 'flex'
        });
        if (this.params.showTime) {
            this.style(this.showTime, {
                display: 'flex'
            });
        }
    }

    /**
     * Hide the cursor
     */
    hideCursor() {
        this.style(this.cursor, {
            display: 'none'
        });
        if (this.params.showTime) {
            this.style(this.showTime, {
                display: 'none'
            });
        }
    }

    /**
     * Format the timestamp for `cursorTime`.
     *
     * @param {number} cursorTime Time in seconds
     * @returns {string} Formatted timestamp
     */
    formatTime(cursorTime) {
        cursorTime = isNaN(cursorTime) ? 0 : cursorTime;

        if (this.params.formatTimeCallback) {
            return this.params.formatTimeCallback(cursorTime);
        }
        return [cursorTime].map(time =>
            [
                Math.floor((time % 3600) / 60), // minutes
                ('00' + Math.floor(time % 60)).slice(-2), // seconds
                ('000' + Math.floor((time % 1) * 1000)).slice(-3) // milliseconds
            ].join(':')
        );
    }

    /**
     * Get outer width of given element.
     *
     * @param {DOM} element DOM Element
     * @returns {number} outer width
     */
    outerWidth(element) {
        if (!element) return 0;

        let width = element.offsetWidth;
        let style = getComputedStyle(element);

        width += parseInt(style.marginLeft + style.marginRight);
        return width;
    }
}
