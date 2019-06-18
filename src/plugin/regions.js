/**
 * (Single) Region plugin class
 *
 * Must be turned into an observer before instantiating. This is done in
 * `RegionsPlugin` (main plugin class).
 *
 * @extends {Observer}
 */
class Region {
    constructor(params, ws) {
        this.wavesurfer = ws;
        this.wrapper = ws.drawer.wrapper;
        this.util = ws.util;
        this.style = this.util.style;

        this.id = params.id == null ? ws.util.getId() : params.id;
        this.start = Number(params.start) || 0;
        this.end =
            params.end == null
                ? // small marker-like region
                  this.start +
                  (4 / this.wrapper.scrollWidth) * this.wavesurfer.getDuration()
                : Number(params.end);
        this.resize =
            params.resize === undefined ? true : Boolean(params.resize);
        this.drag = params.drag === undefined ? true : Boolean(params.drag);
        this.loop = Boolean(params.loop);
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
        this.data = params.data || {};
        this.attributes = params.attributes || {};

        this.maxLength = params.maxLength;
        this.minLength = params.minLength;
        this._onRedraw = () => this.updateRender();

        this.scroll = params.scroll !== false && ws.params.scrollParent;
        this.scrollSpeed = params.scrollSpeed || 1;
        this.scrollThreshold = params.scrollThreshold || 10;

        this.bindInOut();
        this.render();
        this.wavesurfer.on('zoom', this._onRedraw);
        this.wavesurfer.on('redraw', this._onRedraw);
        this.wavesurfer.fireEvent('region-created', this);
    }

    /* Update region params. */
    update(params) {
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
    }

    /* Remove a single region. */
    remove() {
        if (this.element) {
            this.wrapper.removeChild(this.element);
            this.element = null;
            this.fireEvent('remove');
            this.wavesurfer.un('zoom', this._onRedraw);
            this.wavesurfer.un('redraw', this._onRedraw);
            this.wavesurfer.fireEvent('region-removed', this);
        }
    }

    /* Play the audio region. */
    play() {
        this.wavesurfer.play(this.start, this.end);
        this.fireEvent('play');
        this.wavesurfer.fireEvent('region-play', this);
    }

    /* Play the region in loop. */
    playLoop() {
        this.play();
        this.once('out', () => this.playLoop());
    }

    /* Render a region as a DOM element. */
    render() {
        const regionEl = document.createElement('region');
        regionEl.className = 'wavesurfer-region';
        regionEl.title = this.formatTime(this.start, this.end);
        regionEl.setAttribute('data-id', this.id);

        for (const attrname in this.attributes) {
            regionEl.setAttribute(
                'data-region-' + attrname,
                this.attributes[attrname]
            );
        }

        const width = this.wrapper.scrollWidth;
        this.style(regionEl, {
            position: 'absolute',
            zIndex: 2,
            height: '100%',
            top: '0px'
        });

        /* Resize handles */
        if (this.resize) {
            const handleLeft = regionEl.appendChild(
                document.createElement('handle')
            );
            const handleRight = regionEl.appendChild(
                document.createElement('handle')
            );
            handleLeft.className = 'wavesurfer-handle wavesurfer-handle-start';
            handleRight.className = 'wavesurfer-handle wavesurfer-handle-end';
            const css = {
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
    }

    formatTime(start, end) {
        return (start == end ? [start] : [start, end])
            .map(time =>
                [
                    Math.floor((time % 3600) / 60), // minutes
                    ('00' + Math.floor(time % 60)).slice(-2) // seconds
                ].join(':')
            )
            .join('-');
    }

    getWidth() {
        return this.wavesurfer.drawer.width / this.wavesurfer.params.pixelRatio;
    }

    /* Update element's position, width, color. */
    updateRender() {
        // duration varies during loading process, so don't overwrite important data
        const dur = this.wavesurfer.getDuration();
        const width = this.getWidth();

        var startLimited = this.start;
        var endLimited = this.end;
        if (startLimited < 0) {
            startLimited = 0;
            endLimited = endLimited - startLimited;
        }
        if (endLimited > dur) {
            endLimited = dur;
            startLimited = dur - (endLimited - startLimited);
        }

        if (this.minLength != null) {
            endLimited = Math.max(startLimited + this.minLength, endLimited);
        }

        if (this.maxLength != null) {
            endLimited = Math.min(startLimited + this.maxLength, endLimited);
        }

        if (this.element != null) {
            // Calculate the left and width values of the region such that
            // no gaps appear between regions.
            const left = Math.round((startLimited / dur) * width);
            const regionWidth = Math.round((endLimited / dur) * width) - left;

            this.style(this.element, {
                left: left + 'px',
                width: regionWidth + 'px',
                backgroundColor: this.color,
                cursor: this.drag ? 'move' : 'default'
            });

            for (const attrname in this.attributes) {
                this.element.setAttribute(
                    'data-region-' + attrname,
                    this.attributes[attrname]
                );
            }

            this.element.title = this.formatTime(this.start, this.end);
        }
    }

    /* Bind audio events. */
    bindInOut() {
        this.firedIn = false;
        this.firedOut = false;

        const onProcess = time => {
            if (
                !this.firedOut &&
                this.firedIn &&
                (this.start >= Math.round(time * 100) / 100 ||
                    this.end <= Math.round(time * 100) / 100)
            ) {
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
    }

    /* Bind DOM events. */
    bindEvents() {
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
        (this.drag || this.resize) &&
            (() => {
                const container = this.wavesurfer.drawer.container;
                const scrollSpeed = this.scrollSpeed;
                const scrollThreshold = this.scrollThreshold;
                let startTime;
                let touchId;
                let drag;
                let maxScroll;
                let resize;
                let updated = false;
                let scrollDirection;
                let wrapperRect;

                // Scroll when the user is dragging within the threshold
                const edgeScroll = e => {
                    const duration = this.wavesurfer.getDuration();
                    if (!scrollDirection || (!drag && !resize)) {
                        return;
                    }

                    // Update scroll position
                    let scrollLeft =
                        this.wrapper.scrollLeft + scrollSpeed * scrollDirection;
                    this.wrapper.scrollLeft = scrollLeft = Math.min(
                        maxScroll,
                        Math.max(0, scrollLeft)
                    );

                    // Get the currently selected time according to the mouse position
                    const time = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                        this.wavesurfer.drawer.handleEvent(e) * duration
                    );
                    const delta = time - startTime;
                    startTime = time;

                    // Continue dragging or resizing
                    drag ? this.onDrag(delta) : this.onResize(delta, resize);

                    // Repeat
                    window.requestAnimationFrame(() => {
                        edgeScroll(e);
                    });
                };

                const onDown = e => {
                    const duration = this.wavesurfer.getDuration();
                    if (e.touches && e.touches.length > 1) {
                        return;
                    }
                    touchId = e.targetTouches
                        ? e.targetTouches[0].identifier
                        : null;

                    // stop the event propagation, if this region is resizable or draggable
                    // and the event is therefore handled here.
                    if (this.drag || this.resize) {
                        e.stopPropagation();
                    }

                    // Store the selected startTime we begun dragging or resizing
                    startTime = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                        this.wavesurfer.drawer.handleEvent(e, true) * duration
                    );

                    // Store for scroll calculations
                    maxScroll =
                        this.wrapper.scrollWidth - this.wrapper.clientWidth;
                    wrapperRect = this.wrapper.getBoundingClientRect();

                    if (e.target.tagName.toLowerCase() == 'handle') {
                        if (
                            e.target.classList.contains(
                                'wavesurfer-handle-start'
                            )
                        ) {
                            resize = 'start';
                        } else {
                            resize = 'end';
                        }
                    } else {
                        drag = true;
                        resize = false;
                    }
                };
                const onUp = e => {
                    if (e.touches && e.touches.length > 1) {
                        return;
                    }

                    if (drag || resize) {
                        drag = false;
                        scrollDirection = null;
                        resize = false;
                    }

                    if (updated) {
                        updated = false;
                        this.util.preventClick();
                        this.fireEvent('update-end', e);
                        this.wavesurfer.fireEvent('region-update-end', this, e);
                    }
                };
                const onMove = e => {
                    const duration = this.wavesurfer.getDuration();

                    if (e.touches && e.touches.length > 1) {
                        return;
                    }
                    if (
                        e.targetTouches &&
                        e.targetTouches[0].identifier != touchId
                    ) {
                        return;
                    }

                    if (drag || resize) {
                        const oldTime = startTime;
                        const time = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                            this.wavesurfer.drawer.handleEvent(e) * duration
                        );

                        const delta = time - startTime;
                        startTime = time;

                        // Drag
                        if (this.drag && drag) {
                            updated = updated || !!delta;
                            this.onDrag(delta);
                        }

                        // Resize
                        if (this.resize && resize) {
                            updated = updated || !!delta;
                            this.onResize(delta, resize);
                        }

                        if (
                            this.scroll &&
                            container.clientWidth < this.wrapper.scrollWidth
                        ) {
                            if (drag) {
                                // The threshold is not between the mouse and the container edge
                                // but is between the region and the container edge
                                const regionRect = this.element.getBoundingClientRect();
                                let x = regionRect.left - wrapperRect.left;

                                // Check direction
                                if (time < oldTime && x >= 0) {
                                    scrollDirection = -1;
                                } else if (
                                    time > oldTime &&
                                    x + regionRect.width <= wrapperRect.right
                                ) {
                                    scrollDirection = 1;
                                }

                                // Check that we are still beyond the threshold
                                if (
                                    (scrollDirection === -1 &&
                                        x > scrollThreshold) ||
                                    (scrollDirection === 1 &&
                                        x + regionRect.width <
                                            wrapperRect.right - scrollThreshold)
                                ) {
                                    scrollDirection = null;
                                }
                            } else {
                                // Mouse based threshold
                                let x = e.clientX - wrapperRect.left;

                                // Check direction
                                if (x <= scrollThreshold) {
                                    scrollDirection = -1;
                                } else if (
                                    x >=
                                    wrapperRect.right - scrollThreshold
                                ) {
                                    scrollDirection = 1;
                                } else {
                                    scrollDirection = null;
                                }
                            }

                            scrollDirection && edgeScroll(e);
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
    }

    onDrag(delta) {
        const maxEnd = this.wavesurfer.getDuration();
        if (this.end + delta > maxEnd || this.start + delta < 0) {
            return;
        }

        this.update({
            start: this.start + delta,
            end: this.end + delta
        });
    }

    onResize(delta, direction) {
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
}

/**
 * @typedef {Object} RegionsPluginParams
 * @property {?boolean} dragSelection Enable creating regions by dragging with
 * the mouse
 * @property {?RegionParams[]} regions Regions that should be added upon
 * initialisation
 * @property {number} slop=2 The sensitivity of the mouse dragging
 * @property {?number} snapToGridInterval Snap the regions to a grid of the specified multiples in seconds
 * @property {?number} snapToGridOffset Shift the snap-to-grid by the specified seconds. May also be negative.
 * @property {?boolean} deferInit Set to true to manually call
 * `initPlugin('regions')`
 */

/**
 * @typedef {Object} RegionParams
 * @desc The parameters used to describe a region.
 * @example wavesurfer.addRegion(regionParams);
 * @property {string} id=→random The id of the region
 * @property {number} start=0 The start position of the region (in seconds).
 * @property {number} end=0 The end position of the region (in seconds).
 * @property {?boolean} loop Whether to loop the region when played back.
 * @property {boolean} drag=true Allow/disallow dragging the region.
 * @property {boolean} resize=true Allow/disallow resizing the region.
 * @property {string} [color='rgba(0, 0, 0, 0.1)'] HTML color code.
 */

/**
 * Regions are visual overlays on waveform that can be used to play and loop
 * portions of audio. Regions can be dragged and resized.
 *
 * Visual customization is possible via CSS (using the selectors
 * `.wavesurfer-region` and `.wavesurfer-handle`).
 *
 * @implements {PluginClass}
 * @extends {Observer}
 *
 * @example
 * // es6
 * import RegionsPlugin from 'wavesurfer.regions.js';
 *
 * // commonjs
 * var RegionsPlugin = require('wavesurfer.regions.js');
 *
 * // if you are using <script> tags
 * var RegionsPlugin = window.WaveSurfer.regions;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     RegionsPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class RegionsPlugin {
    /**
     * Regions plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param {RegionsPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'regions',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {
                addRegion(options) {
                    if (!this.initialisedPluginList.regions) {
                        this.initPlugin('regions');
                    }
                    return this.regions.add(options);
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
            instance: RegionsPlugin
        };
    }

    constructor(params, ws) {
        this.params = params;
        this.wavesurfer = ws;
        this.util = ws.util;
        this.util.getRegionSnapToGridValue = value => {
            return this.getRegionSnapToGridValue(value, params);
        };

        // turn the plugin instance into an observer
        const observerPrototypeKeys = Object.getOwnPropertyNames(
            this.util.Observer.prototype
        );
        observerPrototypeKeys.forEach(key => {
            Region.prototype[key] = this.util.Observer.prototype[key];
        });
        this.wavesurfer.Region = Region;

        this._onBackendCreated = () => {
            this.wrapper = this.wavesurfer.drawer.wrapper;
            if (this.params.regions) {
                this.params.regions.forEach(region => {
                    this.add(region);
                });
            }
        };

        // Id-based hash of regions
        this.list = {};
        this._onReady = () => {
            if (this.params.dragSelection) {
                this.enableDragSelection(this.params);
            }
            Object.keys(this.list).forEach(id => {
                this.list[id].updateRender();
            });
        };
    }

    init() {
        // Check if ws is ready
        if (this.wavesurfer.isReady) {
            this._onBackendCreated();
            this._onReady();
        } else {
            this.wavesurfer.once('ready', this._onReady);
            this.wavesurfer.once('backend-created', this._onBackendCreated);
        }
    }

    destroy() {
        this.wavesurfer.un('ready', this._onReady);
        this.wavesurfer.un('backend-created', this._onBackendCreated);
        this.disableDragSelection();
        this.clear();
    }

    /**
     * Add a region
     *
     * @param {object} params Region parameters
     * @return {Region} The created region
     */
    add(params) {
        const region = new this.wavesurfer.Region(params, this.wavesurfer);

        this.list[region.id] = region;

        region.on('remove', () => {
            delete this.list[region.id];
        });

        return region;
    }

    /**
     * Remove all regions
     */
    clear() {
        Object.keys(this.list).forEach(id => {
            this.list[id].remove();
        });
    }

    enableDragSelection(params) {
        const slop = params.slop || 2;
        const container = this.wavesurfer.drawer.container;
        const scroll =
            params.scroll !== false && this.wavesurfer.params.scrollParent;
        const scrollSpeed = params.scrollSpeed || 1;
        const scrollThreshold = params.scrollThreshold || 10;
        let drag;
        let duration = this.wavesurfer.getDuration();
        let maxScroll;
        let start;
        let region;
        let touchId;
        let pxMove = 0;
        let scrollDirection;
        let wrapperRect;

        // Scroll when the user is dragging within the threshold
        const edgeScroll = e => {
            if (!region || !scrollDirection) {
                return;
            }

            // Update scroll position
            let scrollLeft =
                this.wrapper.scrollLeft + scrollSpeed * scrollDirection;
            this.wrapper.scrollLeft = scrollLeft = Math.min(
                maxScroll,
                Math.max(0, scrollLeft)
            );

            // Update range
            const end = this.wavesurfer.drawer.handleEvent(e);
            region.update({
                start: Math.min(end * duration, start * duration),
                end: Math.max(end * duration, start * duration)
            });

            // Check that there is more to scroll and repeat
            if (scrollLeft < maxScroll && scrollLeft > 0) {
                window.requestAnimationFrame(() => {
                    edgeScroll(e);
                });
            }
        };

        const eventDown = e => {
            if (e.touches && e.touches.length > 1) {
                return;
            }
            duration = this.wavesurfer.getDuration();
            touchId = e.targetTouches ? e.targetTouches[0].identifier : null;

            // Store for scroll calculations
            maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;
            wrapperRect = this.wrapper.getBoundingClientRect();

            drag = true;
            start = this.wavesurfer.drawer.handleEvent(e, true);
            region = null;
            scrollDirection = null;
        };
        this.wrapper.addEventListener('mousedown', eventDown);
        this.wrapper.addEventListener('touchstart', eventDown);
        this.on('disable-drag-selection', () => {
            this.wrapper.removeEventListener('touchstart', eventDown);
            this.wrapper.removeEventListener('mousedown', eventDown);
        });

        const eventUp = e => {
            if (e.touches && e.touches.length > 1) {
                return;
            }

            drag = false;
            pxMove = 0;
            scrollDirection = null;

            if (region) {
                this.util.preventClick();
                region.fireEvent('update-end', e);
                this.wavesurfer.fireEvent('region-update-end', region, e);
            }

            region = null;
        };
        this.wrapper.addEventListener('mouseup', eventUp);
        this.wrapper.addEventListener('touchend', eventUp);

        document.body.addEventListener('mouseup', eventUp);
        document.body.addEventListener('touchend', eventUp);
        this.on('disable-drag-selection', () => {
            document.body.removeEventListener('mouseup', eventUp);
            document.body.removeEventListener('touchend', eventUp);
            this.wrapper.removeEventListener('touchend', eventUp);
            this.wrapper.removeEventListener('mouseup', eventUp);
        });

        const eventMove = e => {
            if (!drag) {
                return;
            }
            if (++pxMove <= slop) {
                return;
            }

            if (e.touches && e.touches.length > 1) {
                return;
            }
            if (e.targetTouches && e.targetTouches[0].identifier != touchId) {
                return;
            }

            if (!region) {
                region = this.add(params || {});
            }

            const end = this.wavesurfer.drawer.handleEvent(e);
            const startUpdate = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                start * duration
            );
            const endUpdate = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                end * duration
            );
            region.update({
                start: Math.min(endUpdate, startUpdate),
                end: Math.max(endUpdate, startUpdate)
            });

            // If scrolling is enabled
            if (scroll && container.clientWidth < this.wrapper.scrollWidth) {
                // Check threshold based on mouse
                const x = e.clientX - wrapperRect.left;
                if (x <= scrollThreshold) {
                    scrollDirection = -1;
                } else if (x >= wrapperRect.right - scrollThreshold) {
                    scrollDirection = 1;
                } else {
                    scrollDirection = null;
                }
                scrollDirection && edgeScroll(e);
            }
        };
        this.wrapper.addEventListener('mousemove', eventMove);
        this.wrapper.addEventListener('touchmove', eventMove);
        this.on('disable-drag-selection', () => {
            this.wrapper.removeEventListener('touchmove', eventMove);
            this.wrapper.removeEventListener('mousemove', eventMove);
        });
    }

    disableDragSelection() {
        this.fireEvent('disable-drag-selection');
    }

    /**
     * Get current region
     *
     * The smallest region that contains the current time. If several such
     * regions exist, take the first. Return `null` if none exist.
     *
     * @returns {Region} The current region
     */
    getCurrentRegion() {
        const time = this.wavesurfer.getCurrentTime();
        let min = null;
        Object.keys(this.list).forEach(id => {
            const cur = this.list[id];
            if (cur.start <= time && cur.end >= time) {
                if (!min || cur.end - cur.start < min.end - min.start) {
                    min = cur;
                }
            }
        });

        return min;
    }

    /**
     * Match the value to the grid, if required
     *
     * If the regions plugin params have a snapToGridInterval set, return the
     * value matching the nearest grid interval. If no snapToGridInterval is set,
     * the passed value will be returned without modification.
     *
     * @param {number} value the value to snap to the grid, if needed
     * @param {Object} params the regions plugin params
     * @returns {number} value
     */
    getRegionSnapToGridValue(value, params) {
        if (params.snapToGridInterval) {
            // the regions should snap to a grid
            const offset = params.snapToGridOffset || 0;
            return (
                Math.round((value - offset) / params.snapToGridInterval) *
                    params.snapToGridInterval +
                offset
            );
        }

        // no snap-to-grid
        return value;
    }
}
