/**
 * @typedef {Object} CursorPluginParams
 * @property {?boolean} deferInit Set to true to stop auto init in `addPlugin()`
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

    constructor(params, ws) {
        this.wavesurfer = ws;
        this.style = ws.util.style;
        this._onDrawerCreated = () => {
            this.drawer = this.wavesurfer.drawer;
            this.wrapper = this.wavesurfer.drawer.wrapper;

            this._onMousemove = e => this.updateCursorPosition(this.drawer.handleEvent(e));
            this.wrapper.addEventListener('mousemove', this._onMousemove);

            this._onMouseenter = () => this.showCursor();
            this.wrapper.addEventListener('mouseenter', this._onMouseenter);

            this._onMouseleave = () => this.hideCursor();
            this.wrapper.addEventListener('mouseleave', this._onMouseleave);

            this.cursor = this.wrapper.appendChild(
                this.style(document.createElement('wave'), {
                    position: 'absolute',
                    zIndex: 3,
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '0',
                    display: 'block',
                    borderRightStyle: 'solid',
                    borderRightWidth: 1 + 'px',
                    borderRightColor: 'black',
                    opacity: '.25',
                    pointerEvents: 'none'
                })
            );
        };
    }

    init() {
        // drawer already existed, just call initialisation code
        if (this.wavesurfer.drawer) {
            this._onDrawerCreated();
        }

        // the drawer was initialised, call the initialisation code
        this.wavesurfer.on('drawer-created', this._onDrawerCreated);
    }

    destroy() {
        this.wavesurfer.un('drawer-created', this._onDrawerCreated);

        // if cursor was appended, remove it
        if (this.cursor) {
            this.cursor.parentNode.removeChild(this.cursor);
        }

        // if the drawer existed (the cached version referenced in the init code),
        // remove the event listeners attached to it
        if (this.drawer) {
            this.wrapper.removeEventListener('mousemove', this._onMousemove);
            this.wrapper.removeEventListener('mouseenter', this._onMouseenter);
            this.wrapper.removeEventListener('mouseleave', this._onMouseleave);
        }
    }

    updateCursorPosition(progress) {
        const pos = Math.round(this.drawer.width * progress) / this.drawer.params.pixelRatio - 1;
        this.style(this.cursor, {
            left: `${pos}px`
        });
    }

    showCursor() {
        this.style(this.cursor, {
            display: 'block'
        });
    }

    hideCursor() {
        this.style(this.cursor, {
            display: 'none'
        });
    }
}
