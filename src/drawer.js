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

    node: function (name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    },

    getId: function () {
        return 'wavesurfer_' + Math.random().toString(32).substring(2);
    },

    createSvg: function () {
        this.svg = this.node('svg');

        var defs = this.node('defs');

        var mask = this.node('mask');
        var maskId = this.getId();
        mask.setAttribute('id', maskId);
        mask.setAttribute('width', this.width);
        mask.setAttribute('height', this.height);

        var path = this.node('path');
        path.setAttribute('stroke-width', 1);
        path.setAttribute('stroke', 'white');
        mask.appendChild(path);
        defs.appendChild(mask);

        var waveRect = this.node('rect');
        waveRect.setAttribute('mask', 'url(#' + maskId + ')');
        waveRect.setAttribute('width', this.width);
        waveRect.setAttribute('height', this.height);
        waveRect.setAttribute('fill', this.params.waveColor);
        waveRect.setAttribute('class', 'wavesurfer-wave');

        var progressRect = this.node('rect');
        progressRect.setAttribute('mask', 'url(#' + maskId + ')');
        progressRect.setAttribute('width', 0);
        progressRect.setAttribute('height', this.height);
        progressRect.setAttribute('fill', this.params.progressColor);
        waveRect.setAttribute('class', 'wavesurfer-progress');

        this.svg.appendChild(defs);
        this.svg.appendChild(waveRect);
        this.svg.appendChild(progressRect);

        this.container.appendChild(this.svg);

        this.wavePath = path;
        this.progressRect = progressRect;
    },


    /* API */
    drawPeaks: function (peaks, max) {
        var len = peaks.length;
        var height = this.height;
        var path = [];

        for (var i = 0; i < len; i++) {
            var h = Math.round(peaks[i] * (height / max));
            var x = i;
            var y = Math.round((height - h) / 2);
            path.push('M ' + x + ' ' + y);
            path.push('l 0 ' + h);
        }

        this.wavePath.setAttribute('d', path.join(' '));
    },

    progress: function (progress) {
        var pos = Math.round(progress * this.width);
        if (pos != this.lastPos) {
            this.progressRect.setAttribute('width', pos);
            this.lastPos = pos;
        }
    },

    loading: function (progress) {
    },

    addMark: function (mark) {
    },

    removeMark: function (mark) {
    }
};
