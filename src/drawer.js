import * as util from './util';

export default class Drawer extends util.Observer {
    constructor(container, params) {
        super();
        this.container = container;
        this.params = params;

        this.width = 0;
        this.height = params.height * this.params.pixelRatio;

        this.lastPos = 0;
    }

    style(...params) {
        return util.style(...params);
    }

    createWrapper() {
        this.wrapper = this.container.appendChild(
            document.createElement('wave')
        );

        this.style(this.wrapper, {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
            webkitUserSelect: 'none',
            height: this.params.height + 'px'
        });

        if (this.params.fillParent || this.params.scrollParent) {
            this.style(this.wrapper, {
                width: '100%',
                overflowX: this.params.hideScrollbar ? 'hidden' : 'auto',
                overflowY: 'hidden'
            });
        }

        this.setupWrapperEvents();
    }

    handleEvent(e, noPrevent) {
        !noPrevent && e.preventDefault();

        const clientX = e.targetTouches ? e.targetTouches[0].clientX : e.clientX;
        const bbox = this.wrapper.getBoundingClientRect();

        const nominalWidth = this.width;
        const parentWidth = this.getWidth();

        let progress;

        if (!this.params.fillParent && nominalWidth < parentWidth) {
            progress = ((clientX - bbox.left) * this.params.pixelRatio / nominalWidth) || 0;

            if (progress > 1) {
                progress = 1;
            }
        } else {
            progress = ((clientX - bbox.left + this.wrapper.scrollLeft) / this.wrapper.scrollWidth) || 0;
        }

        return progress;
    }

    setupWrapperEvents() {
        this.wrapper.addEventListener('click', e => {
            const scrollbarHeight = this.wrapper.offsetHeight - this.wrapper.clientHeight;
            if (scrollbarHeight != 0) {
                // scrollbar is visible.  Check if click was on it
                const bbox = this.wrapper.getBoundingClientRect();
                if (e.clientY >= bbox.bottom - scrollbarHeight) {
                    // ignore mousedown as it was on the scrollbar
                    return;
                }
            }

            if (this.params.interact) {
                this.fireEvent('click', e, this.handleEvent(e));
            }
        });

        this.wrapper.addEventListener('scroll', e => this.fireEvent('scroll', e));
    }

    drawPeaks(peaks, length, start, end) {
        this.setWidth(length);

        this.params.barWidth ?
            this.drawBars(peaks, 0, start, end) :
            this.drawWave(peaks, 0, start, end);
    }

    resetScroll() {
        if (this.wrapper !== null) {
            this.wrapper.scrollLeft = 0;
        }
    }

    recenter(percent) {
        const position = this.wrapper.scrollWidth * percent;
        this.recenterOnPosition(position, true);
    }

    recenterOnPosition(position, immediate) {
        const scrollLeft = this.wrapper.scrollLeft;
        const half = ~~(this.wrapper.clientWidth / 2);
        const maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;
        let target = position - half;
        let offset = target - scrollLeft;

        if (maxScroll == 0) {
            // no need to continue if scrollbar is not there
            return;
        }

        // if the cursor is currently visible...
        if (!immediate && -half <= offset && offset < half) {
            // we'll limit the "re-center" rate.
            const rate = 5;
            offset = Math.max(-rate, Math.min(rate, offset));
            target = scrollLeft + offset;
        }

        // limit target to valid range (0 to maxScroll)
        target = Math.max(0, Math.min(maxScroll, target));
        // no use attempting to scroll if we're not moving
        if (target != scrollLeft) {
            this.wrapper.scrollLeft = target;
        }

    }

    getScrollX() {
        return Math.round(this.wrapper.scrollLeft * this.params.pixelRatio);
    }

    getWidth() {
        return Math.round(this.container.clientWidth * this.params.pixelRatio);
    }

    setWidth(width) {
        if (this.width == width) {
            return;
        }

        this.width = width;

        if (this.params.fillParent || this.params.scrollParent) {
            this.style(this.wrapper, {
                width: ''
            });
        } else {
            this.style(this.wrapper, {
                width: ~~(this.width / this.params.pixelRatio) + 'px'
            });
        }

        this.updateSize();
    }

    setHeight(height) {
        if (height == this.height) { return; }
        this.height = height;
        this.style(this.wrapper, {
            height: ~~(this.height / this.params.pixelRatio) + 'px'
        });
        this.updateSize();
    }

    progress(progress) {
        const minPxDelta = 1 / this.params.pixelRatio;
        const pos = Math.round(progress * this.width) * minPxDelta;

        if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
            this.lastPos = pos;

            if (this.params.scrollParent && this.params.autoCenter) {
                const newPos = ~~(this.wrapper.scrollWidth * progress);
                this.recenterOnPosition(newPos);
            }

            this.updateProgress(pos);
        }
    }

    destroy() {
        this.unAll();
        if (this.wrapper) {
            this.container.removeChild(this.wrapper);
            this.wrapper = null;
        }
    }

     /* Renderer-specific methods */
    createElements() {}

    updateSize() {}

    drawWave(peaks, max) {}

    clearWave() {}

    updateProgress(position) {}
}
