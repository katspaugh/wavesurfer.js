/* eslint-disable no-console */
/**
 *  @since 4.0.0
 *
 * (Single) Region plugin class
 *
 * Must be turned into an observer before instantiating. This is done in
 * `RegionsPlugin` (main plugin class).
 *
 * @extends {Observer}
 */
export class Region {
    constructor(params, regionsUtils, ws) {
        this.wavesurfer = ws;
        this.wrapper = ws.drawer.wrapper;
        this.util = ws.util;
        this.style = this.util.style;
        this.regionsUtil = regionsUtils;
        this.vertical = ws.drawer.params.vertical;

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
        // stop event propagation in this region
        this.stopPropagationHere = params.stopPropagationHere === undefined ? true : Boolean(params.stopPropagationHere);
        // reflect resize and drag state of region for region-updated listener
        this.isResizing = false;
        this.isDragging = false;
        this.loop = Boolean(params.loop);
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
        // favor using css background-color to set the region color, ignoring the color param
        this.cssColor = params.cssColor || false;
        // The left and right handleStyle properties can be set to 'none' for
        // no styling or can be assigned an object containing CSS properties.
        this.handleStyle = params.handleStyle || {
            left: {},
            right: {}
        };
        this.regionStyle = params.regionStyle || {};
        this.decoratorStyle = params.decoratorStyle;
        this.handleLeftEl = null;
        this.handleRightEl = null;
        this.decoratorEl = null;
        this.data = params.data || {};
        this.attributes = params.attributes || {};
        this.showTooltip = params.showTooltip ?? true;

        this.maxLength = params.maxLength;

        // It assumes the minLength parameter value, or the selectionsMinLength parameter value, if the first one not provided
        this.minLength = params.minLength;
        // minDisplayLength is an second optional minimum length which only affects rendering
        this.minDisplayLength = params.minDisplayLength;

        // if we're not given either of these values, default to the other
        if (!this.minLength) {
            this.minLength = this.this.minDisplayLength;
        }
        if (!this.minDisplayLength) {
            this.minDisplayLength = this.this.minLength;
        }

        this._onRedraw = () => this.updateRender();

        this.scroll = params.scroll !== false && ws.params.scrollParent;
        this.scrollSpeed = params.scrollSpeed || 1;
        this.scrollThreshold = params.scrollThreshold || 10;
        // Determines whether the context menu is prevented from being opened.
        this.preventContextMenu =
            params.preventContextMenu === undefined
                ? false
                : Boolean(params.preventContextMenu);

        // select channel ID to set region
        let channelIdx =
            params.channelIdx == null ? -1 : parseInt(params.channelIdx);
        this.channelIdx = channelIdx;
        this.regionHeight = '100%';
        this.marginTop = '0px';

        if (channelIdx !== -1) {
            let channelCount =
                this.wavesurfer.backend.buffer != null
                    ? this.wavesurfer.backend.buffer.numberOfChannels
                    : -1;
            if (channelCount >= 0 && channelIdx < channelCount) {
                this.regionHeight = Math.floor((1 / channelCount) * 100) + '%';
                this.marginTop =
                    this.wavesurfer.getHeight() * channelIdx + 'px';
            }
        }

        this.formatTimeCallback = params.formatTimeCallback;
        this.edgeScrollWidth = params.edgeScrollWidth;
        this.bindInOut();
        this.render();
        this.wavesurfer.on('zoom', this._onRedraw);
        this.wavesurfer.on('redraw', this._onRedraw);
        this.wavesurfer.fireEvent('region-created', this);
    }

    /* Returns this, with added SelectionData */
    withSelectionData() {
        const selectionData = this.wavesurfer.getSelectionData();
        return {
            ...this,
            ...selectionData
        };
    }

    /* Update region params. */
    update(params, eventParams) {
        if (params.start != null) {
            this.start = this.wavesurfer.selection.util.msRound(Number(params.start));
        }
        if (params.end != null) {
            this.end = this.wavesurfer.selection.util.msRound(Number(params.end));
        }
        if (params.loop != null) {
            this.loop = Boolean(params.loop);
        }
        if (params.color != null) {
            this.color = params.color;
        }
        if (params.handleStyle != null) {
            this.handleStyle = params.handleStyle;
        }
        if (params.regionStyle != null) {
            this.regionStyle = params.regionStyle;
        }
        if (params.data != null) {
            this.data = params.data;
        }
        if (params.resize != null) {
            this.resize = Boolean(params.resize);
            this.updateHandlesResize(this.resize);
        }
        if (params.drag != null) {
            this.drag = Boolean(params.drag);
        }
        if (params.maxLength != null) {
            this.maxLength = Number(params.maxLength);
        }
        if (params.minLength != null) {
            this.minLength = Number(params.minLength);
        }
        if (params.attributes != null) {
            this.attributes = params.attributes;
        }

        this.updateRender();
        this.fireEvent('update');
        this.wavesurfer.fireEvent('region-updated', this.withSelectionData(), eventParams);
    }

    /* Remove a single region. */
    remove() {
        if (this.element) {
            this.wrapper.removeChild(this.element.domElement);
            this.element = null;
            this.fireEvent('remove');
            this.wavesurfer.un('zoom', this._onRedraw);
            this.wavesurfer.un('redraw', this._onRedraw);
            this.wavesurfer.fireEvent('region-removed', this);
        }
    }

    /**
     * Play the audio region.
     * @param {number} start Optional offset to start playing at
     */
    play(start) {
        const s = start || this.start;
        this.wavesurfer.play(s, this.end);
        this.fireEvent('play');
        this.wavesurfer.fireEvent('region-play', this);
    }

    /**
     * Play the audio region in a loop.
     * @param {number} start Optional offset to start playing at
     * */
    playLoop(start) {
        this.loop = true;
        this.play(start);
    }

    /**
     * Set looping on/off.
     * @param {boolean} loop True if should play in loop
     */
    setLoop(loop) {
        this.loop = loop;
    }

    /* Render a region as a DOM element. */
    render() {
        this.element = this.util.withOrientation(
            this.wrapper.appendChild(document.createElement('region')),
            this.vertical
        );

        this.element.className = 'wavesurfer-region';
        if (this.showTooltip) {
            this.element.title = this.formatTime(this.start, this.end);
        }
        this.element.setAttribute('data-id', this.id);

        for (const attrname in this.attributes) {
            this.element.setAttribute(
                'data-region-' + attrname,
                this.attributes[attrname]
            );
        }

        const defaultRegionCss = {
            position: 'absolute',
            height: this.regionHeight,
            top: this.marginTop
        };

        const regionCss =
            Object.assign(
                defaultRegionCss,
                this.regionStyle
            );

        if (regionCss) {
            this.style(this.element, regionCss);
        }


        /* Resize handles */
        if (this.resize) {
            this.handleLeftEl = this.util.withOrientation(
                this.element.appendChild(document.createElement('handle')),
                this.vertical
            );
            this.handleRightEl = this.util.withOrientation(
                this.element.appendChild(document.createElement('handle')),
                this.vertical
            );

            this.handleLeftEl.className = 'wavesurfer-handle wavesurfer-handle-start';
            this.handleRightEl.className = 'wavesurfer-handle wavesurfer-handle-end';

            // Default CSS properties for both handles.
            const css = {
                cursor: this.vertical ? 'row-resize' : 'col-resize',
                position: 'absolute',
                top: '0px',
                width: '2px',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 1)',
                'z-index': 5
            };

            // Merge CSS properties per handle.
            const handleLeftCss =
                this.handleStyle.left !== 'none'
                    ? Object.assign(
                        { left: '0px' },
                        css,
                        this.handleStyle.left
                    )
                    : null;
            const handleRightCss =
                this.handleStyle.right !== 'none'
                    ? Object.assign(
                        { right: '0px' },
                        css,
                        this.handleStyle.right
                    )
                    : null;

            if (handleLeftCss) {
                this.style(this.handleLeftEl, handleLeftCss);
            }

            if (handleRightCss) {
                this.style(this.handleRightEl, handleRightCss);
            }
        }

        // create overlay decorator if passed. Sits on top of everything else
        if (this.decoratorStyle !== undefined) {
            this.decoratorEl = this.element.appendChild(document.createElement('decorator'));
            this.decoratorEl.className = 'wavesurfer-selection-decorator';

            // Default CSS properties for decorator.
            const defaultDecoratorCss = {
                position: 'absolute',
                top: '0px',
                left: '0px',
                width: 'inherit',
                height: 'inherit',
                'pointer-events': 'none',
                'z-index': 6
            };

            // Merge defaultDecoratorCSS properties.
            const decoratorCss =
                Object.assign(
                    defaultDecoratorCss,
                    this.decoratorStyle
                );

            this.style(this.decoratorEl, decoratorCss);

        }

        this.updateRender();
        this.bindEvents();
    }

    formatTime(start, end) {
        if (this.formatTimeCallback) {
            return this.formatTimeCallback(start, end);
        }
        return (start == end ? [start] : [start, end])
            .map((time) =>
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
        // break out if we currently don't have a backend
        if (!this.wavesurfer.backend ) {return;}
        // duration varies during loading process, so don't overwrite important data
        const dur = this.wavesurfer.getDuration();
        const boundaryDuration = this.wavesurfer.getBoundary().duration;
        const width = this.getWidth();

        const drawerWidth = this.wavesurfer.drawer.getWidth();
        // if we cannot get drawerWidth, we shouldn't set minPxPerSec using it.
        if (drawerWidth !== 0) {
            const pxPerSec = drawerWidth / (boundaryDuration * this.wavesurfer.params.pixelRatio);
            this.wavesurfer.params.minPxPerSec = pxPerSec;
        }

        let startLimited = this.start - this.wavesurfer.getBoundary().offset;
        let endLimited = this.end - this.wavesurfer.getBoundary().offset;
        if (startLimited < 0) {
            startLimited = 0;
            endLimited = endLimited - startLimited;
        }
        if (endLimited > boundaryDuration) {
            endLimited = boundaryDuration;
            startLimited = boundaryDuration - (endLimited - startLimited);
        }

        if (this.minDisplayLength != null) {
            endLimited = Math.max(startLimited + this.minDisplayLength, endLimited);
            if (endLimited - startLimited < this.minLength) {
                this.attributes['small-bar'] = true;
            } else {
                this.attributes['small-bar'] = false;
            }
        }

        if (this.maxLength != null) {
            endLimited = Math.min(startLimited + this.maxLength, endLimited);
        }

        if (this.element != null) {
            // Calculate the left and width values of the region such that
            // no gaps appear between regions.
            const regionGapHalf = this.wavesurfer.selection.regionGap / 2;
            const left = Math.round((startLimited / dur) * width + regionGapHalf);
            const regionWidth = Math.round((endLimited / dur) * width - regionGapHalf) - left;

            this.style(this.element, {
                left: left + 'px',
                width: regionWidth + 'px',
                backgroundColor: this.cssColor ? undefined : this.color,
                cursor: this.drag ? 'move' : 'default'
            });

            for (const attrname in this.attributes) {
                this.element.setAttribute(
                    'data-region-' + attrname,
                    this.attributes[attrname]
                );
                if (this.attributes[attrname] === false) {
                    this.element.removeAttribute('data-region-' + attrname);
                }
            }

            if (this.showTooltip) {
                this.element.title = this.formatTime(this.start, this.end);
            }
        }
    }
    /* Bind audio events. */
    bindInOut() {
        this.firedIn = false;
        this.firedOut = false;

        const onProcess = (time) => {
            let start = Math.round(this.start * 10) / 10;
            let end = Math.round(this.end * 10) / 10;
            time = Math.round(time * 10) / 10;

            if (
                !this.firedOut &&
                this.firedIn &&
                (start > time || end <= time)
            ) {
                this.firedOut = true;
                this.firedIn = false;
                this.fireEvent('out');
                this.wavesurfer.fireEvent('region-out', this);
            }
            if (!this.firedIn && start <= time && end > time) {
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
                const realTime = this.wavesurfer.getCurrentTime();
                if (realTime >= this.start && realTime <= this.end) {
                    this.wavesurfer.play(this.start);
                }
            }
        });
    }

    /* Bind DOM events. */
    bindEvents() {
        const preventContextMenu = this.preventContextMenu;

        this.element.addEventListener('mouseenter', (e) => {
            this.fireEvent('mouseenter', e);
            this.wavesurfer.fireEvent('region-mouseenter', this, e);
        });

        this.element.addEventListener('mouseleave', (e) => {
            this.fireEvent('mouseleave', e);
            this.wavesurfer.fireEvent('region-mouseleave', this, e);
        });

        this.element.addEventListener('click', (e) => {
            e.preventDefault();
            this.fireEvent('click', e);
            this.wavesurfer.fireEvent('region-click', this, e);
        });

        this.element.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.fireEvent('dblclick', e);
            this.wavesurfer.fireEvent('region-dblclick', this, e);
        });

        this.element.addEventListener('contextmenu', (e) => {
            if (preventContextMenu) {
                e.preventDefault();
            }
            this.fireEvent('contextmenu', e);
            this.wavesurfer.fireEvent('region-contextmenu', this, e);
        });

        /* Drag or resize on mousemove. */
        if (this.drag || this.resize) {
            this.bindDragEvents();
        }
    }

    bindDragEvents() {
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
        let regionLeftHalfTime;
        let regionRightHalfTime;
        let startProportion;
        let startRange;
        let lastGoodRange;
        let zoneOverlap = null;
        const bufferPx = 1;
        const buffer = bufferPx / this.wavesurfer.params.minPxPerSec;

        const onDown = (event) => {
            const duration = this.wavesurfer.getBoundary().duration;
            if (event.touches && event.touches.length > 1) {
                return;
            }
            touchId = event.targetTouches ? event.targetTouches[0].identifier : null;

            // stop the event propagation, if this region is resizable or draggable
            // and the event is therefore handled here.
            if (this.stopPropagationHere && (this.drag || this.resize)) {
                event.stopPropagation();
            }

            startProportion = this.wavesurfer.drawer.handleEvent(event, true);
            // Store the selected startTime we begun dragging or resizing
            startTime = this.regionsUtil.getRegionSnapToGridValue(
                startProportion * duration
            );

            // Store for scroll calculations
            maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;

            wrapperRect = this.util.withOrientation(
                this.wrapper.getBoundingClientRect(),
                this.vertical
            );

            this.isResizing = false;
            this.isDragging = false;
            if (event.target.tagName.toLowerCase() === 'handle') {
                regionLeftHalfTime = (event.target.offsetLeft + event.offsetX) / this.wavesurfer.params.minPxPerSec;
                this.isResizing = true;
                resize = event.target.classList.contains('wavesurfer-handle-start')
                    ? 'start'
                    : 'end';
            } else if (event.target == event.currentTarget) {
                regionLeftHalfTime = event.offsetX / this.wavesurfer.params.minPxPerSec;
                this.isDragging = true;
                drag = true;
                resize = false;
            }
            if (drag || resize) {
                regionRightHalfTime = this.end - this.start - regionLeftHalfTime;
                this.wavesurfer.fireEvent('region-move-start', drag, event);
            }

            startRange = {start: startTime - regionLeftHalfTime + buffer, end : startTime + regionRightHalfTime - buffer};
            lastGoodRange = {...startRange};
        };
        const onUp = (event) => {
            if (event.touches && event.touches.length > 1) {
                return;
            }

            if (drag && updated
                && this.wavesurfer.selection.dragThruZones
                && lastGoodRange.start !== startRange.start
                && lastGoodRange.end !== startRange.end) {
                this.wavesurfer.updateBoundary({
                    offset :     this.start - lastGoodRange.start
                });
                this.update({});
                this.updateRender();

            }

            if (drag || resize) {
                setZoneOverlap(null);
                this.isDragging = false;
                this.isResizing = false;
                drag = false;
                scrollDirection = null;
                resize = false;
            }

            if (updated) {
                updated = false;
                this.util.preventClick();
                this.fireEvent('update-end', event);
                const rt = this.withSelectionData();
                this.wavesurfer.fireEvent('region-update-end', this.withSelectionData(), event);
            }

            if (this.element.isEqualNode(event.srcElement)) {
                const ws = this.wavesurfer;
                const isWebAudioBackend = ws.params.backend === 'WebAudio';
                const paused = ws.backend.isPaused();

                if (isWebAudioBackend && !paused) {
                    ws.backend.pause();
                }

                const startTime = this.start + regionLeftHalfTime;
                const progressProportion = startTime / ws.getDuration();

                ws.backend.seekTo(startTime);
                ws.drawer.progress(progressProportion);

                if (isWebAudioBackend && !paused) {
                    ws.backend.play(startTime, this.end);
                }

                ws.fireEvent('seek', progressProportion);
            }
            this.wavesurfer.fireEvent('region-move-end', event);
        };
        const setZoneOverlap = (zones) => {
            if (zones == null) {
                if ( zoneOverlap == null) {
                    return;
                }
                if (this.wavesurfer.selection.dragThruZones) {
                    this.wavesurfer.fireEvent('region-overlap-change', null);
                }
                zoneOverlap = null;
                return;
            }

            let updateFlag = false;
            let updateZones = {...zoneOverlap};

            Object.entries(zones).forEach(([id, zone]) => {
                if (!updateZones[id]) {
                    updateZones[id] = {...zone};
                    updateFlag = true;
                }
            });

            if (updateFlag) {
                if (this.wavesurfer.selection.dragThruZones) {
                    this.wavesurfer.fireEvent('region-overlap-change', updateZones);
                }
                zoneOverlap = updateZones;
            }
        };
        // given a list of zones, and a point, what is the value at the edge of the next zone
        // from the point, moving in the given direction?
        const nextZoneBoundary = (zones, point, direction) => {
            // based on direction, we either care about the start or end boundaries of the zones
            let boundaryKey;
            let sorter;
            let comparison;

            if (direction > 0) {
                boundaryKey = 'start';
                sorter = (a, b) => (a - b);
                comparison = (a, b) => (a < b);
            } else {
                boundaryKey = 'end';
                sorter = (a, b) => (b - a);
                comparison = (a, b) => (a > b);
            }
            let workingArray = Object.values(zones).map((zone) => zone[boundaryKey]);

            workingArray.sort(sorter);
            for (let i = 0; i < workingArray.length; i += 1) {
                if (comparison(point, workingArray[i])) {
                    return workingArray[i];
                }
            }
            return null;
        };
        const onMove = (event) => {
            const duration = this.wavesurfer.getBoundary().duration;
            let orientedEvent = this.util.withOrientation(event, this.vertical);

            if (event.touches && event.touches.length > 1) {
                return;
            }
            if (event.targetTouches && event.targetTouches[0].identifier != touchId) {
                return;
            }
            if (!drag && !resize) {
                return;
            }

            const timeProportion = this.wavesurfer.drawer.handleEvent(event, true);

            let time = this.regionsUtil.getRegionSnapToGridValue(
                timeProportion * duration
            );
            if (startTime === time) {
                return;
            }

            let newRange;

            if (drag) {

                // To maintain relative cursor start point while dragging
                const maxEnd = this.wavesurfer.getBoundary().duration;
                if (time > maxEnd - regionRightHalfTime) {
                    time = maxEnd - regionRightHalfTime;
                }

                const minStart = 0;
                if (time - regionLeftHalfTime < minStart) {
                    time = minStart + regionLeftHalfTime;
                }

                newRange = {
                    start: this.wavesurfer.selection.util.msRound(time - regionLeftHalfTime),
                    end : this.wavesurfer.selection.util.msRound(time + regionRightHalfTime)
                };
                const overlapZones = this.wavesurfer.getOverlapZone(newRange.start, newRange.end);
                setZoneOverlap( overlapZones);

                if (overlapZones) {
                    if (!this.wavesurfer.selection.dragThruZones) {
                        /*
                        * IF the region is larger than the wave (due to minimum region size) then it is possible for the
                        * startTime to be greater than the end value of the wave.
                        * Normalize this by adding regionRightHalfTime so that the point used to
                        * find nextZoneBoundary is always the right edge of the wave itself
                        */
                        const point = startTime + regionRightHalfTime;
                        const bumperValue = nextZoneBoundary({...zoneOverlap, ...overlapZones}, point, time - startTime); // the overlapzone that we're bumping up against
                        // we're dragging right
                        if (time > startTime) {
                            time = bumperValue !== null ? bumperValue - regionRightHalfTime - buffer : time;
                        } else {
                            time = bumperValue !== null ? bumperValue + regionLeftHalfTime + buffer : time;
                        }
                    }
                }
            }

            if (resize === 'start') {
                const tempDelta = time - startTime;
                // Avoid resizing off the start by allowing a buffer
                const minStart = 0.01 + regionLeftHalfTime;
                if (time <= minStart) {
                    time = minStart;

                }

                // Check if changing the start by the given delta would result in the region being smaller than minLength
                if (tempDelta > 0 && this.end - (this.start + tempDelta) < this.minLength) {
                    time = startRange.end - this.minLength + regionLeftHalfTime;

                }

                // Check if changing the start by the given tempDelta would result in the region being larger than maxLength
                if (tempDelta < 0 && this.end - (this.start + tempDelta) > this.maxLength) {
                    time = startRange.end - this.maxLength + regionLeftHalfTime;

                }

                // check if start would be less than 0
                if (tempDelta < 0 && (this.start + tempDelta) < 0) {
                    time = startRange.end - this.end + regionLeftHalfTime;
                }

                // Check if we're resizing into another zone
                newRange = {
                    ...startRange,
                    start: this.wavesurfer.selection.util.msRound(time - regionLeftHalfTime)
                };
                const overlapZones = this.wavesurfer.getOverlapZone(newRange.start, newRange.end);
                if (overlapZones) {
                    const bumperValue = nextZoneBoundary(overlapZones, startTime, -1); // the overlapzone that we're bumping up against
                    time = bumperValue + regionLeftHalfTime + buffer;
                }

            }

            if (resize === 'end') {
                const tempDelta = time - startTime;
                // Check if changing the end by the given tempDelta would result in the region being smaller than minLength
                if (tempDelta < 0 && this.end + tempDelta - this.start < this.minLength) {
                    time = startRange.start + this.minLength - regionRightHalfTime;
                }

                // Check if changing the end by the given tempDelta would result in the region being larger than maxLength
                if (tempDelta > 0 && this.end + tempDelta - this.start > this.maxLength) {
                    time = startRange.start + this.maxLength - regionRightHalfTime;
                }

                const audioDuration = this.wavesurfer.getDuration();
                if (tempDelta > 0 && (this.end + tempDelta) > audioDuration) {
                    time = startRange.start + audioDuration - this.start - regionRightHalfTime;
                }

                newRange = {
                    ...startRange,
                    end : this.wavesurfer.selection.util.msRound(time + regionRightHalfTime)
                };
                const overlapZones = this.wavesurfer.getOverlapZone(newRange.start, newRange.end);
                if (overlapZones) {
                    const bumperValue = nextZoneBoundary(overlapZones, startTime, 1); // the overlapzone that we're bumping up against
                    time = bumperValue - regionRightHalfTime + buffer;
                }
            }


            let delta = time - startTime;
            startTime = time;

            // Drag
            if (this.drag && drag) {
                updated = updated || !!delta;
                this.onDrag(delta);
                Object.entries(startRange).forEach(([k, v]) => ( startRange[k] = v + delta ));
                if (!zoneOverlap && delta) {
                    lastGoodRange = {...startRange};
                }
            }

            // Resize
            if (this.resize && resize) {
                updated = updated || !!delta;
                this.onResize(delta, resize);
            }
        };

        this.element.addEventListener('mousedown', onDown);
        this.element.addEventListener('touchstart', onDown, {passive: true});

        document.body.addEventListener('mousemove', onMove);
        document.body.addEventListener('touchmove', onMove, {passive: false});

        document.addEventListener('mouseup', onUp);
        document.body.addEventListener('touchend', onUp);

        this.on('remove', () => {
            document.removeEventListener('mouseup', onUp);
            document.body.removeEventListener('touchend', onUp);
            document.body.removeEventListener('mousemove', onMove);
            document.body.removeEventListener('touchmove', onMove);
        });

        this.wavesurfer.on('destroy', () => {
            document.removeEventListener('mouseup', onUp);
            document.body.removeEventListener('touchend', onUp);
        });
    }

    onDrag(delta) {
        const eventParams = {
            direction: this._getDragDirection(delta),
            action: 'drag'
        };

        this.wavesurfer.updateBoundary({
            offset :     this.wavesurfer.getBoundary().offset - delta
        });
        this.update({
            start: this.start,
            end: this.end
        }, eventParams);
    }

    /**
     * Returns the direction of dragging region based on delta
     * Negative delta means region is moving to the left
     * Positive - to the right
     * For zero delta the direction is not defined
     * @param {number} delta Drag offset
     * @returns {string|null} Direction 'left', 'right' or null
     */
    _getDragDirection(delta) {
        if (delta < 0) {
            return 'left';
        }
        if (delta > 0) {
            return 'right';
        }
        return null;
    }

    /**
     * @example
     * onResize(-5, 'start') // Moves the start point 5 seconds back
     * onResize(0.5, 'end') // Moves the end point 0.5 seconds forward
     *
     * @param {number} delta How much to add or subtract, given in seconds
     * @param {string} direction 'start 'or 'end'
     */
    onResize(delta, direction) {
        const audioDuration = this.wavesurfer.getDuration();
        const eventParams = {
            action: 'resize',
            direction: direction === 'start' ? 'left' : 'right'
        };

        if (direction === 'start') {
            // catch rounding errors that might let this go out of bounds
            if (delta < 0 && (this.start + delta) < 0) {
                delta = this.start * -1;
            }

            this.update({
                start: Math.min(this.start + delta, this.end),
                end: Math.max(this.start + delta, this.end)
            }, eventParams);
        } else {
            // catch rounding errors that might let this go out of bounds
            if (delta > 0 && (this.end + delta) > audioDuration) {
                delta = audioDuration - this.end;
            }

            this.update({
                start: Math.min(this.end + delta, this.start),
                end: Math.max(this.end + delta, this.start)
            }, eventParams);
        }
    }

    updateHandlesResize(resize) {
        let cursorStyle;
        if (resize) {
            cursorStyle = this.vertical ? 'row-resize' : 'col-resize';
        } else {
            cursorStyle = 'auto';
        }

        this.handleLeftEl && this.style(this.handleLeftEl, { cursor: cursorStyle });
        this.handleRightEl && this.style(this.handleRightEl, { cursor: cursorStyle });
    }
}
