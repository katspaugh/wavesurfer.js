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
            staticProps: {
                enableCursor() {
                    console.warn('Deprecated enableCursor!');
                    this.initPlugins('cursor');
                }
            },
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
        customStyle: {}
    };

    /** @private */
    _onMousemove = e => {
        const bbox = this.wavesurfer.container.getBoundingClientRect();
        this.updateCursorPosition(e.clientX - bbox.left);
    };
    /** @private */
    _onMouseenter = () => this.showCursor();
    /** @private */
    _onMouseleave = () => this.hideCursor();

    /**
     * Construct the plugin class. You probably want to use CursorPlugin.create
     * instead.
     *
     * @param {CursorPluginParams} params
     * @param {object} ws
     */
    constructor(params, ws) {
        /** @private */
        this.wavesurfer = ws;
        /** @private */
        this.style = ws.util.style;
        /**
         * The cursor html element
         *
         * @type {?HTMLElement}
         */
        this.cursor = null;
        /** @private */
        this.params = ws.util.extend({}, this.defaultParams, params);
    }

    /**
     * Initialise the plugin (used by the Plugin API)
     */
    init() {
        const wrapper = this.wavesurfer.container;
        this.cursor = wrapper.appendChild(
            this.style(
                document.createElement('cursor'),
                this.wavesurfer.util.extend(
                    {
                        position: 'absolute',
                        zIndex: this.params.zIndex,
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '0',
                        display: 'block',
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

        wrapper.addEventListener('mousemove', this._onMousemove);
        if (this.params.hideOnBlur) {
            wrapper.addEventListener('mouseenter', this._onMouseenter);
            wrapper.addEventListener('mouseleave', this._onMouseleave);
        }
    }

    /**
     * Destroy the plugin (used by the Plugin API)
     */
    destroy() {
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
     * @param {number} pos The x offset of the cursor in pixels
     */
    updateCursorPosition(pos) {
        this.style(this.cursor, {
            left: `${pos}px`
        });
    }

    /**
     * Show the cursor
     */
    showCursor() {
        this.style(this.cursor, {
            display: 'block'
        });
    }

    /**
     * Hide the cursor
     */
    hideCursor() {
        this.style(this.cursor, {
            display: 'none'
        });
    }
}
