/**
 *  @since 4.0.0 This class has been split
 *
 * @typedef {Object} SelectionPluginParams
 * @property {?boolean} dragSelection Enable creating selections by dragging with
 * the mouse
 * @property {?SelectionParams[]} selections Selections that should be added upon
 * initialisation
 * @property {number} slop=2 The sensitivity of the mouse dragging
 * @property {?number} snapToGridInterval Snap the selections to a grid of the specified multiples in seconds
 * @property {?number} snapToGridOffset Shift the snap-to-grid by the specified seconds. May also be negative.
 * @property {?boolean} deferInit Set to true to manually call
 * @property {number[]} maxSelections Maximum number of selections that may be created by the user at one time.
 * `initPlugin('selections')`
 * @property {function} formatTimeCallback Allows custom formating for selection tooltip.
 * @property {?number} edgeScrollWidth='5% from container edges' Optional width for edgeScroll to start
 */

/**
 * @typedef {Object} SelectionParams
 * @desc The parameters used to describe a selection.
 * @example wavesurfer.addSelection(selectionParams);
 * @property {string} id=→random The id of the selection
 * @property {number} start=0 The start position of the selection (in seconds).
 * @property {number} end=0 The end position of the selection (in seconds).
 * @property {?boolean} loop Whether to loop the selection when played back.
 * @property {boolean} drag=true Allow/disallow dragging the selection.
 * @property {boolean} resize=true Allow/disallow resizing the selection.
 * @property {string} [color='rgba(0, 0, 0, 0.1)'] HTML color code.
 * @property {?number} channelIdx Select channel to draw the selection on (if there are multiple channel waveforms).
 * @property {?object} handleStyle A set of CSS properties used to style the left and right handle.
 * @property {?boolean} preventContextMenu=false Determines whether the context menu is prevented from being opened.
 * @property {boolean} showTooltip=true Enable/disable tooltip displaying start and end times when hovering over selection.
 */

import {Region} from "./region";
import {SelectiveCanvas} from "./selectivecanvas";

/**
 * Selections are visual overlays on waveform that can be used to play and loop
 * portions of audio. Selections can be dragged and resized.
 *
 * Visual customization is possible via CSS (using the selectors
 * `.wavesurfer-selection` and `.wavesurfer-handle`).
 *
 * @implements {PluginClass}
 * @extends {Observer}
 *
 * @example
 * // es6
 * import SelectionPlugin from 'wavesurfer.selections.js';
 *
 * // commonjs
 * var SelectionPlugin = require('wavesurfer.selections.js');
 *
 * // if you are using <script> tags
 * var SelectionPlugin = window.WaveSurfer.selections;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     SelectionPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class SelectionPlugin {
    // Renderer for this plugin. Pass to wavesurfer.renderer
    static SelectiveCanvas = SelectiveCanvas;
    /**
     * Selections plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param {SelectionPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'selection',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            staticProps: {
                addSelection(options) {
                    if (!this.initialisedPluginList.selection) {
                        this.initPlugin('selection');
                    }
                    return this.selection.add(options);
                },

                clearSelections() {
                    this.selection && this.selection.clear();
                },

                enableDragSelection(options) {
                    if (!this.initialisedPluginList.selections) {
                        this.initPlugin('selection');
                    }
                    this.selection.enableDragSelection(options);
                },

                disableDragSelection() {
                    this.selection.disableDragSelection();
                },

                getDisplayRange() {
                    return this.selection._getDisplayRange();
                },

                seekTo(progress) {
                    // no-op. Overides seek so that it can be handled by
                    // the selection area
                },

                updateDisplayRange({
                    start,
                    end,
                    duration
                }) {
                    this.selection.displayRange.start = start || this.selection.displayRange.start;
                    this.selection.displayRange.end = end || this.selection.displayRange.end;
                    this.selection.displayRange.duration = duration || this.selection.displayRange.duration;
                },

                updateSelectionZones(selectionZones){
                    return this.selection._updateSelectionZones(selectionZones);
                },

                getOverlapZone(start, end) {
                    return this.selection._getOverlapZone(start, end);
                }
            },
            instance: SelectionPlugin
        };
    }

    constructor(params, ws) {
        this.params = params;
        this.wavesurfer = ws;
        this.util = {
            ...ws.util,
            getRegionSnapToGridValue: value => {
                return this.getRegionSnapToGridValue(value, params);
            }
        };
        this.maxSelections = 1;
        this.selectionsMinLength = params.selectionsMinLength || null;

        this.displayRange = {
            start : this.params.displayStart,
            duration : this.params.displayDuration,
            end : this.params.displayDuration + this.params.displayStart
        };
        this.id = params.zoneId;
        this.selectionZones = {};
        this._updateSelectionZones(params.selectionZones || {});
        this.dragThruZones = params.dragThruZones || false;

        // turn the plugin instance into an observer
        const observerPrototypeKeys = Object.getOwnPropertyNames(
            this.util.Observer.prototype
        );
        observerPrototypeKeys.forEach(key => {
            Region.prototype[key] = this.util.Observer.prototype[key];
        });
        this.wavesurfer.Selection = Region;

        // By default, scroll the container if the user drags a selection
        // within 5% (based on its initial size) of its edge
        const scrollWidthProportion = 0.05;
        this._onBackendCreated = () => {
            this.wrapper = this.wavesurfer.drawer.wrapper;
            this.orientation = this.wavesurfer.drawer.orientation;
            this.defaultEdgeScrollWidth = this.wrapper.clientWidth * scrollWidthProportion;
            if (this.params.selection) {
                this.params.selection.forEach(selection => {
                    this.add(selection);
                });
            }

        };

        // selection's one allowed region
        this.region = null;
        this._onReady = () => {

            this.wrapper = this.wavesurfer.drawer.wrapper;
            this.vertical = this.wavesurfer.drawer.params.vertical;
            if (this.params.dragSelection) {
                this.enableDragSelection(this.params);
            }
            if (this.region) {
                this.region.updateRender();
            }
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
        // Disabling `selection-removed' because destroying the plugin calls
        // the Region.remove() method that is also used to remove selections based
        // on user input. This can cause confusion since teardown is not a
        // user event, but would emit `selection-removed` as if it was.
        this.wavesurfer.setDisabledEventEmissions(['selection-removed']);
        this.disableDragSelection();
        this.clear();
    }

    getVisualRange({start, end}) {
        return {
            start: start - this.displayRange.start,
            end: end - this.displayRange.start
        };
    }

    updateCanvasSelection(selection, fitSelf = true) {
        if (this.wavesurfer.drawer instanceof SelectiveCanvas) {
            const {start, end} = selection;

            if (!fitSelf || this._updateSelectionZones({self: this.getVisualRange({ start, end })})) {
                this.wavesurfer.drawer.updateSelection(selection);
                this.wavesurfer.drawer.updateDisplayState({
                    displayStart    : this.displayRange.start,
                    displayDuration : this.displayRange.duration
                });
                this.wavesurfer.drawBuffer();
            }
        }
    }

    _updateSelectionZones(selectionZones) {
        let {self, ...zones} = this.selectionZones;
        Object.entries(selectionZones).forEach(([key, val]) => {
            if (key === 'self' || key === this.id) {
                self = val;
            } else {
                zones[key] = val;
            }
        });
        this.selectionZones = {...zones};
        if (self) {
            const {start, end} = this.getFirstFreeZone(zones, self.start, self.end);
            if (start !== self.start || end !== self.end) {
                this.displayRange.start = this.region.start - start;
                this.region.update({end : this.region.start + end - start});
                return false;
            }
        }
        this.selectionZones.self = self;
        return true;
    }

    // given an object of existing zones, returns an ordered array of available zones
    getFreeZones(zones) {
        if (!this.region) {return [];}
        const minGap = this.region.minLength;
        // sorted list of zones
        let usedZones = Object.values(zones).sort((a, b) => (a.start - b.start) );
        // add contructed 'end' zone
        usedZones.push({start: this.displayRange.duration});

        let freeZones = [];
        let index = 0;
        usedZones.forEach((zone) => {
            const range = zone.start - index;
            // if the difference between the current index and the start of the range is larger
            // than the minimum selection size, then it's a valid available zone
            if (range > minGap) {
                freeZones.push({start: index, end: zone.start});
            }
            index = zone.end;
        });
        return freeZones;
    }
    // given a list of zones, finds the first range that a new zone can fit in
    getFirstFreeZone(zones, targetStart = 0, targetEnd = this.displayRange.duration) {
        const freeZones = this.getFreeZones(zones);
        let start = targetStart;
        let end = targetEnd;
        const duration = end - start;

        for (const zone of freeZones.values()) {
            // targetStart is beyond this zone
            if (start > zone.end) {
                continue;
            }
            // adapt start if it is not within the zone (prefer retaining duration)
            if (start < zone.start) {
                start = zone.start;
                end = start + duration;
            }
            // adapt end if it is not within the zone
            if (end > zone.end) {
                end = zone.end;
            }
            // if we get this far, we've found our zone
            break;
        }
        return { start, end };
    }

    _getDisplayRange() {
        return this.displayRange;
    }

    getDeadZones() {
        const {self, ...dead} = this.selectionZones;
        return dead;
    }

    /**
     * Gets any zones, except self that overlap with the given point or range
     *
     * @param {number} start - start of selection range
     * @param {number?} end - end of selection range
     * @returns bounds of zone that is overlapped, if any
     */
    _getOverlapZone(start, end = start) {
        const zones = this.getDeadZones();
        const zoneIds = Object.keys(zones);
        for (let i = 0; i < zoneIds.length; i += 1){
            const id = zoneIds[i];
            if (
                // selection overlaps the right side of a zone
                (zones[id].start <= start && zones[id].end >= start) ||
                // selection overlaps the left side of a zone
                (zones[id].start <= end && zones[id].end >= end) ||
                // zone is entirely within selection
                (zones[id].start >= start && zones[id].end <= end)
            ) {
                return {...zones[id], id: id};
            }
        }
        return null;
    }

    /**
     * Add a selection
     *
     * @param {object} params Selection parameters
     * @return {Selection} The created selection
     */
    add(params) {
        params = {
            edgeScrollWidth: this.params.edgeScrollWidth || this.defaultEdgeScrollWidth,
            ...params
        };

        // Take formatTimeCallback from plugin params if not already set
        if (!params.formatTimeCallback && this.params.formatTimeCallback) {
            params = {...params, formatTimeCallback: this.params.formatTimeCallback};
        }

        if (!params.minLength && this.selectionsMinLength) {
            params = {...params, minLength: this.selectionsMinLength};
        }

        this.clear();
        const selection = new this.wavesurfer.Selection(params, this.util, this.wavesurfer);

        // replace region with new selection area
        this.region = selection;
        this.updateCanvasSelection(selection);

        this.wavesurfer.on('region-updated', (regionData) => {

            this.updateCanvasSelection(regionData);
        });

        selection.on('remove', () => {
            this.region = null;
        });

        return selection;
    }

    /**
     * Remove selection
     */
    clear() {
        this.region?.remove();
    }

    enableDragSelection(params) {
        this.disableDragSelection();

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
        let selection;
        let touchId;
        let pxMove = 0;
        let scrollDirection;
        let wrapperRect;

        // Scroll when the user is dragging within the threshold
        const edgeScroll = e => {
            if (!selection || !scrollDirection) {
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
            selection.update({
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
            maxScroll = this.wrapper.scrollWidth -
                this.wrapper.clientWidth;
            wrapperRect = this.util.withOrientation(
                this.wrapper.getBoundingClientRect(),
                this.vertical
            );

            // set the selection channel index based on the clicked area
            if (this.wavesurfer.params.splitChannels) {
                const y = (e.touches ? e.touches[0].clientY : e.clientY) - wrapperRect.top;
                const channelCount = this.wavesurfer.backend.buffer != null ? this.wavesurfer.backend.buffer.numberOfChannels : 1;
                const channelHeight = this.wrapper.clientHeight / channelCount;
                const channelIdx = Math.floor(y / channelHeight);
                params.channelIdx = channelIdx;
                const channelColors = this.wavesurfer.params.splitChannelsOptions.channelColors[channelIdx];
                if (channelColors && channelColors.dragColor) {
                    params.color = channelColors.dragColor;
                }
            }

            drag = true;
            start = this.wavesurfer.drawer.handleEvent(e, true);
            selection = null;
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

            if (selection) {
                this.util.preventClick();
                selection.fireEvent('update-end', e);
                this.wavesurfer.fireEvent('selection-update-end', selection, e);
            }

            selection = null;
        };
        this.wrapper.addEventListener('mouseleave', eventUp);
        this.wrapper.addEventListener('mouseup', eventUp);
        this.wrapper.addEventListener('touchend', eventUp);

        document.body.addEventListener('mouseup', eventUp);
        document.body.addEventListener('touchend', eventUp);
        this.on('disable-drag-selection', () => {
            document.body.removeEventListener('mouseup', eventUp);
            document.body.removeEventListener('touchend', eventUp);
            this.wrapper.removeEventListener('touchend', eventUp);
            this.wrapper.removeEventListener('mouseup', eventUp);
            this.wrapper.removeEventListener('mouseleave', eventUp);
        });

        const eventMove = event => {
            if (!drag) {
                return;
            }
            if (++pxMove <= slop) {
                return;
            }

            if (event.touches && event.touches.length > 1) {
                return;
            }
            if (event.targetTouches && event.targetTouches[0].identifier != touchId) {
                return;
            }

            // auto-create a selection during mouse drag, unless selection-count would exceed "maxSelections"
            if (!selection) {
                selection = this.add(params || {});
                if (!selection) {
                    return;
                }
            }

            const end = this.wavesurfer.drawer.handleEvent(event);
            const startUpdate = this.wavesurfer.selections.util.getRegionSnapToGridValue(
                start * duration
            );
            const endUpdate = this.wavesurfer.selections.util.getRegionSnapToGridValue(
                end * duration
            );
            selection.update({
                start: Math.min(endUpdate, startUpdate),
                end: Math.max(endUpdate, startUpdate)
            });

            let orientedEvent = this.util.withOrientation(event, this.vertical);

            // If scrolling is enabled
            if (scroll && container.clientWidth < this.wrapper.scrollWidth) {
                // Check threshold based on mouse
                const x = orientedEvent.clientX - wrapperRect.left;
                if (x <= scrollThreshold) {
                    scrollDirection = -1;
                } else if (x >= wrapperRect.right - scrollThreshold) {
                    scrollDirection = 1;
                } else {
                    scrollDirection = null;
                }
                scrollDirection && edgeScroll(event);
            }
        };
        this.wrapper.addEventListener('mousemove', eventMove);
        this.wrapper.addEventListener('touchmove', eventMove);
        this.on('disable-drag-selection', () => {
            this.wrapper.removeEventListener('touchmove', eventMove);
            this.wrapper.removeEventListener('mousemove', eventMove);
        });

        this.wavesurfer.on('selection-created', selection => {
            if (this.selectionsMinLength) {
                selection.minLength = this.selectionsMinLength;
            }
        });
    }

    disableDragSelection() {
        this.fireEvent('disable-drag-selection');
    }

    /**
     * Match the value to the grid, if required
     *
     * If the selections plugin params have a snapToGridInterval set, return the
     * value matching the nearest grid interval. If no snapToGridInterval is set,
     * the passed value will be returned without modification.
     *
     * @param {number} value the value to snap to the grid, if needed
     * @param {Object} params the selections plugin params
     * @returns {number} value
     */
    getRegionSnapToGridValue(value, params) {
        if (params.snapToGridInterval) {
            // the selections should snap to a grid
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
