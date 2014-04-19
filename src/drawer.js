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

        this.width = 0;
        this.height = params.height * this.pixelRatio;
        this.containerWidth = this.container.clientWidth;
        this.interact = this.params.interact;

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

        var handleEvent = function (e) {
            e.preventDefault();
            var bbox = my.wrapper.getBoundingClientRect();
            return ((e.clientX - bbox.left + my.wrapper.scrollLeft) / my.scrollWidth) || 0;
        };

        this.wrapper.addEventListener('mousedown', function (e) {
            if (my.interact) {
                my.fireEvent('mousedown', handleEvent(e));
            }
        });

        this.params.dragSelection && (function () {
            var drag = {};

            var onMouseUp = function () {
                drag.startPercentage = drag.endPercentage = null;
            };
            document.addEventListener('mouseup', onMouseUp);
            my.on('destroy', function () {
                document.removeEventListener('mouseup', onMouseUp);
            });

            my.wrapper.addEventListener('mousedown', function (e) {
                e.stopPropagation();
                drag.startPercentage = handleEvent(e);
            });

            my.wrapper.addEventListener('mousemove', function (e) {
                e.stopPropagation();
                if (drag.startPercentage != null) {
                    drag.endPercentage = handleEvent(e);
                    my.fireEvent('drag', drag);
                }
            });

            my.wrapper.addEventListener('dblclick', function () {
                my.fireEvent('drag-clear', drag);
            });
        }());
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
            if (el.style[prop] != styles[prop]) {
                el.style[prop] = styles[prop];
            }
        });
        return el;
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

    updateMark: function (mark) {},

    drawSelection: function () {},

    eraseSelection: function () {}
};

WaveSurfer.util.extend(WaveSurfer.Drawer, WaveSurfer.Observer);
