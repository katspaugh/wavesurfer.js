'use strict';

WaveSurfer.Drawer = {
    init: function (params) {
        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) :
            params.container;

        if (!this.container) {
            throw new Error('wavesurfer.js: container element not found');
        }

        this.params = params;
        this.pixelRatio = this.params.pixelRatio;
        this.loopSelection = this.params.loopSelection;

        this.width = 0;
        this.height = params.height * this.pixelRatio;
        this.containerWidth = this.container.clientWidth;

        this.lastPos = 0;

        this.createWrapper();
        this.createElements();
    },

    createWrapper: function () {
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
                overflowX: this.params.scrollParent ? 'scroll' : 'hidden',
                overflowY: 'hidden'
            });
        }

        this.setupWrapperEvents();
    },

    setupWrapperEvents: function () {
        var my = this;

        var eventNames = [
            'mousedown', 'mouseup', 'mouseout', 'mousemove', 'dblclick'
        ];

        eventNames.forEach(function (eventName) {
            my.wrapper.addEventListener(eventName, function (e) {
                e.preventDefault();
                var relX = 'offsetX' in e ? e.offsetX : e.layerX;
                my.fireEvent(eventName, (relX / my.scrollWidth) || 0);
            });
        });
    },

    drawPeaks: function (peaks, length) {
        this.resetScroll();
        this.setWidth(length);
        if (this.params.normalize) {
            var max = WaveSurfer.util.max(peaks);
        } else {
            max = 1;
        }
        this.drawWave(peaks, max);
    },

    style: function (el, styles) {
        Object.keys(styles).forEach(function (prop) {
            el.style[prop] = styles[prop];
        });
    },

    resetScroll: function () {
        this.wrapper.scrollLeft = 0;
    },

    recenter: function (percent) {
        var position = this.containerWidth * percent;
        this.recenterOnPosition(position, true);
    },

    recenterOnPosition: function (position, immediate) {
        var scrollLeft = this.wrapper.scrollLeft;
        var half = ~~(this.containerWidth / 2);
        var target = position - half;
        var offset = target - scrollLeft;

        // if the cursor is currently visible...
        if (!immediate && offset >= -half && offset < half) {
            // we'll limit the "re-center" rate.
            var rate = 5;
            offset = Math.max(-rate, Math.min(rate, offset));
            target = scrollLeft + offset;
        }

        if (offset != 0) {
            this.wrapper.scrollLeft = target;
        }
    },

    getWidth: function () {
        return Math.round(this.containerWidth * this.pixelRatio);
    },

    setWidth: function (width) {
        if (width == this.width) { return; }

        this.width = width;
        this.scrollWidth = ~~(this.width / this.pixelRatio);
        this.containerWidth = this.container.clientWidth;

        if (!this.params.fillParent && !this.params.scrollParent) {
            this.style(this.wrapper, {
                width: this.scrollWidth + 'px'
            });
        }

        this.updateWidth();
    },

    progress: function (progress) {
        var minPxDelta = 1 / this.pixelRatio;
        var pos = Math.round(progress * this.width) * minPxDelta;

        if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
            this.lastPos = pos;

            if (this.params.scrollParent) {
                var newPos = ~~(this.scrollWidth * progress);
                if (this.loopSelection && this.startPercent) {
                    if (this.startPercent <= progress && progress <= this.endPercent) {
                        var median = this.startPercent + (this.endPercent - this.startPercent) / 2;
                        newPos = ~~(this.scrollWidth * median);
                    }
                }
                this.recenterOnPosition(newPos);
            }

            this.updateProgress(progress);
        }
    },

    destroy: function () {
        this.unAll();
        this.container.removeChild(this.wrapper);
        this.wrapper = null;
    },

    updateSelection: function (startPercent, endPercent) {
        this.startPercent = startPercent;
        this.endPercent = endPercent;

        this.drawSelection();
    },

    clearSelection: function () {
        this.startPercent = null;
        this.endPercent = null;

        this.eraseSelection();
    },

    /* Renderer-specific methods */
    createElements: function () {},

    updateWidth: function () {},

    drawWave: function (peaks, max) {},

    clearWave: function () {},

    updateProgress: function (position) {},

    addMark: function (mark) {},

    removeMark: function (mark) {},

    redrawSelection: function () {},

    eraseSelection: function () {}

};

WaveSurfer.util.extend(WaveSurfer.Drawer, WaveSurfer.Observer);
