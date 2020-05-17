import CursorPlugin from '../../../src/plugin/cursor.js';

/**
 * CursorCustom plugin is a custom class which extends the CursorPlugin basic class. Doing this, gives the possibility
 * to add your own changes to the defaults methods overriding them. In this way you will have not to download locally
 * the library to modify the basic plugin class methods. This is positive thing if you want to maintain the constant
 * support of the library.
 */
export default class CursorCustomPlugin extends CursorPlugin {
    /**
     * Cursor plugin definition factory
     *
     * This function overrides the create static method of the CursorPlugin, so you can assign it a name
     *
     * @param  {CursorPluginParams} params parameters used to initialise the
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
     * Construct the plugin class. You probably want to use `CursorCustomPlugin.create`
     * instead.
     *
     * @param {CursorPluginParams} params Plugin parameters
     * @param {object} ws Wavesurfer instance
     */
    constructor(params, ws) {
        super(params, ws);
    }

    /** Override methods to add custom features */
}
