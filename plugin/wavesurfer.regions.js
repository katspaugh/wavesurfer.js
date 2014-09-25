'use strict';

/* Regions manager */
WaveSurfer.Regions = {
    init: function (wavesurfer) {
        this.wavesurfer = wavesurfer;
        this.wrapper = this.wavesurfer.drawer.wrapper;

        /* Id-based hash of regions. */
        this.list = {};

        this.bindInOut();
    },

    /* Bind playback to region events. */
    bindInOut: function () {
        var my = this;
        this.wavesurfer.backend.on('play', function () {
            Object.keys(my.list).forEach(function (id) {
                var region = my.list[id];
                region.firedIn = false;
                region.firedOut = false;
            });
        });
        this.wavesurfer.backend.on('audioprocess', function (time) {
            Object.keys(my.list).forEach(function (id) {
                var region = my.list[id];
                if (!region.firedIn && region.start <= time && region.end >= time) {
                    my.wavesurfer.fireEvent('region-in', region);
                    region.fireEvent('in');
                    region.firedIn = true;
                }
                if (!region.firedOut && region.firedIn && region.endPosition < time) {
                    my.wavesurfer.fireEvent('region-out', region);
                    region.fireEvent('out');
                    region.firedOut = true;
                }
            });
        });
    },

    /* Remove a region. */
    add: function (params) {
        var my = this;
        var region = Object.create(WaveSurfer.Region);
        region.init(params, this.wavesurfer);
        this.list[region.id] = region;

        region.on('remove', function () {
            delete my.list[region.id];
        });

        return region;
    },

    /* Remove all regions. */
    clear: function () {
        Object.keys(this.list).forEach(function (id) {
            this.list[id].remove();
        }, this);
    }
};

WaveSurfer.Region = {
    /* Helper function to assign CSS styles. */
    style: WaveSurfer.Drawer.style,

    init: function (params, wavesurfer) {
        this.wavesurfer = wavesurfer;
        this.wrapper = wavesurfer.drawer.wrapper;

        this.id = WaveSurfer.util.getId();
        this.start = params.start || 0;
        this.end = params.end == null ?
            // small marker-like region
            params.start + this.wavesurfer.params.markerWidth :
            params.end;
        this.resize = params.resize === undefined ? true : !!params.resize;
        this.drag = params.drag === undefined ? true : !!params.drag;
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';

        this.render();

        this.wavesurfer.fireEvent('region-created', this);
    },

    /* Play back the region. */
    play: function () {
        var dur = this.wavesurfer.getDuration();
        this.wavesurfer.play(this.start * dur, this.end * dur);
    },

    /* Update region params. */
    update: function (params) {
        if (null != params.start) {
            this.start = params.start;
        }
        if (null != params.end) {
            this.end = params.end;
        }
        if (null != params.color) {
            this.color = params.color;
        }

        this.updateRender();
        this.fireEvent('update');
        this.wavesurfer.fireEvent('region-updated', this);
    },

    /* Remove a single region. */
    remove: function (region) {
        if (this.element) {
            this.wrapper.removeChild(this.element);
            this.element = null;
            this.fireEvent('remove');
            this.wavesurfer.fireEvent('region-removed', this);
        }
    },

    /* Render a region as a DOM element. */
    render: function () {
        var regionEl = document.createElement('region');
        regionEl.className = 'wavesurfer-region';

        var width = this.wrapper.scrollWidth;
        this.style(regionEl, {
            cursor: 'move',
            position: 'absolute',
            zIndex: 2,
            height: '100%',
            top: '0px'
        });

        /* Resize handles */
        if (this.resize) {
            var handleLeft = regionEl.appendChild(document.createElement('handle'));
            var handleRight = regionEl.appendChild(document.createElement('handle'));
            handleLeft.className = 'wavesurfer-handle';
            handleRight.className = 'wavesurfer-handle';
            var css = {
                cursor: 'col-resize',
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: '4px',
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

    /* Update element's position, width, color. */
    updateRender: function () {
        var width = this.wrapper.scrollWidth;
        this.style(this.element, {
            left: ~~(this.start * width) + 'px',
            width: ~~((this.end - this.start) * width) + 'px',
            backgroundColor: this.color
        });
    },

    /* Bind DOM events. */
    bindEvents: function () {
        var my = this;

        this.element.addEventListener('mouseover', function (e) {
            my.fireEvent('mouseover', e);
            my.wavesurfer.fireEvent('region-mouseover', my, e);
        });

        this.element.addEventListener('mouseleave', function (e) {
            my.fireEvent('mouseleave', e);
            my.wavesurfer.fireEvent('region-mouseleave', my, e);
        });

        this.element.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            my.fireEvent('click', e);
            my.wavesurfer.fireEvent('region-click', my, e);
        });

        this.element.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            e.preventDefault();
            my.fireEvent('dblclick', e);
            my.wavesurfer.fireEvent('region-dblclick', my, e);
        });

        /* Drag or resize on mousemove. */
        (this.drag || this.resize) && (function () {
            var drag;
            var resize;
            var startPos;

            var onDown = function (e) {
                e.stopPropagation();
                startPos = my.wavesurfer.drawer.handleEvent(e);

                if (e.target.tagName.toLowerCase() == 'handle') {
                    if (startPos <= my.end) {
                        resize = 'start';
                    } else {
                        resize = 'end';
                    }
                } else {
                    drag = true;
                }
            };
            var onUp = function (e) {
                if (drag || resize) {
                    drag = false;
                    resize = false;
                    e.stopPropagation();
                    e.preventDefault();
                }
            };
            var onMove = function (e) {
                if (drag || resize) {
                    var pos = my.wavesurfer.drawer.handleEvent(e);
                    var delta = pos - startPos;
                    startPos = pos;

                    // Drag
                    if (my.drag && drag) {
                        my.update({
                            start: my.start + delta,
                            end: my.end + delta
                        });
                    }

                    // Resize
                    if (my.resize && resize) {
                        if (resize == 'start') {
                            my.update({
                                start: my.start + delta
                            });
                        } else {
                            my.update({
                                end: my.end + delta
                            });
                        }
                    }
                }
            };

            my.element.addEventListener('mousedown', onDown);
            my.wrapper.addEventListener('mouseup', onUp);
            my.wrapper.addEventListener('mousemove', onMove);

            my.on('remove', function () {
                my.wrapper.removeEventListener('mouseup', onUp);
                my.wrapper.removeEventListener('mousemove', onMove);
            });
        }());
    }
};

WaveSurfer.util.extend(WaveSurfer.Region, WaveSurfer.Observer);


/* Augment WaveSurfer with the createRegions method. */
WaveSurfer.createRegions = function () {
    this.regions = Object.create(WaveSurfer.Regions);
    this.regions.init(this);
    return this.regions;
};
