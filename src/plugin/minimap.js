/**
 * minimap plugin
 *
 * @param  {Object} params parameters use to initialise the plugin
 * @return {Object} an object representing the plugin
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
        extends: ['observer', 'drawer'],
        instance: {
            init: function (wavesurfer) {
                this.wavesurfer = wavesurfer;
                this._onDrawerCreated = () => {
                    this.container = this.wavesurfer.drawer.container;
                    this.lastPos = this.wavesurfer.drawer.lastPos;
                    this.params = wavesurfer.util.extend(
                        {}, this.wavesurfer.drawer.params, {
                            showRegions: false,
                            showOverview: false,
                            overviewBorderColor: 'green',
                            overviewBorderSize: 2
                        }, params, {
                            scrollParent: false,
                            fillParent: true
                        }
                    );

                    this.width = 0;
                    this.height = this.params.height * this.params.pixelRatio;

                    this.createWrapper();
                    this.createElements();

                    if (this.wavesurfer.regions && this.params.showRegions) {
                        this.regions();
                    }

                    this.bindWaveSurferEvents();
                    this.bindMinimapEvents();
                };
                if (this.wavesurfer.drawer) {
                    this._onDrawerCreated();
                    // @TODO: This shouldn't be necessary
                    this._onResize();
                }

                this.wavesurfer.on('drawer-created', this._onDrawerCreated);
            },

            destroy: function () {
                window.removeEventListener('resize', this._onResize, true);
                this.wavesurfer.un('drawer-created', this._onDrawerCreated);
                this.wrapper.parentNode.removeChild(this.wrapper);
            },

            regions: function() {
                var my = this;
                this.regions = {};

                this.wavesurfer.on('region-created', function(region) {
                    my.regions[region.id] = region;
                    my.renderRegions();
                });

                this.wavesurfer.on('region-updated', function(region) {
                    my.regions[region.id] = region;
                    my.renderRegions();
                });

                this.wavesurfer.on('region-removed', function(region) {
                    delete my.regions[region.id];
                    my.renderRegions();
                });
            },
            renderRegions: function() {
                var my = this;
                var regionElements = this.wrapper.querySelectorAll('region');
                for (var i = 0; i < regionElements.length; ++i) {
                    this.wrapper.removeChild(regionElements[i]);
                }

                Object.keys(this.regions).forEach(function(id){
                    var region = my.regions[id];
                    var width = (my.width * ((region.end - region.start) / my.wavesurfer.getDuration()));
                    var left = (my.width * (region.start / my.wavesurfer.getDuration()));
                    var regionElement = my.style(document.createElement('region'), {
                        height: 'inherit',
                        backgroundColor: region.color,
                        width: width + 'px',
                        left: left + 'px',
                        display: 'block',
                        position: 'absolute'
                    });
                    regionElement.classList.add(id);
                    my.wrapper.appendChild(regionElement);
                });
            },
            createElements: function() {
                this.wavesurfer.renderers.Canvas.createElements.call(this);

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
            },

            bindWaveSurferEvents: function () {
                var my = this;
                var prevWidth = 0;
                this._onResize = () => {
                    if (prevWidth != my.wrapper.clientWidth) {
                        prevWidth = my.wrapper.clientWidth;
                        my.render();
                        my.progress(my.wavesurfer.backend.getPlayedPercents());
                    }
                };
                this._onReady = () => this.render();
                this.wavesurfer.on('ready', this._onReady);

                this._onAudioprocess = (currentTime) => {
                    this.progress(this.wavesurfer.backend.getPlayedPercents());
                };
                this.wavesurfer.on('audioprocess', this._onAudioprocess);

                this._onSeek = () => this.progress(this.wavesurfer.backend.getPlayedPercents());
                this.wavesurfer.on('seek', this._onSeek);

                if (this.params.showOverview) {
                    this._onScroll = e => {
                        if (!my.draggingOverview) {
                            my.moveOverviewRegion(event.target.scrollLeft / my.ratio);
                        }
                    };
                    this.wavesurfer.on('scroll', this._onSeek);

                    this.wavesurfer.drawer.wrapper.addEventListener('mouseover', function(event) {
                        if (my.draggingOverview) {
                            my.draggingOverview = false;
                        }
                    });
                }

                window.addEventListener('resize', this._onResize, true);
            },


            bindMinimapEvents: function () {
                var my = this;
                var relativePositionX = 0;
                var seek = true;
                var positionMouseDown = {
                    clientX: 0,
                    clientY: 0
                };

                this.on('click', (function (e, position) {
                    if (seek) {
                        this.progress(position);
                        this.wavesurfer.seekAndCenter(position);
                    } else {
                        seek = true;
                    }
                }).bind(this));

                if (this.params.showOverview) {
                    this.overviewRegion.addEventListener('mousedown', function(event) {
                        my.draggingOverview = true;
                        relativePositionX = event.layerX;
                        positionMouseDown.clientX = event.clientX;
                        positionMouseDown.clientY = event.clientY;
                    });

                    this.wrapper.addEventListener('mousemove', function(event) {
                        if(my.draggingOverview) {
                            my.moveOverviewRegion(event.clientX - my.container.getBoundingClientRect().left - relativePositionX);
                        }
                    });

                    this.wrapper.addEventListener('mouseup', function(event) {
                        if (positionMouseDown.clientX - event.clientX === 0 && positionMouseDown.clientX - event.clientX === 0) {
                            seek = true;
                            my.draggingOverview = false;
                        } else if (my.draggingOverview) {
                            seek = false;
                            my.draggingOverview = false;
                        }
                    });
                }
            },

            render: function () {
                var len = this.getWidth();
                var peaks = this.wavesurfer.backend.getPeaks(len);
                this.drawPeaks(peaks, len);

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
            },
            moveOverviewRegion: function(pixels) {
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
