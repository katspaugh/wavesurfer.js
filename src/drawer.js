'use strict';

WaveSurfer.Drawer = {
    defaultParams: {
        waveColor     : '#999',
        progressColor : '#333',
        cursorColor   : '#ddd',
        loaderColor   : '#999',
        loaderHeight  : 2,
        cursorWidth   : 1,
        markerWidth   : 1,
        minPxPerSec   : 0,
        scrollParent  : false,
        container     : null
    },

    init: function (params) {
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.container = this.params.container;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.lastPos = 0;

        this.createSvg();
        this.bindClick();
    },

    attr: function (node, attrs) {
        Object.keys(attrs).forEach(function (key) {
            node.setAttribute(key, attrs[key]);
        });
    },

    node: function (name, attrs) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', name);
        attrs && this.attr(node, attrs);
        return node;
    },

    createSvg: function () {
        var svg = this.node('svg', {
            viewBox: [ 0, 0, this.width, this.height ].join(' ')
        });

        var defs = this.node('defs');

        // Wave path
        var pathId = WaveSurfer.util.getId();
        var path = this.node('path', {
            id: pathId
        });
        defs.appendChild(path);

        // Progress clip
        var clipId = WaveSurfer.util.getId();
        var clip = this.node('clipPath', {
            id: clipId
        });
        var clipRect = this.node('rect', {
            width: 0,
            height: this.height
        });
        clip.appendChild(clipRect);
        defs.appendChild(clip);

        var useWave = this.node('use', {
            stroke: this.params.waveColor,
            'class': 'wavesurfer-wave'
        });
        useWave.href.baseVal = '#' + pathId;

        var useClip = this.node('use', {
            stroke: this.params.progressColor,
            'clip-path': 'url(#' + clipId + ')',
            'class': 'wavesurfer-progress'
        });
        useClip.href.baseVal = '#' + pathId;

        var cursor = this.node('rect', {
            width: this.params.cursorWidth,
            height: this.height,
            fill: this.params.cursorColor,
            'class': 'wavesurfer-cursor'
        });

        // Loader
        var loader = this.node('line', {
            x1: 0,
            x2: 0,
            y1: this.height / 2 - this.params.loaderHeight / 2,
            y2: this.height / 2 + this.params.loaderHeight,
            'stroke-width': this.params.loaderHeight,
            stroke: this.params.loaderColor
        });

        [ defs, useWave, useClip, cursor, loader ].forEach(function (node) {
            svg.appendChild(node);
        });

        this.container.appendChild(svg);

        this.svg = svg;
        this.wavePath = path;
        this.progressPath = clipRect;
        this.cursor = cursor;
        this.loader = loader;
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
        this.attr(this.svg, {
            width: this.width,
            height: this.height
        });
    },

    recenter: function (percent) {
        var position = ~~(this.width * percent);
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

        this.container.scrollLeft = ~~target;
    },


    /* API */
    getPixels: function (duration) {
        var minPx = this.params.minPxPerSec;
        return Math.max(Math.ceil(duration * minPx), this.width);
    },

    getWidth: function () {
        return this.width;
    },

    setWidth: function (width) {
        this.width = width;
        this.attr(this.svg, {
            viewBox: [ 0, 0, this.width, this.height ].join(' ')
        });

        if (this.params.scrollParent) {
            this.addScroll();
        }

        return this.width;
    },

    drawPeaks: function (peaks, max) {
        this.setWidth(peaks.length);

        var height = this.height;
        var pathData = [];

        if (0 == max) {
            pathData.push('M', 0, Math.round(height / 2), 'l', this.width, 0);
        } else {
            var factor = height / max;
            for (var i = 0; i < this.width; i++) {
                var h = Math.round(peaks[i] * factor);
                var y = Math.round((height - h) / 2);
                pathData.push('M', i, y, 'l', 0, h);
            }
        }

        this.wavePath.setAttribute('d', pathData.join(' '));
        this.loader.style.display = 'none';
    },

    progress: function (progress) {
        var pos = progress * this.width;
        var minPxDelta = 0.5;

        if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
            this.lastPos = pos;

            this.progressPath.setAttribute('width', pos);

            this.cursor.setAttribute('x', Math.min(
                pos - ~~(this.params.cursorWidth / 2),
                this.width - this.params.cursorWidth
            ));

            if (this.params.scrollParent) {
                this.recenterOnPosition(pos);
            }
        }
    },

    loading: function (progress) {
        this.loader.setAttribute('x2', Math.round(progress * this.width));
        this.loader.style.display = 'block';
    },

    addMark: function (mark) {
        var markRect = document.getElementById(mark.id);
        if (!markRect) {
            markRect = this.node('rect');
            markRect.setAttribute('id', mark.id);
            this.svg.appendChild(markRect);
        }
        this.attr(markRect, {
            fill: mark.color,
            width: mark.width || 1,
            height: this.height,
            x: Math.round(mark.percentage * this.width)
        });
    },

    removeMark: function (mark) {
        var markRect = document.getElementById(mark.id);
        if (markRect) {
            this.svg.removeChild(markRect);
        }
    }
};

WaveSurfer.util.extend(WaveSurfer.Drawer, Observer);