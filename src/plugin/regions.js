'use strict';

/* Region manager */
WaveSurfer.Regions = {
    init: function (wavesurfer) {
        var my = this;
        
        this.wavesurfer = wavesurfer;
        this.wrapper = this.wavesurfer.drawer.wrapper;

        /* Id-based hash of regions. */
        this.list = {};
        this.regionAction = undefined;
        this.activeRegion = undefined;
        this.mousedOverRegion = undefined;
        
        /* Drag or resize on mousemove. */
        var duration = my.wavesurfer.getDuration();
        var clientXStart, dragStart, drag, resize;
        var touchId;
        var initialTime, initialStart, initialEnd;

        this.defaultDrawerCursor = window.getComputedStyle(this.wrapper).cursor;

        my.onDown = function (evt) {
            var currentRegion = evt.currentTarget.wavesurferRegion;
            if (evt.touches && evt.touches.length > 1) { return; }
            clientXStart = evt.clientX;
            my.activeRegion = currentRegion;
            touchId = evt.targetTouches ? evt.targetTouches[0].identifier : null;
            evt.stopPropagation();
            initialTime = my.wavesurfer.drawer.handleEvent(evt, true) * duration;
            initialStart = currentRegion.start, initialEnd = currentRegion.end;
            if (my.regionAction !== undefined) { return; }
            if (evt.target.tagName.toLowerCase() == 'handle') {
                if (evt.target.classList.contains('wavesurfer-handle-start') && currentRegion.resizeStart) {
                    resize = 'start';
                    my.regionAction = 'resize_from_start';
                } else if (currentRegion.resizeEnd) {
                    resize = 'end';
                    my.regionAction = 'resize_from_end';
                }
            } else if (my.drag) {
                my.regionAction = 'dragstart';
                dragStart = true;
            }
            my.updateCursor();
        };
        my.onUp = function (evt) {
            // If there is a drag that has just finished, prevent the seek from changing the position of the cursor.
            if ((drag || resize) && (typeof clientXStart == 'undefined')) {
                my.wavesurfer.params.interact = false
                if (my.wavesurfer.drawer) my.wavesurfer.drawer.params.interact = false;
                if (my.wavesurfer.wrapper) my.wavesurfer.wrapper.params.interact = false;
                setTimeout (function () {
                    my.wavesurfer.params.interact = true;
                    if (my.wavesurfer.drawer) my.wavesurfer.drawer.params.interact = true;
                    if (my.wavesurfer.wrapper) my.wavesurfer.wrapper.params.interact = true;
                }, 0);
            }
            if (typeof dragStart == 'undefined' && typeof drag == 'undefined' && typeof resize == 'undefined') { return; }
            dragStart = undefined;
            my.regionAction = undefined;
            my.updateCursor();
            if (evt.touches && evt.touches.length > 1) { return; }
            if (drag || resize) {
                if (typeof resize != 'undefined') {
                    my.activeRegion.fireEventPropagate('resize-end');
                    my.activeRegion.fireEventPropagate('resize_from_' + resize + '-end');
                }
                if (typeof drag != 'undefined') { my.activeRegion.fireEventPropagate('drag-end'); }
                my.activeRegion.fireEventPropagate('update-end', evt);
                drag = undefined;
                resize = undefined;
            }
            my.activeRegion = undefined;
        };
        my.onMove = function (evt) {
            if ((typeof clientXStart != 'undefined') && evt.clientX == clientXStart) { return; }
            clientXStart = undefined
            if (evt.touches && evt.touches.length > 1) { return; }
            if (evt.targetTouches && evt.targetTouches[0].identifier != touchId) { return; }
            if (dragStart) {
               dragStart = undefined;
               drag = true;
               if (my.activeRegion.drag) { my.regionAction = 'drag'; }
            }
            if (drag || resize) {
                var time = my.wavesurfer.drawer.handleEvent(evt) * duration;
                // Drag
                if (my.activeRegion.drag && drag) { my.activeRegion.onDrag(initialStart, initialEnd, time - initialTime); }
                // Resize
                if (my.activeRegion.resize && resize) { my.activeRegion.onResize(resize, initialStart, initialEnd, time); }
            }
        };

        my.onMouseOver = function (evt) {
            var currentRegion = evt.currentTarget.wavesurferRegion;
            if (!currentRegion.drag) { return; }
            my.mousedOverRegion = currentRegion;
            my.updateCursor();
        };
        my.onMouseOut = function (evt) {
            var currentRegion = evt.currentTarget.wavesurferRegion;
            if (!currentRegion.drag) { return; }
            my.mousedOverRegion = undefined;
            my.updateCursor();
        };
        document.body.addEventListener('mouseup', my.onUp);
        document.body.addEventListener('touchend', my.onUp);
        my.wrapper.addEventListener('mousemove', my.onMove);
        my.wrapper.addEventListener('touchmove', my.onMove, {passive: false});
        
        my.on('remove', function () {
            my.onUp();
            document.body.removeEventListener('mouseup', my.onUp);
            document.body.removeEventListener('touchend', my.onUp);
            my.wrapper.removeEventListener('mousemove', my.onMove);
            my.wrapper.removeEventListener('touchmove', my.onMove);
        });
        my.wavesurfer.on('destroy', function () {
            document.body.removeEventListener('mouseup', my.onUp);
            document.body.removeEventListener('touchend', my.onUp);
        });
    },

    /* Add a region. */
    add: function (params) {
        var region = Object.create(WaveSurfer.Region);
        region.init(params, this.wavesurfer, this);
        this.list[region.id] = region;
        region.on('remove', (function () { delete this.list[region.id]; }).bind(this));
        return region;
    },

    /* Remove all regions. */
    clear: function () {
        Object.keys(this.list).forEach(function (id) {
            this.list[id].remove();
        }, this);
    },

    enableDragSelection: function (params) {
        var my = this;
        var drag;
        var start;
        var region;
        var touchId;
        var slop = params.slop || 2;
        var pxMove = 0;

        var eventDown = function (e) {
            if (e.touches && e.touches.length > 1) { return; }

            // Check whether the click/tap is on the bottom-most DOM element
            // Effectively prevent clicks on the scrollbar from registering as
            // region creation.
            if (e.target.childElementCount > 0) { return; }

            touchId = e.targetTouches ? e.targetTouches[0].identifier : null;

            drag = true;
            start = my.wavesurfer.drawer.handleEvent(e, true);
            region = null;
        };
        this.wrapper.addEventListener('mousedown', eventDown);
        this.wrapper.addEventListener('touchstart', eventDown);
        this.on('disable-drag-selection', function() {
            my.wrapper.removeEventListener('touchstart', eventDown);
            my.wrapper.removeEventListener('mousedown', eventDown);
        });

        var eventUp = function (e) {
            if (e.touches && e.touches.length > 1) { return; }

            drag = false;
            pxMove = 0;

            if (region) {
                region.fireEventPropagate('update-end', e);
            }

            region = null;
        };
        this.wrapper.addEventListener('mouseup', eventUp);
        this.wrapper.addEventListener('touchend', eventUp);
        this.on('disable-drag-selection', function() {
            my.wrapper.removeEventListener('touchend', eventUp);
            my.wrapper.removeEventListener('mouseup', eventUp);
        });

        var eventMove = function (e) {
            if (!drag) { return; }
            if (++pxMove <= slop) { return; }

            if (e.touches && e.touches.length > 1) { return; }
            if (e.targetTouches && e.targetTouches[0].identifier != touchId) { return; }

            if (!region) {
                region = my.add(params || {});
            }

            var duration = my.wavesurfer.getDuration();
            var end = my.wavesurfer.drawer.handleEvent(e);
            region.update({
                start: Math.min(end * duration, start * duration),
                end: Math.max(end * duration, start * duration)
            });
        };
        this.wrapper.addEventListener('mousemove', eventMove);
        this.wrapper.addEventListener('touchmove', eventMove);
        this.on('disable-drag-selection', function() {
            my.wrapper.removeEventListener('touchmove', eventMove);
            my.wrapper.removeEventListener('mousemove', eventMove);
        });
    },

    updateCursor: function () {
        var my = this;
        WaveSurfer.Drawer.style(my.wrapper, {
            cursor: (my.regionAction == 'resize_from_start' || my.regionAction == 'resize_from_end') ?
                        'col-resize' :
                        ((my.regionAction == 'dragstart' || my.regionAction == 'drag' || (my.mousedOverRegion && my.mousedOverRegion.drag)) ?
                            'move' : this.defaultDrawerCursor
                        )
        });
    },

    disableDragSelection: function () {
        this.fireEvent('disable-drag-selection');
    }
};

WaveSurfer.util.extend(WaveSurfer.Regions, WaveSurfer.Observer);

WaveSurfer.Region = {
    /* Helper function to assign CSS styles. */
    style: WaveSurfer.Drawer.style,

    init: function (params, wavesurfer, regionManager) {
        this.wavesurfer = wavesurfer;
        this.wrapper = wavesurfer.drawer.wrapper;
        this.regionManager = regionManager;
        this.id = params.id == null ? WaveSurfer.util.getId() : params.id;
        this.start = Number(params.start) || 0;
        this.end = params.end == null ?
            // small marker-like region
            this.start + (4 / this.wrapper.scrollWidth) * this.wavesurfer.getDuration() :
            Number(params.end);
        this.resize = params.resize === undefined ? true : Boolean(params.resize);
        this.showTitle = params.showTitle === undefined ? true : Boolean(params.showTitle);

        this.classList = {};
        this.styleList = {};
        if (params.classList === undefined) { params.classList = {}; }
        if (params.styleList === undefined) { params.styleList = {}; }
        ['region', 'resize', 'resizeStart', 'resizeEnd'].forEach (function (prop) {
            this.classList[prop] = params.classList[prop] || undefined;
            this.styleList[prop] = params.styleList[prop] || undefined;
        }, this);
        this.resizeStart = params.resizeStart === undefined ? true : Boolean(params.resizeStart);
        this.resizeEnd = params.resizeEnd === undefined ? true : Boolean(params.resizeEnd);
        this.drag = params.drag === undefined ? true : Boolean(params.drag);
        this.loop = Boolean(params.loop);
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
        this.data = params.data || {};
        this.attributes = params.attributes || {};

        this.maxLength = params.maxLength;
        this.minLength = params.minLength;

        this.bindInOut();
        this.render();

        this.onZoom = this.updateRender.bind(this);
        this.wavesurfer.on('zoom', this.onZoom);

        this.wavesurfer.fireEvent('region-created', this);

    },

    fireEventPropagate: function (eventName, evt) {
     this.wavesurfer.fireEvent('region-' + eventName, this, evt);
    },

    /* Update region params. */
    update: function (params) {
        var updatedList = {};
        // Define the thing to check for changes, and define any wrapper function around that value.
        [
            {'start': Number},
            {'end': Number},
            {'loop': Boolean},
            {'color': undefined},
            {'data': undefined},
            {'resize': Boolean},
            {'drag': Boolean},
            {'maxLength': Number},
            {'minLength': Number},
            {'attributes': undefined}
        ].forEach (function (object) {
         var param = Object.keys(object)[0];
         if (params[param] == null) { return; }
         var func = (typeof object[param] == 'undefined') ? function (n) { return n; } : object[param];
         var wrappedValue = func(params[param]);
         if (this[param] == wrappedValue) { return; }
         updatedList[param] = true;
         this[param] = wrappedValue;
        }, this);
        if (Object.keys(updatedList).length == 0) { return; }

        this.updateRender();
        if (this.regionManager.regionAction && (this.regionManager.regionAction == 'resize_from_start' || this.regionManager.regionAction == 'resize_from_end')) {
            if (updatedList.start) { this.fireEventPropagate('resize_from_start'); }
            if (updatedList.end) { this.fireEventPropagate('resize_from_end'); }
            if (updatedList.end || updatedList.start) { this.fireEventPropagate('resize'); }
        }
        if (this.regionManager.regionAction && this.regionManager.regionAction == 'drag') {
            if (updatedList.end || updatedList.start) { this.fireEventPropagate('drag'); }
        }
        this.fireEventPropagate('update');
    },

    /* Remove a single region. */
    remove: function () {
        if (this.element) {
            this.wrapper.removeChild(this.element);
            this.element = null;
            this.wavesurfer.un('zoom', this.onZoom);
            this.fireEventPropagate('remove');
        }
    },

    /* Play the audio region. */
    play: function () {
        this.wavesurfer.play(this.start, this.end);
        this.fireEventPropagate('play');
    },

    /* Play the region in loop. */
    playLoop: function () {
        this.play();
        this.once('out', this.playLoop.bind(this));
    },

    /* Render a region as a DOM element. */
    render: function () {
        var regionEl = document.createElement('region');
        regionEl.className = 'wavesurfer-region' + (this.classList.region !== undefined ? (' ' + this.classList.region) : '');
        if (this.showTitle) { regionEl.title = this.formatTime(this.start, this.end); }
        regionEl.setAttribute('data-id', this.id);

        for (var attrname in this.attributes) {
            regionEl.setAttribute('data-region-' + attrname, this.attributes[attrname]);
        }

        this.style(regionEl, (this.styleList.region !== undefined) ? this.styleList.region : {
            position: 'absolute',
            zIndex: 2,
            height: '100%',
            top: '0px'
        });

        function capitalizeFirstLetter (string) {return string.charAt(0).toUpperCase() + string.slice(1);}

        /* Resize handles */
        if (this.resize) {
            var resizeStyle = (this.styleList.resize !== undefined) ? this.styleList.resize: {
                cursor: 'col-resize',
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: '1%',
                maxWidth: '4px',
                height: '100%'
            };
            var resizeClass = (this.classList.resize !== undefined ? (' ' + this.classList.resize) : '');
            ['start', 'end'].forEach (function (side) {
                var handleName = 'resize' + capitalizeFirstLetter(side);
                if (!this[handleName]) { return; }
                var handle = this[handleName + 'Handle'] = regionEl.appendChild(document.createElement('handle'));
                handle.classList = 'wavesurfer-handle wavesurfer-handle-' + side + resizeClass + (this.classList[handleName] !== undefined ? (' ' + this.classList[handleName]) : '');
                this.style(handle, resizeStyle);
                if (this.styleList[handleName] !== undefined) { this.style(handle, this.styleList[handleName]); }
                if (side == 'end') { this.style(handle, { left: '100%' }); }
            }, this);
        }

        this.element = this.wrapper.appendChild(regionEl);
        this.element.wavesurferRegion = this
        this.updateRender();
        this.bindEvents(regionEl);
    },

    formatTime: function (start, end) {
        return (start == end ? [ start ] : [ start, end ]).map(function (time) {
            return [
                Math.floor((time % 3600) / 60), // minutes
                ('00' + Math.floor(time % 60)).slice(-2) // seconds
            ].join(':');
        }).join('-');
    },

    getWidth: function () {
        return (this.wavesurfer.drawer.width || this.wavesurfer.getComputedWidthAndRange().width) / this.wavesurfer.params.pixelRatio;
    },

    /* Update the element's position, width, and color. */
    updateRender: function () {
        var duration = this.wavesurfer.getDuration();
        var width = this.getWidth();
        if (this.start < 0) {
          this.start = 0;
          this.end = this.end - this.start;
        }
        if (this.end > duration) {
          this.end = duration;
          this.start = duration - (this.end - this.start);
        }

        if (this.minLength != null) { this.end = Math.max(this.start + this.minLength, this.end); }
        if (this.maxLength != null) { this.end = Math.min(this.start + this.maxLength, this.end); }

        if (this.element != null) {
            // Calculate the left and width values of the region such that
            // no gaps appear between regions.
            var left = Math.round(this.start / duration * width);
            var regionWidth = Math.round(this.end / duration * width) - left;

            this.style(this.element, {
                left: left + 'px',
                width: regionWidth + 'px',
                backgroundColor: this.color,
            });

            this.regionManager.updateCursor();
            this.updateResizeHandleDisplay();

            for (var attrname in this.attributes) {
                this.element.setAttribute('data-region-' + attrname, this.attributes[attrname]);
            }

            if (this.showTitle) { this.element.title = this.formatTime(this.start, this.end); }
        }
    },

    updateResizeHandleDisplay: function () {
        if (this.resizeStartHandle) this.resizeStartHandle.style.display = this.resizeStart ? "" : "none";
        if (this.resizeEndHandle) this.resizeEndHandle.style.display = this.resizeEnd ? "" : "none";
    },

    /* Bind audio events. */
    bindInOut: function () {
        var my = this;

        my.firedIn = false;
        my.firedOut = false;

        var onProcess = function (time) {
            if (!my.firedOut && my.firedIn && (my.start >= Math.round(time * 100) / 100 || my.end <= Math.round(time * 100) / 100)) {
                my.firedOut = true;
                my.firedIn = false;
                my.fireEventPropagate('out');
            }
            if (!my.firedIn && my.start <= time && my.end > time) {
                my.firedIn = true;
                my.firedOut = false;
                my.fireEventPropagate('in');
            }
        };

        this.wavesurfer.backend.on('audioprocess', onProcess);

        this.on('remove', function () {
            my.wavesurfer.backend.un('audioprocess', onProcess);
        });

        /* Loop playback. */
        this.on('out', function () {
            if (my.loop) {
                my.wavesurfer.play(my.start);
            }
        });
    },

    /* Bind DOM events. */
    bindEvents: function () {
        var my = this;

        this.element.addEventListener('mouseenter', function (e) {
            my.fireEventPropagate('mouseenter', e);
        });

        this.element.addEventListener('mouseleave', function (e) {
            my.fireEventPropagate('mouseleave', e);
        });

        this.element.addEventListener('click', function (e) {
            e.preventDefault();
            my.fireEventPropagate('click', e);
        });

        this.element.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            e.preventDefault();
            my.fireEventPropagate('dblclick', e);
        });
        var element = my.element, regionManager = my.regionManager;
        element.addEventListener('mouseover', regionManager.onMouseOver);
        element.addEventListener('mouseout', regionManager.onMouseOut);
        element.addEventListener('mousedown', regionManager.onDown);
        element.addEventListener('touchstart', regionManager.onDown, {passive: false});
    },

    onDrag: function (initialStart, initialEnd, delta) {
        var maxEnd = this.wavesurfer.getDuration();

        this.update({
            start: initialStart + delta < 0 ? 0 : initialStart + delta,
            end: initialEnd + delta > maxEnd ? maxEnd : initialEnd + delta
        });
    },

    onResize: function (direction, initialStart, initialEnd, newTime) {
        var limitPosition = (direction == 'start') ? initialEnd : initialStart;
        this.update({start: Math.min(newTime, limitPosition), end: Math.max(newTime, limitPosition)});
    }
};

WaveSurfer.util.extend(WaveSurfer.Region, WaveSurfer.Observer);


/* Augment WaveSurfer with region methods. */
WaveSurfer.initRegions = function () {
    if (!this.regions) {
        this.regions = Object.create(WaveSurfer.Regions);
        this.regions.init(this);
    }
};

WaveSurfer.addRegion = function (options) {
    this.initRegions();
    return this.regions.add(options);
};

WaveSurfer.clearRegions = function () {
    this.regions && this.regions.clear();
};

WaveSurfer.enableDragSelection = function (options) {
    this.initRegions();
    this.regions.enableDragSelection(options);
};

WaveSurfer.disableDragSelection = function () {
    this.regions.disableDragSelection();
};
