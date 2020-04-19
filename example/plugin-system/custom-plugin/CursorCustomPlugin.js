import CursorPlugin from '../../../src/plugin/cursor.js';

export default class CursorCustomPlugin extends CursorPlugin {
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
            name: 'cursorCustom',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {},
            instance: CursorCustomPlugin
        };
    }

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
        super(params, ws);
        /** @private */
        this.wavesurfer = ws;
        /** @private */
        this.style = ws.util.style;
        /** @private */
        this.params = ws.util.extend({}, this.defaultParams, params);
    }

    /** Override methods to add custom features */
}
