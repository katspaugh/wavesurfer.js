'use strict';

/* Regions manager */
WaveSurfer.Regions = {
    init: function (wavesurfer) {
        this.wavesurfer = wavesurfer;
        this.wrapper = this.wavesurfer.drawer.wrapper;

        // Id-based hash of regions
        this.regions = {};
    },

    /* Remove a region. */
    add: function (params) {
        var region = Object.create(WaveSurfer.Region);
        region.init(params);
        this.regions[region.id] = region;
        this.render(region);

        region.on('play', function () {
            var dur = this.wavesurfer.getDuration();
            this.wavesurfer.play(region.start * dur, region.end * dur);
        });

        return region;
    },

    /* Remove a single region. */
    remove: function (region) {
        var regionEl = document.getElementById(region.id);
        this.wrapper.removeChild(regionEl);
        delete this.regions[region.id];
    },

    /* Remove all regions. */
    clear: function () {
        Object.keys(this.regions).forEach(function (id) {
            this.remove(this.regions[id]);
        }, this);
    },

    /* Render a region as a DOM element. */
    render: function (region) {
        var regionEl = document.createElement('region');
        regionEl.id = region.id;
        regionEl.className = 'wavesurfer-region';

        var width = this.wrapper.scrollWidth;
        this.wavesurfer.drawer.style(regionEl, {
            cursor: 'move',
            position: 'absolute',
            zIndex: 2,
            height: '100%',
            top: '0px',
            left: ~~(region.start * width) + 'px',
            width: ~~((region.end - region.start) * width) + 'px',
            backgroundColor: region.color
        });

        /* Resize handles */
        if (region.resize) {
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
            this.wavesurfer.drawer.style(handleLeft, css);
            this.wavesurfer.drawer.style(handleRight, css);
            this.wavesurfer.drawer.style(handleRight, {
                left: '100%'
            });
        }

        this.bindEvents(region, regionEl);

        this.wrapper.appendChild(regionEl);
    },

    bindEvents: function (region, regionEl) {
        /* Remove on double click. */
        var my = this;
        regionEl.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            e.preventDefault();
            my.remove(region);
        });

        /* Drag or resize on mousemove. */
        (region.drag || region.resize) && (function (my) {
            var startPos;
            var drag;
            var resize;
            regionEl.addEventListener('mousedown', function (e) {
                e.stopPropagation();
                startPos = my.wavesurfer.drawer.handleEvent(e);

                if (e.target.tagName.toLowerCase() == 'handle') {
                    if (startPos <= region.end) {
                        resize = 'start';
                    } else {
                        resize = 'end';
                    }
                } else {
                    drag = true;
                }
            });
            my.wrapper.addEventListener('mouseup', function (e) {
                if (drag || resize) {
                    drag = false;
                    resize = false;
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
            my.wrapper.addEventListener('mousemove', function (e) {
                if (drag || resize) {
                    var width = my.wrapper.scrollWidth;
                    var pos = my.wavesurfer.drawer.handleEvent(e);
                    var delta = pos - startPos;
                    startPos = pos;

                    // Drag
                    if (region.drag && drag) {
                        region.start += delta;
                        region.end += delta;
                        regionEl.style.left = ~~(region.start * width) + 'px';
                    }

                    // Resize
                    if (region.resize && resize) {
                        if (resize == 'start') {
                            region.start += delta;
                            regionEl.style.left = ~~(region.start * width) + 'px';
                        } else {
                            region.end += delta;
                        }
                        regionEl.style.width = ~~((region.end - region.start) * width) + 'px';
                    }
                }
            });
        }(this));
    }
};

WaveSurfer.Region = {
    init: function (params) {
        this.id = WaveSurfer.util.getId();
        this.start = params.start;
        this.end = params.end || params.start;
        this.resize = params.resize === undefined ? true : !!params.resize;
        this.drag = params.drag === undefined ? true : !!params.drag;
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
    },

    play: function () {
        this.fireEvent('play');
    }
};

WaveSurfer.util.extend(WaveSurfer.Region, WaveSurfer.Observer);


/* Augment WaveSurfer with the createRegions method. */
WaveSurfer.createRegions = function () {
    this.regions = Object.create(WaveSurfer.Regions);
    this.regions.init(this);
    return this.regions;
};
