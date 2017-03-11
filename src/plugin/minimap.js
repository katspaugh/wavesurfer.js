/**
 * @typedef {Object} MinimapPluginParams
 * @desc Extends the `WavesurferParams` wavesurfer was initialised with
 * @property {?string|HTMLElement} container CSS selector or HTML element where
 * the ELAN information should be renderer. By default it is simply appended
 * after the waveform.
 * @property {?boolean} deferInit Set to true to manually call
 * `initPlugin('minimap')`
 */

/**
 * Renders a smaller version waveform as a minimap of the main waveform.
 *
 * @implements {PluginClass}
 * @extends {Observer}
 * @example
 * // es6
 * import MinimapPlugin from 'wavesurfer.minimap.js';
 *
 * // commonjs
 * var MinimapPlugin = require('wavesurfer.minimap.js');
 *
 * // if you are using <script> tags
 * var MinimapPlugin = window.WaveSurfer.minimap;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     MinimapPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class MinimapPlugin {
    /**
     * Minimap plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param  {MinimapPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'minimap',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {
                initMinimap(customConfig) {
                    console.warn('Deprecated initMinimap!');
                    params = customConfig;
                    this.initPlugins('minimap');
                }
            },
            instance: MinimapPlugin
        };
    }

    constructor(params, ws) {
        this.params = ws.util.extend(
            {}, ws.params, {
                showRegions: false,
                showOverview: false,
                overviewBorderColor: 'green',
                overviewBorderSize: 2,
                // the container should be different
                container: false,
                height: Math.max(Math.round(ws.params.height / 4), 20)
            }, params, {
                scrollParent: false,
                fillParent: true
            }
        );
        // if no container is specified add a new element and insert it
        if (!params.container) {
            this.params.container = ws.util.style(document.createElement('minimap'), {
                display: 'block'
            });
        }
        this.drawer = new (ws.Drawer)(this.params.container, this.params);
        this.wavesurfer = ws;
        this.util = ws.util;
        /**
         * Minimap needs to register to ready and waveform-ready events to
         * work with MediaElement, the time when ready is called is different
         * (peaks can not be got)
         *
         * @type {string}
         * @see https://github.com/katspaugh/wavesurfer.js/issues/736
         */
        this.renderEvent = ws.params.backend === 'MediaElement' ? 'waveform-ready' : 'ready';
        this.renderEvent = 'ready';

        // ws ready event listener
        this._onShouldRender = () => {
            if (!document.body.contains(this.params.container)) {
                ws.container.insertBefore(this.params.container, null);
            }
            this.drawer.createWrapper();
            this.createElements();
            this.bindWavesurferEvents();
            this.bindMinimapEvents();
            if (this.wavesurfer.regions && this.params.showRegions) {
                this.regions();
            }
            this.render();
        };

        this._onAudioprocess = currentTime => {
            this.drawer.progress(this.wavesurfer.backend.getPlayedPercents());
        };

        // ws seek event listener
        this._onSeek = () => this.drawer.progress(ws.backend.getPlayedPercents());

        // event listeners for the overview region
        this._onScroll = e => {
            if (!this.draggingOverview) {
                this.moveOverviewRegion(e.target.scrollLeft / this.ratio);
            }
        };
        this._onMouseover = e => {
            if (this.draggingOverview) {
                this.draggingOverview = false;
            }
        };
        let prevWidth = 0;
        this._onResize = ws.util.debounce(() => {
            if (prevWidth != this.drawer.wrapper.clientWidth) {
                prevWidth = this.drawer.wrapper.clientWidth;
                this.render();
                this.drawer.progress(this.wavesurfer.backend.getPlayedPercents());
            }
        });
    }

    init() {
        if (this.wavesurfer.isReady) {
            this._onShouldRender();
        }
        this.wavesurfer.on(this.renderEvent, this._onShouldRender);
    }

    destroy() {
        window.removeEventListener('resize', this._onResize, true);
        window.removeEventListener('orientationchange', this._onResize, true);
        this.wavesurfer.drawer.wrapper.removeEventListener('mouseover', this._onMouseover);
        this.wavesurfer.un(this.renderEvent, this._onShouldRender);
        this.wavesurfer.un('seek', this._onSeek);
        this.wavesurfer.un('scroll', this._onScroll);
        this.wavesurfer.un('audioprocess', this._onAudioprocess);
        this.drawer.destroy();
        this.overviewRegion = null;
        this.unAll();
    }

    regions() {
        this.regions = {};

        this.wavesurfer.on('region-created', region => {
            this.regions[region.id] = region;
            this.renderRegions();
        });

        this.wavesurfer.on('region-updated', region => {
            this.regions[region.id] = region;
            this.renderRegions();
        });

        this.wavesurfer.on('region-removed', region => {
            delete this.regions[region.id];
            this.renderRegions();
        });
    }

    renderRegions() {
        const regionElements = this.drawer.wrapper.querySelectorAll('region');
        let i;
        for (i = 0; i < regionElements.length; ++i) {
            this.drawer.wrapper.removeChild(regionElements[i]);
        }

        Object.keys(this.regions).forEach(id => {
            const region = this.regions[id];
            const width = (this.drawer.width * ((region.end - region.start) / this.wavesurfer.getDuration()));
            const left = (this.drawer.width * (region.start / this.wavesurfer.getDuration()));
            const regionElement = this.util.style(document.createElement('region'), {
                height: 'inherit',
                backgroundColor: region.color,
                width: width + 'px',
                left: left + 'px',
                display: 'block',
                position: 'absolute'
            });
            regionElement.classList.add(id);
            this.drawer.wrapper.appendChild(regionElement);
        });
    }

    createElements() {
        this.drawer.createElements();
        if (this.params.showOverview) {
            this.overviewRegion = this.util.style(document.createElement('overview'), {
                height: (this.drawer.wrapper.offsetHeight - (this.params.overviewBorderSize * 2)) + 'px',
                width: '0px',
                display: 'block',
                position: 'absolute',
                cursor: 'move',
                border: this.params.overviewBorderSize + 'px solid ' + this.params.overviewBorderColor,
                zIndex: 2,
                opacity: this.params.overviewOpacity
            });
            this.drawer.wrapper.appendChild(this.overviewRegion);
        }
    }

    bindWavesurferEvents() {
        window.addEventListener('resize', this._onResize, true);
        window.addEventListener('orientationchange', this._onResize, true);
        this.wavesurfer.on('audioprocess', this._onAudioprocess);
        this.wavesurfer.on('seek', this._onSeek);
        if (this.params.showOverview) {
            this.wavesurfer.on('scroll', this._onScroll);
            this.wavesurfer.drawer.wrapper.addEventListener('mouseover', this._onMouseover);
        }
    }

    bindMinimapEvents() {
        const positionMouseDown = {
            clientX: 0,
            clientY: 0
        };
        let relativePositionX = 0;
        let seek = true;

        // the following event listeners will be destroyed by using
        // this.unAll() and nullifying the DOM node references after
        // removing them
        this.on('click', (e, position) => {
            if (seek) {
                this.progress(position);
                this.wavesurfer.seekAndCenter(position);
            } else {
                seek = true;
            }
        });

        if (this.params.showOverview) {
            this.overviewRegion.addEventListener('mousedown', event => {
                this.draggingOverview = true;
                relativePositionX = event.layerX;
                positionMouseDown.clientX = event.clientX;
                positionMouseDown.clientY = event.clientY;
            });

            this.drawer.wrapper.addEventListener('mousemove', event => {
                if (this.draggingOverview) {
                    this.moveOverviewRegion(event.clientX - this.drawer.container.getBoundingClientRect().left - relativePositionX);
                }
            });

            this.drawer.wrapper.addEventListener('mouseup', event => {
                if (positionMouseDown.clientX - event.clientX === 0 && positionMouseDown.clientX - event.clientX === 0) {
                    seek = true;
                    this.draggingOverview = false;
                } else if (this.draggingOverview) {
                    seek = false;
                    this.draggingOverview = false;
                }
            });
        }
    }

    render() {
        const len = this.drawer.getWidth();
        const peaks = this.wavesurfer.backend.getPeaks(len, 0, len);
        this.drawer.drawPeaks(peaks, len, 0, len);

        if (this.params.showOverview) {
            //get proportional width of overview region considering the respective
            //width of the drawers
            this.ratio = this.wavesurfer.drawer.width / this.drawer.width;
            this.waveShowedWidth = this.wavesurfer.drawer.width / this.ratio;
            this.waveWidth = this.wavesurfer.drawer.width;
            this.overviewWidth = (this.drawer.width / this.ratio);
            this.overviewPosition = 0;
            this.moveOverviewRegion(this.wavesurfer.drawer.wrapper.scrollLeft / this.ratio);
            this.overviewRegion.style.width = (this.overviewWidth - (this.params.overviewBorderSize * 2)) + 'px';
        }
    }

    moveOverviewRegion(pixels) {
        if (pixels < 0) {
            this.overviewPosition = 0;
        } else if (pixels + this.overviewWidth < this.drawer.width) {
            this.overviewPosition = pixels;
        } else {
            this.overviewPosition = (this.drawer.width - this.overviewWidth);
        }
        this.overviewRegion.style.left = this.overviewPosition + 'px';
        if (this.draggingOverview) {
            this.wavesurfer.drawer.wrapper.scrollLeft = this.overviewPosition * this.ratio;
        }
    }
}
