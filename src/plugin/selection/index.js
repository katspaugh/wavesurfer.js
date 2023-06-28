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
 * @property {number} boundaryDuration Duration of the boundary container in seconds.
 * @property {?string} zoneId If passing a selectionZones object, this is the id of the zone in that object that represents this selection
 * @property {?object} selectionZones object representing all selections within this boundary
 * @property {boolean} dragThruZones If false, dragging logic stops the selection from being dragged through other zones.

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
 * @property {number} selectionStart start point of the selection regions, relative to the boundary container
 * @property {number} hideBarEnds number of bars of the waveform to hide at the beginning and end of a region
 * @property {number} regionGap spacer to apply to regions to allow a visual gap without having an actual gap
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

                seekTo(progress) {
                    // no-op. Overides seek so that it can be handled by
                    // the selection area
                },

                /*
                boundary represents the arbitrary container within which the audio region is displayed
                It is largely used for internal calculations of how to render the region and wave.
                values:
                * duration - the duration of the container, from which we derive the scale of the wave
                * offset - the start point of the full audio wave, relative to the container.
                  This can be negative if the wave starts after the beginning of the boundary.
                  e.g. A selection region that starts at 3sec (relative to the audio), which is displayed at 5sec (relative to the boundary container)
                  would have an offset of -2. i.e. when rendering the wave, we start at -2sec relative to the
                  audio and 0sec relative to the container. So: 0sec of the audio is 2sec _into_ the boundary container
                */

                /**
                 * getBoundary
                 *
                 * @typedef {object} returnObj
                 * @property {number} returnObj.boundaryDuration duration of boundary container in seconds
                 * @property {number} returnObj.offset start point of audio wave, relative to boundary start, in seconds
                 * @returns {returnObj} return object
                 */
                getBoundary() {
                    return this.selection._getBoundary();
                },

                /**
                 * updateBoundary
                 *
                 * @param {object} args args
                 * @param {number} args.boundaryDuration duration of boundary container in seconds
                 * @param {number} args.offset start point of audio wave, relative to boundary start, in seconds
                 */
                updateBoundary(args) {
                    this.selection._updateBoundary(args);
                },
                // get wavesurfer current time, relative to the boundary
                getBoundaryTime() {
                    return this.selection._getBoundaryTime();
                },

                /*
                selectionZones is an object representing THIS audio region and any other regions that are
                represented in the same container boundary.
                values:
                * id - unique id for each zone. Internally the id that matches this.selection.zoneId is stored as 'self'
                * start - start time in seconds (relative to the boundary container) that the zone starts
                * end - end time in seconds (relative to the boundary container) that the zone ends
                */

                /**
                 * getSelectionZones
                 *
                 * @typedef {object} zone
                 * @property {number} zone.start start point of selection zone, relative to boundary start, in seconds
                 * @property {number} zone.end end point of selection zone, relative to boundary start, in seconds
                 * @returns {Record<string, zone>} return object
                 */
                getSelectionZones(){
                    return this.selection._getSelectionZones();
                },

                /**
                 * updateSelectionZones
                 *
                 * @typedef {object} zone
                 * @property {number} zone.start start point of selection zone, relative to boundary start, in seconds
                 * @property {number} zone.end end point of selection zone, relative to boundary start, in seconds
                 *
                 * @param {Record<string, zone>} selectionZones object of selection zones
                 * @param {?boolean} fitSelf attempt to fit self zone
                 * @param {?force} force overwrite existing zones
                 * @returns {boolean} return object
                 */
                updateSelectionZones(selectionZones, fitSelf, force){
                    return this.selection._updateSelectionZones(selectionZones, fitSelf, force);
                },

                getOverlapZone(start, end) {
                    return this.selection._getOverlapZone(start, end);
                },

                /*
                selectionData is an interface, largely for external use, to region and boundary data
                eliding data that should only be used internally.
                values:
                * boundaryDuration - boundary duration
                * selectionStart - start of selection region, relative to the boundary
                * audioStart - start of audio, relative to the audio clip
                * audioEnd - end of audio, relative to the audio clip
                */

                /**
                 * getSelectionData
                 *
                 * @typedef {object} selectionData
                 * @property {number} selectionData.boundaryDuration duration of boundary container in seconds
                 * @property {number} selectionData.selectionStart start point of selection zone, relative to boundary start, in seconds
                 * @property {number} selectionData.audioStart start point of selection audio region, relative to the audio itself, in seconds
                 * @property {number} selectionData.audioEnd end point of selection audio region, relative to the audio itself, in seconds
                 *
                 * @returns {selectionData} return object
                 */
                getSelectionData() {
                    return this.selection._getSelectionData();
                },

                /**
                 * updateSelectionData
                 *
                 * @param {object} args args
                 * @param {?number} args.boundaryDuration duration of boundary container in seconds
                 * @param {?number} args.selectionStart start point of selection zone, relative to boundary start, in seconds
                 * @param {?number} args.audioStart start point of selection audio region, relative to the audio itself, in seconds
                 * @param {?number} args.audioEnd end point of selection audio region, relative to the audio itself, in seconds
                 */
                updateSelectionData(args) {
                    this.selection._updateSelectionData(args);
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
            },
            msRound: num => {
                return Math.round(num * 1000) / 1000;
            }
        };
        this.maxSelections = 1;
        this.selectionsMinLength = params.selectionsMinLength || null;

        this.wavesurfer.params.hideBarEnds = params.hideBarEnds || 1;
        this.regionGap = params.regionGap || 0;

        this.boundary = {
            offset : this.params.boundaryOffset || 0,
            duration : this.params.boundaryDuration
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

    _updateBoundary({
        offset,
        duration
    }) {
        this.boundary.offset = offset !== undefined ? this.util.msRound(offset) : this.boundary.offset;
        this.boundary.duration = duration !== undefined ? this.util.msRound(duration) : this.boundary.duration;
    }

    _getSelectionData() {
        if (!this.region || !this.boundary) {return {}; }

        const { duration, offset} = this.boundary;
        const {start, end} = this.region;

        return {
            boundaryDuration : duration,
            selectionStart : this.util.msRound(start - offset),
            audioStart : start,
            audioEnd : end
        };

    }

    _updateSelectionData({
        boundaryDuration,
        selectionStart,
        audioStart,
        audioEnd
    }) {
        const duration = boundaryDuration || this.boundary.duration;
        let offset;
        if (selectionStart !== undefined) {
            offset = (audioStart !== undefined ? audioStart : this.region?.start || 0) - selectionStart;
        }
        this._updateBoundary({ offset, duration });

        if (this.region && (audioStart !== undefined || audioEnd !== undefined)) {
            const start = audioStart !== undefined ? this.util.msRound(audioStart) : undefined;
            const end = audioEnd !== undefined ? this.util.msRound(audioEnd) : undefined;

            this.region.update({
                start,
                end
            });
        }
    }

    _getBoundaryTime() {
        const { selectionStart, audioStart} = this._getSelectionData();
        const audioTime = this.wavesurfer.getCurrentTime();
        if (selectionStart === undefined || audioStart === undefined) {
            return audioTime;
        }
        return audioTime - audioStart + selectionStart;
    }

    getVisualRange({start, end}) {
        return {
            start: this.util.msRound(start - this.boundary.offset),
            end: this.util.msRound(end - this.boundary.offset)
        };
    }

    updateCanvasSelection(selection) {
        if (this.wavesurfer.drawer instanceof SelectiveCanvas) {
            const {start, end} = selection;

            const fitSelf = !(this.dragThruZones && selection.isDragging);

            if (this._updateSelectionZones({self: this.getVisualRange({ start, end })}, fitSelf)) {
                this.wavesurfer.drawer.updateSelection(selection);
                this.wavesurfer.drawer.updateBoundaryState({
                    boundaryOffset    : this.boundary.offset,
                    boundaryDuration : this.boundary.duration
                });
                this.wavesurfer.drawBuffer();
            }
        }
    }

    _updateSelectionZones(selectionZones, fitSelf = true, force = false) {
        let {self, ...zones} = force ? {} : this.selectionZones;
        Object.entries(selectionZones).forEach(([key, val]) => {
            if (key === 'self' || key === this.id) {
                self = val;
            } else {
                zones[key] = val;
            }
        });
        this.selectionZones = {...zones};
        if (self && fitSelf) {
            const {start, end} = this.getFirstFreeZone(zones, self.start, self.end);
            if (start !== self.start || end !== self.end) {
                this._updateSelectionData({
                    selectionStart: start,
                    audioEnd: this.region.start + end - start
                });
                return false;
            }
        }
        this.selectionZones.self = self;
        return true;
    }

    // return all zones
    _getSelectionZones() {
        const {self, ...zones} = this.selectionZones;
        return {
            ...zones,
            [this.id] : self
        };
    }

    // given an object of existing zones, returns an ordered array of available zones
    getFreeZones(zones) {
        if (!this.region) {return [];}
        const minGap = this.region.minDisplayLength;
        // sorted list of zones
        let usedZones = Object.values(zones).filter((v) => (v)).sort((a, b) => (a.start - b.start) );
        // add contructed 'end' zone
        usedZones.push({start: this.boundary.duration});

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
    getFirstFreeZone(zones, targetStart = 0, targetEnd = this.boundary.duration) {
        const freeZones = this.getFreeZones(zones);
        let start = targetStart;
        let end = targetEnd;
        const duration = end - start;

        for (const zone of freeZones) {
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

    _getBoundary() {
        return this.boundary;
    }

    getDeadZones() {
        let {self, ...deadZones} = this.selectionZones;
        return deadZones;
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
        let overlapZones = {};
        for (let i = 0; i < zoneIds.length; i += 1){
            const id = zoneIds[i];
            if (
                // selection overlaps the right side of a zone
                (zones[id].start < start && zones[id].end >= start) ||
                // selection overlaps the left side of a zone
                (zones[id].start <= end && zones[id].end > end) ||
                // zone is entirely within selection (not start or end zone)
                (zones[id].start >= start && zones[id].end <= end) ||
                // zone exactly equals the selection
                (zones[id].start === start && zones[id].end === end)
            ) {
                overlapZones[id] = {...zones[id]};
            }
        }
        if (Object.keys(overlapZones).length === 0) {
            return null;
        }
        return overlapZones;
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

        const {
            selectionStart,
            start,
            end
        } = params;

        // Take formatTimeCallback from plugin params if not already set
        if (!params.formatTimeCallback && this.params.formatTimeCallback) {
            params = {...params, formatTimeCallback: this.params.formatTimeCallback};
        }

        if (!params.minLength && this.selectionsMinLength) {
            params = {...params, minLength: this.selectionsMinLength};
        }

        this.clear();
        this._updateSelectionData({
            selectionStart,
            audioStart : start
        });
        this._updateSelectionZones({
            self: this.getVisualRange({ start, end })
        });

        const selection = new this.wavesurfer.Selection(params, this.util, this.wavesurfer);

        selection.elementRef = selection.element.parentElement.lastChild;

        // replace region with new selection area
        this.region = selection;

        this.wavesurfer.on('region-updated', (regionData) => {

            this.updateCanvasSelection(regionData);
        });

        selection.on('remove', () => {
            this.region = null;
        });

        this.updateCanvasSelection(selection);
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
        this.wrapper.addEventListener('touchstart', eventDown, {passive: true});
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
