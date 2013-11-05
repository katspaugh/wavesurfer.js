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

    drawWave: function (peaks, max) {
        this.waveCc.fillStyle = this.params.waveColor;
        this.progressCc.fillStyle = this.params.progressColor;

        var coef = this.height / max;
        var halfH = this.height / 2;

        this.waveCc.beginPath();
        this.waveCc.moveTo(0, halfH);
        this.progressCc.beginPath();
        this.progressCc.moveTo(0, halfH);
        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i, halfH + h);
            this.progressCc.lineTo(i, halfH + h);
        }
        this.waveCc.lineTo(this.width, halfH);
        this.progressCc.lineTo(this.width, halfH);

        this.waveCc.moveTo(0, halfH);
        this.progressCc.moveTo(0, halfH);
        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i, halfH - h);
            this.progressCc.lineTo(i, halfH - h);
        }

        this.waveCc.lineTo(this.width, halfH);
        this.waveCc.fill();
        this.progressCc.lineTo(this.width, halfH);
        this.progressCc.fill();
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
