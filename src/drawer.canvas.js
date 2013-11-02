'use strict';

WaveSurfer.Drawer.Canvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.Canvas, {
    createElements: function () {
        this.marks = {};

        var waveCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(waveCanvas, {
            position: 'absolute',
            zIndex: 1
        });

        var progressWave = this.wrapper.appendChild(
            document.createElement('wave')
        );
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

        var progressCanvas = progressWave.appendChild(
            document.createElement('canvas')
        );

        var marksCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(marksCanvas, {
            position: 'absolute',
            zIndex: 3
        });

        this.canvases = [ waveCanvas, progressCanvas, marksCanvas ];

        this.waveCc = waveCanvas.getContext('2d');
        this.progressCc = progressCanvas.getContext('2d');
        this.progressWave = progressWave;
        this.marksCc = marksCanvas.getContext('2d');
    },

    updateWidth: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        this.canvases.forEach(function (canvas) {
            canvas.width = this.width;
            canvas.height = this.height;
            canvas.style.width = width;
        }, this);

        this.waveCc.clearRect(0, 0, this.width, this.height);
        this.progressCc.clearRect(0, 0, this.width, this.height);
    },

    clearWave: function () {
        this.waveCc.clearRect(0, 0, this.width, this.height);
        this.progressCc.clearRect(0, 0, this.width, this.height);
    },

    drawWave: function (peaks, max, smoothing) {
        this.waveCc.fillStyle = this.params.waveColor;
        this.progressCc.fillStyle = this.params.progressColor;
        if (smoothing) {
            this.waveCc.globalCompositeOperation = 'lighter';
            this.progressCc.globalCompositeOperation = 'lighter';
            this.waveCc.globalAlpha = 0.15;
            this.progressCc.globalAlpha = 0.15;
        } else {
            this.waveCc.globalAlpha = 1;
            this.progressCc.globalAlpha = 1;
        }

        var coef = this.height / max;
        for (var i = 0; i < this.width; i++) {
            var h = max > 0 ? Math.round(peaks[i] * coef) : 1;
            var y = Math.round((this.height - h) / 2);
            this.waveCc.fillRect(i, y, 1, h);
            this.progressCc.fillRect(i, y, 1, h);
        }
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.pixelRatio;
        this.progressWave.style.width = pos + 'px';
    },

    addMark: function (mark) {
        var redraw = mark.id in this.marks;
        this.marks[mark.id] = mark;
        redraw ? this.redrawMarks() : this.drawMark(mark);
    },

    removeMark: function (mark) {
        delete this.marks[mark.id];
        this.redrawMarks();
    },

    drawMark: function (mark) {
        this.marksCc.fillStyle = mark.color;
        var x = Math.min(
            this.width - mark.width,
            Math.max(0, Math.round(
                mark.percentage * this.width - mark.width / 2
            ))
        );
        this.marksCc.fillRect(x, 0, mark.width, this.height);
    },

    redrawMarks: function () {
        this.marksCc.clearRect(0, 0, this.width, this.height);
        Object.keys(this.marks).forEach(function (id) {
            this.drawMark(this.marks[id]);
        }, this);
    }
});
