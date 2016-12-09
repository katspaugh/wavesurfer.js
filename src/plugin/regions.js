const Region = {
    init: function (params, wavesurfer) {
        this.wavesurfer = wavesurfer;
        this.wrapper = wavesurfer.drawer.wrapper;
        this.style = wavesurfer.util.style;

        this.id = params.id == null ? wavesurfer.util.getId() : params.id;
        this.start = Number(params.start) || 0;
        this.end = params.end == null ?
            // small marker-like region
            this.start + (4 / this.wrapper.scrollWidth) * this.wavesurfer.getDuration() :
            Number(params.end);
        this.resize = params.resize === undefined ? true : Boolean(params.resize);
        this.drag = params.drag === undefined ? true : Boolean(params.drag);
        this.loop = Boolean(params.loop);
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
        this.data = params.data || {};
        this.attributes = params.attributes || {};

        this.maxLength = params.maxLength;
        this.minLength = params.minLength;

        this.bindInOut();
        this.render();
        this.wavesurfer.on('zoom', () => this.updateRender());
        this.wavesurfer.fireEvent('region-created', this);

    },

    /* Update region params. */
    update: function (params) {
        if (null != params.start) {
            this.start = Number(params.start);
        }
        if (null != params.end) {
            this.end = Number(params.end);
        }
        if (null != params.loop) {
            this.loop = Boolean(params.loop);
        }
        if (null != params.color) {
            this.color = params.color;
        }
        if (null != params.data) {
            this.data = params.data;
        }
        if (null != params.resize) {
            this.resize = Boolean(params.resize);
        }
        if (null != params.drag) {
            this.drag = Boolean(params.drag);
        }
        if (null != params.maxLength) {
            this.maxLength = Number(params.maxLength);
        }
        if (null != params.minLength) {
            this.minLength = Number(params.minLength);
        }
        if (null != params.attributes) {
            this.attributes = params.attributes;
        }

        this.updateRender();
        this.fireEvent('update');
        this.wavesurfer.fireEvent('region-updated', this);
    },

    /* Remove a single region. */
    remove: function () {
        if (this.element) {
            this.wrapper.removeChild(this.element);
            this.element = null;
            this.fireEvent('remove');
            this.wavesurfer.un('zoom', pxPerSec => this.updateRender(pxPerSec));
            this.wavesurfer.fireEvent('region-removed', this);
        }
    },

    /* Play the audio region. */
    play: function () {
        this.wavesurfer.play(this.start, this.end);
        this.fireEvent('play');
        this.wavesurfer.fireEvent('region-play', this);
    },

    /* Play the region in loop. */
    playLoop: function () {
        this.play();
        this.once('out', () => this.playLoop());
    },

    /* Render a region as a DOM element. */
    render: function () {
        var regionEl = document.createElement('region');
        regionEl.className = 'wavesurfer-region';
        regionEl.title = this.formatTime(this.start, this.end);
        regionEl.setAttribute('data-id', this.id);

        for (var attrname in this.attributes) {
            regionEl.setAttribute('data-region-' + attrname, this.attributes[attrname]);
        }

        var width = this.wrapper.scrollWidth;
        this.style(regionEl, {
            position: 'absolute',
            zIndex: 2,
            height: '100%',
            top: '0px'
        });

        /* Resize handles */
        if (this.resize) {
            var handleLeft = regionEl.appendChild(document.createElement('handle'));
            var handleRight = regionEl.appendChild(document.createElement('handle'));
            handleLeft.className = 'wavesurfer-handle wavesurfer-handle-start';
            handleRight.className = 'wavesurfer-handle wavesurfer-handle-end';
            var css = {
                cursor: 'col-resize',
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: '1%',
                maxWidth: '4px',
                height: '100%'
            };
            this.style(handleLeft, css);
            this.style(handleRight, css);
            this.style(handleRight, {
                left: '100%'
            });
        }

        this.element = this.wrapper.appendChild(regionEl);
        this.updateRender();
        this.bindEvents(regionEl);
    },

    formatTime: function (start, end) {
        return (start == end ? [ start ] : [ start, end ]).map(time => [
            Math.floor((time % 3600) / 60), // minutes
            ('00' + Math.floor(time % 60)).slice(-2) // seconds
        ].join(':')).join('-');
    },

    /* Update element's position, width, color. */
    updateRender: function (pxPerSec) {
        var dur = this.wavesurfer.getDuration();
        var width;
        if (pxPerSec) {
            width = Math.round(this.wavesurfer.getDuration() * pxPerSec);
        } else {
            width = this.wrapper.scrollWidth;
        }

        if (this.start < 0) {
            this.start = 0;
            this.end = this.end - this.start;
        }
        if (this.end > dur) {
            this.end = dur;
            this.start = dur - (this.end - this.start);
        }

        if (this.minLength != null) {
            this.end = Math.max(this.start + this.minLength, this.end);
        }

        if (this.maxLength != null) {
            this.end = Math.min(this.start + this.maxLength, this.end);
        }

        if (this.element != null) {
            // Calculate the left and width values of the region such that
            // no gaps appear between regions.
            var left = Math.round(this.start / dur * width);
            var regionWidth =
            Math.round(this.end / dur * width) - left;

            this.style(this.element, {
                left: left + 'px',
                width: regionWidth + 'px',
                backgroundColor: this.color,
                cursor: this.drag ? 'move' : 'default'
            });

            for (var attrname in this.attributes) {
                this.element.setAttribute('data-region-' + attrname, this.attributes[attrname]);
            }

            this.element.title = this.formatTime(this.start, this.end);
        }
    },

    /* Bind audio events. */
    bindInOut: function () {
        this.firedIn = false;
        this.firedOut = false;

        var onProcess = time => {
            if (!this.firedOut && this.firedIn && (this.start >= Math.round(time * 100) / 100 || this.end <= Math.round(time * 100) / 100)) {
                this.firedOut = true;
                this.firedIn = false;
                this.fireEvent('out');
                this.wavesurfer.fireEvent('region-out', this);
            }
            if (!this.firedIn && this.start <= time && this.end > time) {
                this.firedIn = true;
                this.firedOut = false;
                this.fireEvent('in');
                this.wavesurfer.fireEvent('region-in', this);
            }
        };

        this.wavesurfer.backend.on('audioprocess', onProcess);

        this.on('remove', () => {
            this.wavesurfer.backend.un('audioprocess', onProcess);
        });

        /* Loop playback. */
        this.on('out', () => {
            if (this.loop) {
                this.wavesurfer.play(this.start);
            }
        });
    },

    /* Bind DOM events. */
    bindEvents: function () {
        this.element.addEventListener('mouseenter', e => {
            this.fireEvent('mouseenter', e);
            this.wavesurfer.fireEvent('region-mouseenter', this, e);
        });

        this.element.addEventListener('mouseleave', e => {
            this.fireEvent('mouseleave', e);
            this.wavesurfer.fireEvent('region-mouseleave', this, e);
        });

        this.element.addEventListener('click', e => {
            e.preventDefault();
            this.fireEvent('click', e);
            this.wavesurfer.fireEvent('region-click', this, e);
        });

        this.element.addEventListener('dblclick', e => {
            e.stopPropagation();
            e.preventDefault();
            this.fireEvent('dblclick', e);
            this.wavesurfer.fireEvent('region-dblclick', this, e);
        });

        /* Drag or resize on mousemove. */
        (this.drag || this.resize) && (() => {
            var duration = this.wavesurfer.getDuration();
            var drag;
            var resize;
            var startTime;
            var touchId;

            var onDown = e => {
                if (e.touches && e.touches.length > 1) { return; }
                touchId = e.targetTouches ? e.targetTouches[0].identifier : null;

                e.stopPropagation();
                startTime = this.wavesurfer.drawer.handleEvent(e, true) * duration;

                if (e.target.tagName.toLowerCase() == 'handle') {
                    if (e.target.classList.contains('wavesurfer-handle-start')) {
                        resize = 'start';
                    } else {
                        resize = 'end';
                    }
                } else {
                    drag = true;
                    resize = false;
                }
            };
            var onUp = e => {
                if (e.touches && e.touches.length > 1) { return; }

                if (drag || resize) {
                    drag = false;
                    resize = false;

                    this.fireEvent('update-end', e);
                    this.wavesurfer.fireEvent('region-update-end', this, e);
                }
            };
            var onMove = (e) => {
                if (e.touches && e.touches.length > 1) { return; }
                if (e.targetTouches && e.targetTouches[0].identifier != touchId) { return; }

                if (drag || resize) {
                    var time = this.wavesurfer.drawer.handleEvent(e) * duration;
                    var delta = time - startTime;
                    startTime = time;

                    // Drag
                    if (this.drag && drag) {
                        this.onDrag(delta);
                    }

                    // Resize
                    if (this.resize && resize) {
                        this.onResize(delta, resize);
                    }
                }
            };

            this.element.addEventListener('mousedown', onDown);
            this.element.addEventListener('touchstart', onDown);

            this.wrapper.addEventListener('mousemove', onMove);
            this.wrapper.addEventListener('touchmove', onMove);

            document.body.addEventListener('mouseup', onUp);
            document.body.addEventListener('touchend', onUp);

            this.on('remove', () => {
                document.body.removeEventListener('mouseup', onUp);
                document.body.removeEventListener('touchend', onUp);
                this.wrapper.removeEventListener('mousemove', onMove);
                this.wrapper.removeEventListener('touchmove', onMove);
            });

            this.wavesurfer.on('destroy', () => {
                document.body.removeEventListener('mouseup', onUp);
                document.body.removeEventListener('touchend', onUp);
            });
        })();
    },

    onDrag: function (delta) {
        var maxEnd = this.wavesurfer.getDuration();
        if ((this.end + delta) > maxEnd || (this.start + delta) < 0) {
            return;
        }

        this.update({
            start: this.start + delta,
            end: this.end + delta
        });
    },

    onResize: function (delta, direction) {
        if (direction == 'start') {
            this.update({
                start: Math.min(this.start + delta, this.end),
                end: Math.max(this.start + delta, this.end)
            });
        } else {
            this.update({
                start: Math.min(this.end + delta, this.start),
                end: Math.max(this.end + delta, this.start)
            });
        }
    }
};

/**
 * regions plugin
 *
 * @param  {Object} params parameters use to initialise the plugin
 * @return {Object} an object representing the plugin
 */
export default function(params = {}) {
    return {
        name: 'regions',
        deferInit: params && params.deferInit ? params.deferInit : false,
        extends: ['observer'],
        static: {
            initRegions() {
                console.warn('Deprecated initRegions! Use wavesurfer.initPlugins("regions") instead!');
                this.initPlugin('regions');
            },

            addRegion(options) {
                if (!this.initialisedPluginList.regions) {
                    this.initPlugin('regions');
                }
                this.regions.add(options);
            },

            clearRegions() {
                this.regions && this.regions.clear();
            },

            enableDragSelection(options) {
                if (!this.initialisedPluginList.regions) {
                    this.initPlugin('regions');
                }
                this.regions.enableDragSelection(options);
            },

            disableDragSelection() {
                this.regions.disableDragSelection();
            }
        },
        instance: {
            init: function (wavesurfer) {
                this.params = params;
                this.wavesurfer = wavesurfer;

                // cant put this into static since we need to extend
                // with the observer first
                this.wavesurfer.Region = this.wavesurfer.util.extend({}, this.wavesurfer.util.observer, Region);

                // Id-based hash of regions.
                this.list = {};
                this._onReady = () => {
                    this.wrapper = this.wavesurfer.drawer.wrapper;
                    if (this.params.regions) {
                        this.params.regions.forEach(region => {
                            this.add(region);
                        });
                    }
                    if (this.params.dragSelection) {
                        this.enableDragSelection(this.params.dragSelection);
                    }
                };
                // Check if ws is ready
                if (this.wavesurfer.backend) {
                    this._onReady();
                }
                this.wavesurfer.on('ready', this._onReady);
            },

            destroy() {
                this.wavesurfer.un('ready', this._onReady);
                this.disableDragSelection();
                this.clear();
            },
            /* Add a region. */
            add: function (params) {
                var region = Object.create(this.wavesurfer.Region);
                region.init(params, this.wavesurfer);

                this.list[region.id] = region;

                region.on('remove', () => {
                    delete this.list[region.id];
                });

                return region;
            },

            /* Remove all regions. */
            clear: function () {
                Object.keys(this.list).forEach(id => {
                    this.list[id].remove();
                });
            },

            enableDragSelection: function (params) {
                var drag;
                var start;
                var region;
                var touchId;
                var slop = params.slop || 2;
                var pxMove = 0;

                var eventDown = e => {
                    if (e.touches && e.touches.length > 1) { return; }
                    touchId = e.targetTouches ? e.targetTouches[0].identifier : null;

                    drag = true;
                    start = this.wavesurfer.drawer.handleEvent(e, true);
                    region = null;
                };
                this.wrapper.addEventListener('mousedown', eventDown);
                this.wrapper.addEventListener('touchstart', eventDown);
                this.on('disable-drag-selection', () => {
                    this.wrapper.removeEventListener('touchstart', eventDown);
                    this.wrapper.removeEventListener('mousedown', eventDown);
                });

                var eventUp = e => {
                    if (e.touches && e.touches.length > 1) { return; }

                    drag = false;
                    pxMove = 0;

                    if (region) {
                        region.fireEvent('update-end', e);
                        this.wavesurfer.fireEvent('region-update-end', region, e);
                    }

                    region = null;
                };
                this.wrapper.addEventListener('mouseup', eventUp);
                this.wrapper.addEventListener('touchend', eventUp);
                this.on('disable-drag-selection', () => {
                    this.wrapper.removeEventListener('touchend', eventUp);
                    this.wrapper.removeEventListener('mouseup', eventUp);
                });

                var eventMove = e => {
                    if (!drag) { return; }
                    if (++pxMove <= slop) { return; }

                    if (e.touches && e.touches.length > 1) { return; }
                    if (e.targetTouches && e.targetTouches[0].identifier != touchId) { return; }

                    if (!region) {
                        region = this.add(params || {});
                    }

                    var duration = this.wavesurfer.getDuration();
                    var end = this.wavesurfer.drawer.handleEvent(e);
                    region.update({
                        start: Math.min(end * duration, start * duration),
                        end: Math.max(end * duration, start * duration)
                    });
                };
                this.wrapper.addEventListener('mousemove', eventMove);
                this.wrapper.addEventListener('touchmove', eventMove);
                this.on('disable-drag-selection', () => {
                    this.wrapper.removeEventListener('touchmove', eventMove);
                    this.wrapper.removeEventListener('mousemove', eventMove);
                });
            },

            disableDragSelection: function () {
                this.fireEvent('disable-drag-selection');
            }
        }
    };
}
