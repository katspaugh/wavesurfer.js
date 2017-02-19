/**
 * @typedef {Object} MinimapPluginParams
 * @desc Extends WavesurferParams
 * @property {?string|HTMLElement} container CSS selector or HTML element where
 * the ELAN information should be renderer. By default it is simply appended
 * after the waveform.
 * @property {?boolean} deferInit Set to true to manually call
 * `initPlugin('minimap')`
 */

/**
 * Minimap plugin definition factory
 *
 * @param  {MinimapPluginParams} params parameters use to initialise the plugin
 * @return {PluginDefinition} an object representing the plugin
 */
export default function(params = {}) {
    return {
        name: 'minimap',
        deferInit: params && params.deferInit ? params.deferInit : false,
        static: {
            initMinimap(customConfig) {
                console.warn('Deprecated initMinimap! Use wavesurfer.initPlugins("minimap") instead!');
                params = customConfig;
                this.initPlugins('minimap');
            }
        },
        extends: 'drawer',
        instance: Drawer => class MinimapPlugin extends Drawer {
            constructor(wavesurfer) {
                params = wavesurfer.util.extend(
                    {}, wavesurfer.params, {
                        showRegions: false,
                        showOverview: false,
                        overviewBorderColor: 'green',
                        overviewBorderSize: 2,
                        // the container should be different
                        container: false,
                        height: Math.max(Math.round(wavesurfer.params.height / 4), 20)
                    }, params, {
                        scrollParent: false,
                        fillParent: true
                    }
                );
                // if no container is specified add a new element and insert it
                if (!params.container) {
                    params.container = wavesurfer.util.style(document.createElement('minimap'), {
                        display: 'block'
                    });
                }
                // initialise drawer superclass
                super(params.container, params);
                this.wavesurfer = wavesurfer;

                // wavesurfer ready event listener
                this._onReady = () => {
                    if (!document.body.contains(params.container)) {
                        wavesurfer.container.insertBefore(params.container, null);
                    }
                    super.init();
                    if (this.wavesurfer.regions && this.params.showRegions) {
                        this.regions();
                    }
                    this.bindWaveSurferEvents();
                    this.bindMinimapEvents();
                    this.render();
                };

                this._onAudioprocess = currentTime => {
                    this.progress(this.wavesurfer.backend.getPlayedPercents());
                };

                // wavesurfer seek event listener
                this._onSeek = () => this.progress(this.wavesurfer.backend.getPlayedPercents());

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
                this._onResize = () => {
                    if (prevWidth != this.wrapper.clientWidth) {
                        prevWidth = this.wrapper.clientWidth;
                        this.render();
                        this.progress(this.wavesurfer.backend.getPlayedPercents());
                    }
                };
            }

            init() {
                if (this.wavesurfer.isReady) {
                    this._onReady();
                }
                this.wavesurfer.on('ready', this._onReady);
            }

            destroy() {
                window.removeEventListener('resize', this._onResize, true);
                this.wavesurfer.drawer.wrapper.removeEventListener('mouseover', this._onMouseover);
                this.wavesurfer.un('ready', this._onReady);
                this.wavesurfer.un('seek', this._onSeek);
                this.wavesurfer.un('scroll', this._onSeek);
                this.wavesurfer.un('audioprocess', this._onAudioprocess);
                this.wrapper.parentNode.removeChild(this.wrapper);
                this.wrapper = null;
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
                const regionElements = this.wrapper.querySelectorAll('region');
                let i;
                for (i = 0; i < regionElements.length; ++i) {
                    this.wrapper.removeChild(regionElements[i]);
                }

                Object.keys(this.regions).forEach(id => {
                    const region = this.regions[id];
                    const width = (this.width * ((region.end - region.start) / this.wavesurfer.getDuration()));
                    const left = (this.width * (region.start / this.wavesurfer.getDuration()));
                    const regionElement = this.style(document.createElement('region'), {
                        height: 'inherit',
                        backgroundColor: region.color,
                        width: width + 'px',
                        left: left + 'px',
                        display: 'block',
                        position: 'absolute'
                    });
                    regionElement.classList.add(id);
                    this.wrapper.appendChild(regionElement);
                });
            }

            createElements() {
                super.createElements();
                if (this.params.showOverview) {
                    this.overviewRegion = this.style(document.createElement('overview'), {
                        height: (this.wrapper.offsetHeight - (this.params.overviewBorderSize * 2)) + 'px',
                        width: '0px',
                        display: 'block',
                        position: 'absolute',
                        cursor: 'move',
                        border: this.params.overviewBorderSize + 'px solid ' + this.params.overviewBorderColor,
                        zIndex: 2,
                        opacity: this.params.overviewOpacity
                    });

                    this.wrapper.appendChild(this.overviewRegion);
                }
            }

            bindWaveSurferEvents() {
                window.addEventListener('resize', this._onResize, true);
                this.wavesurfer.on('audioprocess', this._onAudioprocess);
                this.wavesurfer.on('seek', this._onSeek);
                if (this.params.showOverview) {
                    this.wavesurfer.on('scroll', this._onSeek);
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

                    this.wrapper.addEventListener('mousemove', event => {
                        if (this.draggingOverview) {
                            this.moveOverviewRegion(event.clientX - this.container.getBoundingClientRect().left - relativePositionX);
                        }
                    });

                    this.wrapper.addEventListener('mouseup', event => {
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
                const len = this.getWidth();
                const peaks = this.wavesurfer.backend.getPeaks(len, 0, len);
                this.drawPeaks(peaks, len, 0, len);

                if (this.params.showOverview) {
                    //get proportional width of overview region considering the respective
                    //width of the drawers
                    this.ratio = this.wavesurfer.drawer.width / this.width;
                    this.waveShowedWidth = this.wavesurfer.drawer.width / this.ratio;
                    this.waveWidth = this.wavesurfer.drawer.width;
                    this.overviewWidth = (this.width / this.ratio);
                    this.overviewPosition = 0;
                    this.overviewRegion.style.width = (this.overviewWidth - (this.params.overviewBorderSize * 2)) + 'px';
                }
            }

            moveOverviewRegion(pixels) {
                if (pixels < 0) {
                    this.overviewPosition = 0;
                } else if (pixels + this.overviewWidth < this.width) {
                    this.overviewPosition = pixels;
                } else {
                    this.overviewPosition = (this.width - this.overviewWidth);
                }
                this.overviewRegion.style.left = this.overviewPosition + 'px';
                this.wavesurfer.drawer.wrapper.scrollLeft = this.overviewPosition * this.ratio;
            }
        }
    };
}
