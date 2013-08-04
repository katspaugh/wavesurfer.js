'use strict';

WaveSurfer.Drawer.Canvas = WaveSurfer.util.extend({}, WaveSurfer.Drawer, {
    style: function (el, styles) {
        Object.keys(styles).forEach(function (prop) {
            el.style[prop] = styles[prop];
        });
    },

    createCanvas: function () {
        var canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.canvases.push(canvas);
        return canvas;
    },

    createElements: function () {
        this.canvases = [];

        var waveCanvas = this.createCanvas();
        this.style(waveCanvas, {
            position: 'absolute',
            zIndex: 1
        });
        var waveCc = waveCanvas.getContext('2d');

        var progressWave = document.createElement('wave');
        this.style(progressWave, {
            position: 'absolute',
            zIndex: 2,
            overflow: 'hidden',
            width: '0',
            borderRight: [
                this.params.cursorWidth + 'px',
                'solid',
                this.params.cursorColor
            ].join(' ')
        });

        var progressCanvas = this.createCanvas();
        var progressCc = progressCanvas.getContext('2d');
        progressWave.appendChild(progressCanvas);

        var marksCanvas = this.createCanvas();
        this.style(marksCanvas, {
            position: 'absolute',
            zIndex: 3
        });
        var marksCc = marksCanvas.getContext('2d');

        var wrapper = document.createElement('wave');
        this.style(wrapper, {
            position: 'relative'
        });
        wrapper.appendChild(waveCanvas);
        wrapper.appendChild(progressWave);
        wrapper.appendChild(marksCanvas);

        this.container.appendChild(wrapper);

        this.waveCc = waveCc;
        this.progressCc = progressCc;
        this.progressWave = progressWave;
        this.marksCc = marksCc;
    },

    updateWidth: function () {
        this.canvases.forEach(function (el) {
            el.width = this.width;
        }, this);
    },

    drawPeaks: function (peaks, max) {
        this.setWidth(peaks.length);

        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * (this.height / max));
            var y = Math.round((this.height - h) / 2);
            this.waveCc.fillStyle = this.params.waveColor;
            this.waveCc.fillRect(i, y, 1, h);
            this.progressCc.fillStyle = this.params.progressColor;
            this.progressCc.fillRect(i, y, 1, h);
        }
    },

    updateProgress: function (position) {
        this.progressWave.style.width = position + 'px';
    },

    addMark: function (mark) {
        this.marksCc.fillStyle = mark.color;
        var x = Math.round(mark.percentage * this.width);
        this.marksCc.fillRect(x, 0, mark.width, this.height);
    },

    removeMark: function (mark) {
        var x = Math.round(mark.percentage * this.width);
        this.marksCc.clearRect(x, 0, mark.width, this.height);
    }
});