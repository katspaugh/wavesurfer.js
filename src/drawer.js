'use strict';

WaveSurfer.Drawer = {
    init: function (params) {
        this.params = params;

        this.pixelRatio = this.params.pixelRatio;
        this.container = this.params.container;
        this.width = this.container.clientWidth * this.pixelRatio;
        this.height = this.container.clientHeight * this.pixelRatio;

        this.lastPos = 0;

        this.createElements();
        this.bindClick();
    },

    bindClick: function () {
        var my = this;
        this.container.addEventListener('click', function (e) {
            var relX = e.offsetX;
            if (null == relX) { relX = e.layerX; }
            var progress = relX / my.container.scrollWidth;

            my.fireEvent('click', progress);
        }, false);
    },

    addScroll: function () {
        this.container.style.overflowX = 'scroll';
        this.container.style.overflowY = 'hidden';
        this.scrollWidth = Math.round(this.width / this.pixelRatio);
    },

    recenter: function (percent) {
        var position = this.scrollWidth * percent;
        this.recenterOnPosition(position, true);
    },

    recenterOnPosition: function (position, immediate) {
        var scrollLeft = this.container.scrollLeft;
        var half = this.container.clientWidth / 2;
        var target = position - half;
        var offset = target - scrollLeft;

        // if the cursor is currently visible...
        if (!immediate && offset >= -half && offset < half) {
            // we'll limit the "re-center" rate.
            var rate = 5;
            offset = Math.max(-rate, Math.min(rate, offset));
            target = scrollLeft + offset;
        }

        if (offset > 0) {
            this.container.scrollLeft = target;
        }
    },

    getPixels: function (duration) {
        var width = Math.ceil(duration * this.params.minPxPerSec);
        if (this.params.fillParent) {
            width = Math.max(this.container.clientWidth, width);
        }
        return width * this.pixelRatio;
    },

    getWidth: function () {
        return this.width;
    },

    setWidth: function (width) {
        this.width = width;

        if (this.params.scrollParent) {
            this.addScroll();
        }

        this.updateWidth();
    },

    progress: function (progress) {
        var minPxDelta = 1 / this.pixelRatio;
        var pos = Math.round(
            progress * this.width * this.pixelRatio
        ) * minPxDelta;

        if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
            this.lastPos = pos;

            if (this.params.scrollParent) {
                this.recenterOnPosition(~~(this.scrollWidth * progress));
            }

            this.updateProgress(pos);
        }
    },

    /* Renderer-specific methods */
    createElements: function () {},

    updateWidth: function () {},

    drawPeaks: function (peaks, max) {},

    updateProgress: function (position) {},

    addMark: function (mark) {},

    removeMark: function (mark) {}
};

WaveSurfer.util.extend(WaveSurfer.Drawer, Observer);