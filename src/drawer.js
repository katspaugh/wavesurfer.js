'use strict';

WaveSurfer.Drawer = {
    defaultParams: {
        waveColor     : '#999',
        progressColor : '#333',
        cursorColor   : '#ddd',
        markerColor   : '#eee',
        loadingColor  : '#999',
        cursorWidth   : 1,
        loadPercent   : false,
        markerWidth   : 1,
        container     : null
    },

    scale: window.devicePixelRatio,

    init: function (params) {
        this.params = WaveSurfer.util.extend({}, this.defaultParams, params);

        this.container = this.params.container;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        this.createSvg();
    },

    createNode: function (name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    },

    createSvg: function () {
        this.svg = this.createNode('svg');
        this.container.appendChild(this.svg);
    },


    /* API */
    drawPeaks: function (peaks, max) {
        var len = peaks.length;
        var height = this.height;

        for (var i = 0; i < len; i++) {
            var h = Math.round(peaks[i] * (height / max));
            var y = Math.round((height - h) / 2);

            var rect = this.createNode('rect');
            rect.setAttribute('fill', this.params.waveColor);
            rect.setAttribute('width', 1);
            rect.setAttribute('height', h);
            rect.setAttribute('x', i);
            rect.setAttribute('y', y);
            this.svg.appendChild(rect);
        }

        this.rects = this.svg.getElementsByTagName('rect');
    },

    progress: function (progress) {
        var pos = [
            Math.round(this.width * this.lastProgress || 0),
            Math.round(this.width * progress)
        ];

        if (pos[0] > pos[1]) {
            pos.reverse();
            var color = this.params.waveColor;
        } else {
            color = this.params.progressColor;
        }

        for (var i = pos[0], end = pos[1]; i < end; i++) {
            this.rects[i].setAttribute('fill', color);
        }

        this.lastProgress = progress;
    },

    loading: function (progress) {
    },

    addMark: function (mark) {
    },

    removeMark: function (mark) {
    }
};
