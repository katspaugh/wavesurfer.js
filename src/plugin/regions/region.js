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
        // reflect resize and drag state of region for region-updated listener
        this.isResizing = false;
        this.isDragging = false;
        this.loop = Boolean(params.loop);
        this.color = params.color || 'rgba(0, 0, 0, 0.1)';
        // The left and right handleStyle properties can be set to 'none' for
        // no styling or can be assigned an object containing CSS properties.
        this.handleStyle = params.handleStyle || {
            left: {},
            right: {}
        };
        this.data = params.data || {};
        this.attributes = params.attributes || {};

        this.maxLength = params.maxLength;
        this.minLength = params.minLength;
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
        this.regionHeight = '100%';
        this.marginTop = '0px';

        if (channelIdx !== -1) {
            let channelCount =
                this.wavesurfer.backend.buffer != null
                    ? this.wavesurfer.backend.buffer.numberOfChannels
                    : -1;
            if (channelCount >= 0 && channelIdx < channelCount) {
                this.regionHeight = Math.floor((1 / channelCount) * 100) + '%';
                this.marginTop = this.wavesurfer.getHeight() * channelIdx + 'px';
            }
        }
        
        this.formatTimeCallback = params.formatTimeCallback;

        this.bindInOut();
        this.render();
        this.wavesurfer.on('zoom', this._onRedraw);
        this.wavesurfer.on('redraw', this._onRedraw);
        this.wavesurfer.fireEvent('region-created', this);
    }

    /* Update region params. */
    update(params) {
        if (params.start != null) {
            this.start = Number(params.start);
        }
        if (params.end != null) {
            this.end = Number(params.end);
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
        if (params.data != null) {
            this.data = params.data;
        }
        if (params.resize != null) {
            this.resize = Boolean(params.resize);
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
        const s = start || this.start;
        this.wavesurfer.play(s);
        this.once('out', () => {
            const realTime = this.wavesurfer.getCurrentTime();
            if (realTime >= this.start && realTime <= this.end) {
                return this.playLoop();
            }
        });
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

        this.style(regionEl, {
            position: 'absolute',
            zIndex: 2,
            height: this.regionHeight,
            top: this.marginTop
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

            // Default CSS properties for both handles.
            const css = {
                cursor: 'col-resize',
                position: 'absolute',
                top: '0px',
                width: '1%',
                maxWidth: '4px',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 1)'
            };

            // Merge CSS properties per handle.
            const handleLeftCss =
                this.handleStyle.left !== 'none'
                    ? Object.assign({ left: '0px' }, css, this.handleStyle.left)
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
                this.style(handleLeft, handleLeftCss);
            }

            if (handleRightCss) {
                this.style(handleRight, handleRightCss);
            }
        }

        this.element = this.wrapper.appendChild(regionEl);
        this.updateRender();
        this.bindEvents(regionEl);
    }

    formatTime(start, end) {
        if (this.formatTimeCallback) {
            return this.formatTimeCallback(start, end);
        }
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
                this.wavesurfer.play(this.start);
            }
        });
    }

    /* Bind DOM events. */
    bindEvents() {
        const preventContextMenu = this.preventContextMenu;

        this.element.addEventListener('mouseenter', e => {
            this.fireEvent('mouseenter', e);
            this.wavesurfer.fireEvent('region-mouseenter', this, e);
        });

        this.element.addEventListener('mouseleave', e => {
            this.fireEvent('mouseleave', e);
            this.wavesurfer.fireEvent('region-mouseleave', this, e);
        });

        this.element.addEventListener('click', e => {
            e.stopPropagation();
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

        this.element.addEventListener('contextmenu', e => {
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
            const time = this.regionsUtil.getRegionSnapToGridValue(
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
            touchId = e.targetTouches ? e.targetTouches[0].identifier : null;

            // stop the event propagation, if this region is resizable or draggable
            // and the event is therefore handled here.
            if (this.drag || this.resize) {
                e.stopPropagation();
            }

            // Store the selected startTime we begun dragging or resizing
            startTime = this.regionsUtil.getRegionSnapToGridValue(
                this.wavesurfer.drawer.handleEvent(e, true) * duration
            );

            // Store for scroll calculations
            maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;
            wrapperRect = this.wrapper.getBoundingClientRect();

            this.isResizing = false;
            this.isDragging = false;
            if (e.target.tagName.toLowerCase() === 'handle') {
                this.isResizing = true;
                resize = e.target.classList.contains('wavesurfer-handle-start')
                    ? 'start'
                    : 'end';
            } else {
                this.isDragging = true;
                drag = true;
                resize = false;
            }
        };
        const onUp = e => {
            if (e.touches && e.touches.length > 1) {
                return;
            }

            if (drag || resize) {
                this.isDragging = false;
                this.isResizing = false;
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
            if (e.targetTouches && e.targetTouches[0].identifier != touchId) {
                return;
            }
            if (!drag && !resize) {
                return;
            }

            const oldTime = startTime;
            const time = this.regionsUtil.getRegionSnapToGridValue(
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
                        (scrollDirection === -1 && x > scrollThreshold) ||
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
                    } else if (x >= wrapperRect.right - scrollThreshold) {
                        scrollDirection = 1;
                    } else {
                        scrollDirection = null;
                    }
                }

                if (scrollDirection) {
                    edgeScroll(e);
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
        if (direction === 'start') {
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
